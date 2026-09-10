import { type Bar, type Timeframe } from "./types";
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

export async function fetchBybitHistoricalBars(
  symbolInput: string,
  timeframe: Timeframe,
  limit = 500,
  fetcher: typeof fetch = fetch
): Promise<Bar[]> {
  const symbol = normalizeBybitSymbol(symbolInput);
  const interval = BYBIT_TIMEFRAME_MAP[timeframe] || "5";
  const boundedLimit = Math.max(1, Math.min(1000, limit));

  const url = new URL(BYBIT_REST_URL);
  url.searchParams.set("category", "linear");
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("interval", interval);
  url.searchParams.set("limit", String(boundedLimit));

  const response = await fetcher(url.toString(), {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Bybit API returned status ${response.status}`);
  }

  const json = await response.json();
  if (json.retCode !== 0 || !json.result?.list || !Array.isArray(json.result.list)) {
    throw new Error(`Bybit error: ${json.retMsg || "invalid response format"}`);
  }

  // Bybit list items: [startTime, openPrice, highPrice, lowPrice, closePrice, volume, turnover]
  const bars: Bar[] = json.result.list.map((item: string[]) => {
    const t = Number(item[0]);
    const o = parseFloat(item[1]);
    const h = parseFloat(item[2]);
    const l = parseFloat(item[3]);
    const c = parseFloat(item[4]);
    const v = parseFloat(item[5]);
    return { t, o, h, l, c, v };
  });

  return normalizeBars(bars);
}
