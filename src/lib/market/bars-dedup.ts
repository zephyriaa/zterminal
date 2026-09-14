"use client";

import type { Bar, Timeframe } from "./types";
import { normalizeChartBars } from "./chart-data";
import { FREE_TIER_CONFIG } from "../config/free-tier-policy";

interface CacheEntry {
  expiresAt: number;
  bars: Bar[];
}

const memoryCache = new Map<string, CacheEntry>();
const inFlightRequests = new Map<string, Promise<Bar[]>>();

/**
 * Fetches market bars with centralized in-flight request deduplication
 * and short-lived in-memory caching to eliminate redundant network roundtrips.
 */
export async function fetchBarsDeduplicated(
  provider: string,
  symbol: string,
  timeframe: Timeframe,
  toMs: number,
  barsCount: number = 600
): Promise<Bar[]> {
  const cacheKey = `${provider}:${symbol.toUpperCase()}:${timeframe}:${barsCount}`;
  const now = Date.now();

  // 1. Check in-memory cache
  const cached = memoryCache.get(cacheKey);
  if (cached && now < cached.expiresAt && cached.bars.length > 0) {
    return cached.bars;
  }

  // 2. In-flight coalescing: reuse ongoing fetch promise if matching
  const ongoing = inFlightRequests.get(cacheKey);
  if (ongoing) {
    return ongoing;
  }

  // 3. Initiate request with in-flight tracking
  const fetchPromise = (async () => {
    try {
      const url = `/api/bars?provider=${encodeURIComponent(provider)}&symbol=${encodeURIComponent(
        symbol
      )}&tf=${encodeURIComponent(timeframe)}&to=${toMs}&bars=${barsCount}`;

      const response = await fetch(url, {
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch bars: ${response.status} ${response.statusText}`);
      }

      const json = await response.json();
      const rawBars = Array.isArray(json.bars) ? json.bars : [];
      const normalized = normalizeChartBars(rawBars);

      if (normalized.length > 0) {
        memoryCache.set(cacheKey, {
          expiresAt: Date.now() + FREE_TIER_CONFIG.client.barsMemoryCacheTtlMs,
          bars: normalized,
        });

        // Bound cache size to prevent memory bloat
        if (memoryCache.size > 50) {
          const firstKey = memoryCache.keys().next().value;
          if (firstKey) memoryCache.delete(firstKey);
        }
      }

      return normalized;
    } finally {
      inFlightRequests.delete(cacheKey);
    }
  })();

  inFlightRequests.set(cacheKey, fetchPromise);
  return fetchPromise;
}
