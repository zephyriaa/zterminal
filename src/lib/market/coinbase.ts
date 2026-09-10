import { type Bar, type Timeframe } from "./types";
import { normalizeBars } from "./gateio";

export const COINBASE_REST_URL = "https://api.exchange.coinbase.com/products";

export const COINBASE_GRANULARITY_MAP: Partial<Record<Timeframe, number>> = {
  "1m": 60,
  "5m": 300,
  "15m": 900,
  "30m": 900, // fallback granularity
  "1h": 3600,
  "4h": 21600, // 6h closest granularity for Coinbase
  "1d": 86400,
  "1w": 86400, // aggregate from 1d
};

export function normalizeCoinbaseProduct(raw: string): string {
  const cleaned = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (cleaned.endsWith("USDT")) {
    return `${cleaned.slice(0, -4)}-USDT`;
  }
  if (cleaned.endsWith("USD")) {
    return `${cleaned.slice(0, -3)}-USD`;
  }
  return `${cleaned}-USDT`;
}

export async function fetchCoinbaseHistoricalBars(
  symbolInput: string,
  timeframe: Timeframe,
  limit = 300,
  fetcher: typeof fetch = fetch
): Promise<Bar[]> {
  const productId = normalizeCoinbaseProduct(symbolInput);
  const granularity = COINBASE_GRANULARITY_MAP[timeframe] ?? 300;

  const url = new URL(`${COINBASE_REST_URL}/${productId}/candles`);
  url.searchParams.set("granularity", String(granularity));

  const response = await fetcher(url.toString(), {
    headers: {
      Accept: "application/json",
      "User-Agent": "ZTerminal/1.0",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    // If -USDT fails, attempt -USD pair as fallback
    if (productId.endsWith("-USDT")) {
      const usdProduct = productId.replace("-USDT", "-USD");
      const altUrl = new URL(`${COINBASE_REST_URL}/${usdProduct}/candles`);
      altUrl.searchParams.set("granularity", String(granularity));
      const altRes = await fetcher(altUrl.toString(), {
        headers: { Accept: "application/json", "User-Agent": "ZTerminal/1.0" },
        cache: "no-store",
      });
      if (altRes.ok) {
        const altJson = await altRes.json();
        if (Array.isArray(altJson)) {
          const bars: Bar[] = altJson.slice(0, limit).map((item: number[]) => ({
            t: item[0] * 1000,
            l: item[1],
            h: item[2],
            o: item[3],
            c: item[4],
            v: item[5],
          }));
          return normalizeBars(bars);
        }
      }
    }
    throw new Error(`Coinbase API returned status ${response.status}`);
  }

  const json = await response.json();
  if (!Array.isArray(json)) {
    throw new Error("Invalid Coinbase candle response");
  }

  // Coinbase candle item: [time, low, high, open, close, volume]
  const bars: Bar[] = json.slice(0, limit).map((item: number[]) => ({
    t: item[0] * 1000,
    l: item[1],
    h: item[2],
    o: item[3],
    c: item[4],
    v: item[5],
  }));

  return normalizeBars(bars);
}
