import type {
  ParsedOptionContract,
  RawDeribitOptionSummary,
} from "./types";

const MONTH_MAP: Record<string, number> = {
  JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
  JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
};

/**
 * Parses a Deribit instrument name like "BTC-27SEP26-65000-C" into its constituent components.
 */
export function parseDeribitInstrument(instrumentName: string): {
  underlying: 'BTC' | 'ETH';
  expiryTimestamp: number;
  strike: number;
  type: 'call' | 'put';
} | null {
  const parts = instrumentName.trim().toUpperCase().split("-");
  if (parts.length !== 4) return null;

  const [asset, dateStr, strikeStr, typeStr] = parts;
  if (asset !== "BTC" && asset !== "ETH") return null;
  if (typeStr !== "C" && typeStr !== "P") return null;

  const strike = Number(strikeStr);
  if (!Number.isFinite(strike) || strike <= 0) return null;

  // Parse date: e.g. "27SEP26" or "5OCT25"
  const match = dateStr.match(/^(\d{1,2})([A-Z]{3})(\d{2})$/);
  if (!match) return null;

  const day = Number(match[1]);
  const monthName = match[2];
  const shortYear = Number(match[3]);

  const month = MONTH_MAP[monthName];
  if (month === undefined) return null;

  const year = 2000 + shortYear;

  // Deribit options expire at 08:00:00 UTC on the expiration date
  const expiryTimestamp = Date.UTC(year, month, day, 8, 0, 0, 0);

  return {
    underlying: asset,
    expiryTimestamp,
    strike,
    type: typeStr === "C" ? "call" : "put",
  };
}

/**
 * Normalizes a raw Deribit book summary item into a parsed options contract.
 */
export function normalizeDeribitOption(
  raw: RawDeribitOptionSummary,
  nowTimestamp = Date.now()
): ParsedOptionContract | null {
  const parsed = parseDeribitInstrument(raw.instrument_name);
  if (!parsed) return null;

  const timeToExpiryMs = parsed.expiryTimestamp - nowTimestamp;
  const timeToExpiryYears = Math.max(0, timeToExpiryMs / (365.25 * 86400 * 1000));

  // Volatility normalization: Deribit reports IV as percentage e.g. 55.5%
  let ivPercent = raw.mark_iv;
  if (ivPercent == null || !Number.isFinite(ivPercent) || ivPercent <= 0) {
    if (raw.bid_iv != null && raw.ask_iv != null && raw.bid_iv > 0 && raw.ask_iv > 0) {
      ivPercent = 0.5 * (raw.bid_iv + raw.ask_iv);
    } else {
      ivPercent = 0;
    }
  }

  const markIv = Number.isFinite(ivPercent) ? Math.max(0, ivPercent / 100) : 0;
  const openInterest = Number(raw.open_interest) || 0;
  const markPrice = Number(raw.mark_price) || 0;
  const delta = Number(raw.delta) || 0;
  const underlyingPrice = Number(raw.underlying_price ?? raw.estimated_delivery_price) || 0;

  return {
    instrumentName: raw.instrument_name,
    underlying: parsed.underlying,
    expiryTimestamp: parsed.expiryTimestamp,
    timeToExpiryYears,
    strike: parsed.strike,
    type: parsed.type,
    openInterest,
    markIv,
    markPrice,
    delta,
    underlyingPrice,
  };
}

/**
 * Fetches the active options chain book summary from Deribit public REST API.
 */
export async function fetchDeribitOptionsChain(
  currency: 'BTC' | 'ETH',
  fetcher: typeof fetch = fetch
): Promise<{ contracts: ParsedOptionContract[]; indexPrice: number }> {
  const url = `https://www.deribit.com/api/v2/public/get_book_summary_by_currency?currency=${currency}&kind=option`;

  const response = await fetcher(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Deribit API error: HTTP ${response.status}`);
  }

  const json = await response.json();
  if (!json || !Array.isArray(json.result)) {
    throw new Error(`Invalid response format from Deribit API`);
  }

  const now = Date.now();
  const contracts: ParsedOptionContract[] = [];
  let indexPrice = 0;

  for (const item of json.result as RawDeribitOptionSummary[]) {
    const contract = normalizeDeribitOption(item, now);
    if (contract) {
      contracts.push(contract);
      if (contract.underlyingPrice > 0 && indexPrice === 0) {
        indexPrice = contract.underlyingPrice;
      }
    }
  }

  return { contracts, indexPrice };
}
