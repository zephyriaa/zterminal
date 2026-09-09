"use client";

import { fetchBinanceHistoricalBars } from "./binance";
import { getCachedBars, cacheBars } from "./bar-cache";
import { TIMEFRAME_SECONDS, type Bar, type Timeframe } from "./types";

/**
 * Intelligent historical bar provider that uses local IndexedDB caching
 * and selectively backfills missing date ranges from Binance Futures.
 */
export async function getOrFetchHistoricalBars(
  symbol: string,
  timeframe: Timeframe,
  fromMs: number,
  toMs: number,
  onProgress?: (msg: string) => void
): Promise<Bar[]> {
  const intervalMs = TIMEFRAME_SECONDS[timeframe] * 1_000;
  const normalizedFrom = Math.floor(fromMs / intervalMs) * intervalMs;
  const normalizedTo = Math.floor(toMs / intervalMs) * intervalMs;

  onProgress?.(`Checking local cache for ${symbol} (${timeframe})...`);

  // 1. Query local IndexedDB cache
  const cached = await getCachedBars(symbol, timeframe, normalizedFrom, normalizedTo);

  // If cache covers at least 95% of expected bars and contains recent data, return it
  const expectedBars = Math.floor((normalizedTo - normalizedFrom) / intervalMs) + 1;
  if (cached.length >= expectedBars * 0.95 && cached.length > 0) {
    const cachedEarliest = cached[0].t;
    const cachedLatest = cached[cached.length - 1].t;

    // If both ends are reasonably covered
    if (cachedEarliest <= normalizedFrom + intervalMs && cachedLatest >= normalizedTo - intervalMs) {
      onProgress?.(`Loaded ${cached.length} bars from local cache.`);
      return cached;
    }
  }

  // 2. Fetch missing data from network (Binance Futures REST)
  onProgress?.(`Fetching ${symbol} historical bars from Binance...`);
  try {
    const fetched = await fetchBinanceHistoricalBars(symbol, timeframe, normalizedFrom, normalizedTo);

    if (fetched.length > 0) {
      // Store in local cache asynchronously
      void cacheBars(symbol, timeframe, fetched, "binance");
      onProgress?.(`Fetched and cached ${fetched.length} verified bars.`);
      return fetched;
    }
  } catch (err) {
    console.warn("Failed to fetch fresh bars from Binance, falling back to cached:", err);
    if (cached.length > 0) {
      onProgress?.(`Offline fallback: loaded ${cached.length} bars from cache.`);
      return cached;
    }
    throw err;
  }

  return cached;
}
