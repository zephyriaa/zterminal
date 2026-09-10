/**
 * Deribit Public Options Market Data & Gamma Exposure (GEX) Engine.
 * Fetches real-time crypto option books (BTC & ETH) with zero API keys.
 * Computes:
 * - Net GEX ($ millions per 1% move)
 * - Call GEX vs Put GEX breakdown
 * - Gamma Flip Price level
 * - Call Wall & Put Wall strikes
 * - Max Pain price level
 * - Put / Call Open Interest & Volume Ratios
 * - Per-strike GEX profiles for visual heatmaps / bar charts
 */

export interface StrikeGexData {
  strike: number;
  callOi: number;
  putOi: number;
  callGexUsd: number; // in USD
  putGexUsd: number;  // in USD (negative by convention)
  netGexUsd: number;  // callGexUsd + putGexUsd
  callVolume: number;
  putVolume: number;
}

export interface DeribitGexSummary {
  currency: "BTC" | "ETH";
  spotPrice: number;
  timestamp: number;
  totalCallOi: number;
  totalPutOi: number;
  totalOiUsd: number;
  putCallRatioOi: number;
  putCallRatioVol: number;
  netGexUsd: number;      // Total net GEX ($)
  netGexMillions: number; // in $M
  callWall: number;       // strike with max call GEX
  putWall: number;        // strike with max put GEX (absolute)
  maxPain: number;        // strike minimizing buyer payout
  gammaFlip: number;      // estimated price where net gamma crosses 0
  regime: "POSITIVE_GAMMA" | "NEGATIVE_GAMMA";
  strikes: StrikeGexData[];
}

interface DeribitOptionSummary {
  instrument_name: string;
  open_interest: number;
  mark_iv: number;
  underlying_price: number;
  volume: number;
  volume_usd?: number;
  bid_price?: number;
  ask_price?: number;
  mark_price?: number;
}

// Standard normal probability density function N'(x)
function normalPdf(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

// Black-Scholes Gamma: N'(d1) / (S * sigma * sqrt(T))
function calculateBsGamma(S: number, K: number, sigma: number, T: number): number {
  if (S <= 0 || K <= 0 || sigma <= 0.001 || T <= 0.0001) return 0;
  const d1 = (Math.log(S / K) + 0.5 * sigma * sigma * T) / (sigma * Math.sqrt(T));
  const gamma = normalPdf(d1) / (S * sigma * Math.sqrt(T));
  return Number.isFinite(gamma) ? gamma : 0;
}

const MONTH_MAP: Record<string, number> = {
  JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
  JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
};

// Parse Deribit option symbol: e.g. "BTC-25SEP26-155000-P" or "ETH-28MAR25-3000-C"
function parseDeribitInstrument(instrumentName: string) {
  const parts = instrumentName.split("-");
  if (parts.length < 4) return null;
  const currency = parts[0] as "BTC" | "ETH";
  const dateStr = parts[1];
  const strike = parseFloat(parts[2]);
  const type = parts[3].toUpperCase() as "C" | "P";

  const match = dateStr.match(/^(\d{1,2})([A-Z]{3})(\d{2})$/);
  if (!match) return null;
  const day = parseInt(match[1], 10);
  const monthStr = match[2];
  const yearShort = parseInt(match[3], 10);
  const month = MONTH_MAP[monthStr];
  if (month === undefined) return null;
  const year = 2000 + yearShort;

  // Deribit options expire at 08:00 UTC on the expiry date
  const expiryTimestamp = Date.UTC(year, month, day, 8, 0, 0);

  return { currency, strike, type, expiryTimestamp };
}

export async function fetchDeribitGex(currency: "BTC" | "ETH" = "BTC"): Promise<DeribitGexSummary> {
  const url = `https://www.deribit.com/api/v2/public/get_book_summary_by_currency?currency=${currency}&kind=option`;
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Deribit API error: HTTP ${response.status}`);
  }

  const json = await response.json();
  const rawList: DeribitOptionSummary[] = json.result || [];
  if (!Array.isArray(rawList) || rawList.length === 0) {
    throw new Error("No options data returned by Deribit");
  }

  const now = Date.now();
  let spotPrice = 0;
  for (const item of rawList) {
    if (item.underlying_price && item.underlying_price > 0) {
      spotPrice = item.underlying_price;
      break;
    }
  }
  if (!spotPrice) spotPrice = currency === "BTC" ? 78_000 : 2_500;

  const strikeMap = new Map<number, StrikeGexData>();

  let totalCallOi = 0;
  let totalPutOi = 0;
  let totalCallVol = 0;
  let totalPutVol = 0;
  let totalNetGexUsd = 0;

  for (const item of rawList) {
    const parsed = parseDeribitInstrument(item.instrument_name);
    if (!parsed) continue;

    const { strike, type, expiryTimestamp } = parsed;
    const oi = Number(item.open_interest) || 0;
    const vol = Number(item.volume) || 0;
    if (oi <= 0 && vol <= 0) continue;

    const timeToExpiryYears = Math.max(0.001, (expiryTimestamp - now) / (365.25 * 86400 * 1000));
    const iv = Math.max(0.05, (item.mark_iv || 60) / 100);

    // Calculate Gamma
    const gamma = calculateBsGamma(spotPrice, strike, iv, timeToExpiryYears);

    // Dollar Gamma per 1% move:
    // Spot GEX = Gamma * OI (in coins) * Spot^2 * 0.01
    // Dealer Net GEX convention: Dealers are Long Calls (Positive Gamma), Dealers are Short Puts (Negative Gamma)
    const dollarGex = gamma * oi * (spotPrice * spotPrice) * 0.01;

    let entry = strikeMap.get(strike);
    if (!entry) {
      entry = {
        strike,
        callOi: 0,
        putOi: 0,
        callGexUsd: 0,
        putGexUsd: 0,
        netGexUsd: 0,
        callVolume: 0,
        putVolume: 0,
      };
      strikeMap.set(strike, entry);
    }

    if (type === "C") {
      entry.callOi += oi;
      entry.callVolume += vol;
      entry.callGexUsd += dollarGex;
      totalCallOi += oi;
      totalCallVol += vol;
    } else {
      entry.putOi += oi;
      entry.putVolume += vol;
      // Put GEX is negative dollar gamma for dealers
      entry.putGexUsd -= dollarGex;
      totalPutOi += oi;
      totalPutVol += vol;
    }

    entry.netGexUsd = entry.callGexUsd + entry.putGexUsd;
  }

  // Filter strikes within a relevant spot price window (0.4x to 2.0x spot) for clean display
  const minStrike = spotPrice * 0.45;
  const maxStrike = spotPrice * 1.85;

  const sortedStrikes = Array.from(strikeMap.values())
    .filter((s) => s.strike >= minStrike && s.strike <= maxStrike)
    .sort((a, b) => a.strike - b.strike);

  let callWall = spotPrice;
  let maxCallGex = -Infinity;
  let putWall = spotPrice;
  let maxPutGex = 0; // putGexUsd is negative, so min value is largest magnitude

  for (const s of sortedStrikes) {
    totalNetGexUsd += s.netGexUsd;
    if (s.callGexUsd > maxCallGex) {
      maxCallGex = s.callGexUsd;
      callWall = s.strike;
    }
    if (s.putGexUsd < maxPutGex) {
      maxPutGex = s.putGexUsd;
      putWall = s.strike;
    }
  }

  // Calculate Max Pain: strike that minimizes total payoff value
  let minTotalPain = Infinity;
  let maxPain = spotPrice;
  for (const candidate of sortedStrikes) {
    let currentPain = 0;
    for (const opt of sortedStrikes) {
      if (candidate.strike > opt.strike) {
        currentPain += opt.callOi * (candidate.strike - opt.strike);
      } else if (candidate.strike < opt.strike) {
        currentPain += opt.putOi * (opt.strike - candidate.strike);
      }
    }
    if (currentPain < minTotalPain) {
      minTotalPain = currentPain;
      maxPain = candidate.strike;
    }
  }

  // Gamma flip estimation: find where cumulative strike net GEX changes sign
  let gammaFlip = spotPrice;
  for (let i = 0; i < sortedStrikes.length - 1; i++) {
    const curr = sortedStrikes[i];
    const next = sortedStrikes[i + 1];
    if ((curr.netGexUsd <= 0 && next.netGexUsd > 0) || (curr.netGexUsd >= 0 && next.netGexUsd < 0)) {
      gammaFlip = (curr.strike + next.strike) / 2;
      break;
    }
  }

  const putCallRatioOi = totalCallOi > 0 ? totalPutOi / totalCallOi : 1;
  const putCallRatioVol = totalCallVol > 0 ? totalPutVol / totalCallVol : 1;
  const netGexMillions = totalNetGexUsd / 1_000_000;

  return {
    currency,
    spotPrice,
    timestamp: now,
    totalCallOi,
    totalPutOi,
    totalOiUsd: (totalCallOi + totalPutOi) * spotPrice,
    putCallRatioOi: Math.round(putCallRatioOi * 100) / 100,
    putCallRatioVol: Math.round(putCallRatioVol * 100) / 100,
    netGexUsd: totalNetGexUsd,
    netGexMillions: Math.round(netGexMillions * 10) / 10,
    callWall,
    putWall,
    maxPain,
    gammaFlip,
    regime: totalNetGexUsd >= 0 ? "POSITIVE_GAMMA" : "NEGATIVE_GAMMA",
    strikes: sortedStrikes,
  };
}
