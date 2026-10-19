import { TIMEFRAME_SECONDS, type Bar, type Timeframe } from "./types";
import { normalizeBars } from "./gateio";

export const BYBIT_REST_URL = "https://api.bybit.com/v5/market/kline";

export const BYBIT_TIMEFRAME_MAP: Record<Timeframe, string> = {
  "1m": "1",
  "5m": "5",
  "15m": "15",
  "30m": "30",
  "1h": "60",
  "4h": "240",
  "1d": "D",
  "1w": "W",
};

export function normalizeBybitSymbol(raw: string): string {
  const cleaned = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (cleaned.endsWith("USDT")) return cleaned;
  if (cleaned.endsWith("USD")) return `${cleaned.slice(0, -3)}USDT`;
  return `${cleaned}USDT`;
}

/** Inclusive provider-native range; bounded pages, no fallback venue or padding. */
export async function fetchBybitHistoricalBars(
  symbolInput: string,
  timeframe: Timeframe,
  fromMs: number,
  toMs: number,
  fetcher: (input: string | URL, init?: RequestInit) => Promise<Response> = fetch
): Promise<Bar[]> {
  if (!Number.isSafeInteger(fromMs) || !Number.isSafeInteger(toMs) || fromMs > toMs) throw new Error("invalid Bybit candle range");
  const symbol = normalizeBybitSymbol(symbolInput);
  const interval = BYBIT_TIMEFRAME_MAP[timeframe];
  if (!interval) throw new Error("unsupported Bybit timeframe");
  const step = TIMEFRAME_SECONDS[timeframe] * 1000;
  const output: Bar[] = [];
  let cursor = fromMs, pages = 0;
  while (cursor <= toMs) {
    if (++pages > 48) throw new Error("Bybit history exceeds 48 pages; reduce the range");
    const end = Math.min(toMs, cursor + 999 * step);
    const url = new URL(BYBIT_REST_URL);
    for (const [key, value] of Object.entries({ category: "linear", symbol, interval, limit: "1000", start: String(cursor), end: String(end) })) url.searchParams.set(key, value);
    const response = await fetcher(url.toString(), { headers: { Accept: "application/json" }, cache: "no-store" });
    if (!response.ok) throw new Error(`Bybit API returned status ${response.status}`);
    const json = await response.json();
    if (json.retCode !== 0 || !Array.isArray(json.result?.list)) throw new Error("Invalid Bybit history response");
    output.push(...normalizeBars(json.result.list.map((item: unknown) => {
      if (!Array.isArray(item) || item.length < 6) throw new Error("invalid Bybit candle");
      const [t, o, h, l, c, v] = item.slice(0, 6).map(Number);
      return { t, o, h, l, c, v };
    })));
    cursor = end + step;
  }
  return normalizeBars(output).filter(bar => bar.t >= fromMs && bar.t <= toMs);
}
