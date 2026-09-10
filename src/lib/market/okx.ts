import { type Bar, type Timeframe } from "./types";
import { normalizeBars } from "./gateio";

export const OKX_REST_URL = "https://www.okx.com/api/v5/market/candles";

export const OKX_BAR_MAP: Record<Timeframe, string> = {
  "1m": "1m",
  "5m": "5m",
  "15m": "15m",
  "30m": "30m",
  "1h": "1H",
  "4h": "4H",
  "1d": "1D",
  "1w": "1W",
};

export function normalizeOkxInstrument(raw: string): string {
  const cleaned = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (cleaned.endsWith("USDT")) {
    return `${cleaned.slice(0, -4)}-USDT`;
  }
  if (cleaned.endsWith("USD")) {
    return `${cleaned.slice(0, -3)}-USD`;
  }
  return `${cleaned}-USDT`;
}

export async function fetchOkxHistoricalBars(
  symbolInput: string,
  timeframe: Timeframe,
  limit = 300,
  fetcher: typeof fetch = fetch
): Promise<Bar[]> {
  const instId = normalizeOkxInstrument(symbolInput);
  const bar = OKX_BAR_MAP[timeframe] || "5m";
  const boundedLimit = Math.max(1, Math.min(300, limit));

  const url = new URL(OKX_REST_URL);
  url.searchParams.set("instId", instId);
  url.searchParams.set("bar", bar);
  url.searchParams.set("limit", String(boundedLimit));

  const response = await fetcher(url.toString(), {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`OKX API returned status ${response.status}`);
  }

  const json = await response.json();
  if (json.code !== "0" || !Array.isArray(json.data)) {
    throw new Error(`OKX error: ${json.msg || "invalid response format"}`);
  }

  // OKX candle item: [ts, o, h, l, c, vol, volCcy, volCcyQuote, confirm]
  const bars: Bar[] = json.data.map((item: string[]) => ({
    t: Number(item[0]),
    o: parseFloat(item[1]),
    h: parseFloat(item[2]),
    l: parseFloat(item[3]),
    c: parseFloat(item[4]),
    v: parseFloat(item[5]),
  }));

  return normalizeBars(bars);
}
