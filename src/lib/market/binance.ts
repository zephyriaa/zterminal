import { TIMEFRAME_SECONDS, type Bar, type Timeframe } from "./types";
import { normalizeBars } from "./gateio";

export const BINANCE_FUTURES_REST_URL = process.env.BINANCE_FUTURES_REST_URL ?? "https://fapi.binance.com";
const MAX_BINANCE_CANDLES_PER_REQUEST = 1_500;
const MAX_BINANCE_CANDLE_PAGES = 48;

type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

export function normalizeBinanceSymbol(input: string | null | undefined) {
  if (!input) return null;
  const normalized = input.trim().toUpperCase();
  return /^[A-Z0-9]+USDT$/.test(normalized) ? normalized : null;
}

function decimal(value: unknown, field: string) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isFinite(parsed)) throw new Error(`invalid Binance ${field}`);
  return parsed;
}

function klineToBar(raw: unknown): Bar {
  if (!Array.isArray(raw) || raw.length < 6) throw new Error("invalid Binance kline payload");
  return {
    t: decimal(raw[0], "kline open time"),
    o: decimal(raw[1], "kline open"),
    h: decimal(raw[2], "kline high"),
    l: decimal(raw[3], "kline low"),
    c: decimal(raw[4], "kline close"),
    v: Math.abs(decimal(raw[5], "kline volume")),
  };
}

/**
 * Fetches finite, bounded public USDⓈ-M futures klines. It never pads gaps with
 * generated candles and preserves the active provider identity at the caller.
 */
export async function fetchBinanceHistoricalBars(
  inputSymbol: string,
  timeframe: Timeframe,
  fromMs: number,
  toMs: number,
  fetcher: FetchLike = fetch,
): Promise<Bar[]> {
  const symbol = normalizeBinanceSymbol(inputSymbol);
  if (!symbol) throw new Error(`unsupported Binance USDⓈ-M symbol: ${inputSymbol}`);
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || fromMs >= toMs) throw new Error("invalid historical candle range");

  const intervalMs = TIMEFRAME_SECONDS[timeframe] * 1_000;
  const output: Bar[] = [];
  let cursor = Math.floor(fromMs / intervalMs) * intervalMs;
  let pages = 0;

  while (cursor <= toMs) {
    if (pages >= MAX_BINANCE_CANDLE_PAGES) throw new Error(`historical request exceeds ${MAX_BINANCE_CANDLE_PAGES} Binance pages; reduce range or use a larger timeframe`);
    const pageEnd = Math.min(toMs, cursor + intervalMs * (MAX_BINANCE_CANDLES_PER_REQUEST - 1));
    const url = new URL(`${BINANCE_FUTURES_REST_URL}/fapi/v1/klines`);
    url.searchParams.set("symbol", symbol);
    url.searchParams.set("interval", timeframe);
    url.searchParams.set("startTime", String(cursor));
    url.searchParams.set("endTime", String(pageEnd));
    url.searchParams.set("limit", String(MAX_BINANCE_CANDLES_PER_REQUEST));
    const response = await fetcher(url, { headers: { Accept: "application/json" }, cache: "no-store" });
    if (!response.ok) throw new Error(`Binance historical candles failed (${response.status})`);
    const raw = await response.json();
    if (!Array.isArray(raw)) throw new Error("invalid Binance historical candle response");
    output.push(...raw.map(klineToBar));
    if (pageEnd >= toMs) break;
    cursor = pageEnd + intervalMs;
    pages += 1;
  }

  return normalizeBars(output).filter((bar) => bar.t >= fromMs && bar.t <= toMs);
}
