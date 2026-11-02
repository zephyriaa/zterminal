import { DIRECT_VENUES, fetchPublicBars, type DirectVenue } from "./public-data";
import { chartHistoryRange } from "./chart-data";
import { fetchBarsDeduplicated } from "./bars-dedup";
import { TIMEFRAME_SECONDS, type Bar, type BarsResult, type ContractMetadata, type Timeframe } from "./types";

interface VenueEntry {
  venue: string;
  bar: Bar;
  baseVol: number;
}

/** Merges candles from multiple venues: volume-weighted OHLC, summed base volume, 2% median outlier guard. */
export function mergeVenueBars(results: BarsResult[]): Bar[] {
  if (!results.length) return [];
  // Bucket entries by timestamp
  const buckets = new Map<number, VenueEntry[]>();

  for (const res of results) {
    const multiplier = res.volumeUnit === "contracts" ? (res.contract.multiplier || 1) : 1;
    for (const b of res.bars) {
      if (!Number.isFinite(b.t) || !Number.isFinite(b.o) || !Number.isFinite(b.h) || !Number.isFinite(b.l) || !Number.isFinite(b.c) || !Number.isFinite(b.v) || b.c <= 0) continue;
      const baseVol = Math.max(0, b.v * multiplier);
      let list = buckets.get(b.t);
      if (!list) {
        list = [];
        buckets.set(b.t, list);
      }
      list.push({ venue: res.selectedProvider, bar: b, baseVol });
    }
  }

  const timestamps = Array.from(buckets.keys()).sort((a, b) => a - b);
  const output: Bar[] = [];

  for (const t of timestamps) {
    const entries = buckets.get(t);
    if (!entries || !entries.length) continue;

    // Outlier filter: compute median close, reject venues deviating > 2% from median
    const sortedCloses = entries.map(e => e.bar.c).sort((a, b) => a - b);
    const mid = Math.floor(sortedCloses.length / 2);
    const medianClose = sortedCloses.length % 2 === 0
      ? (sortedCloses[mid - 1] + sortedCloses[mid]) / 2
      : sortedCloses[mid];

    const admitted = entries.filter(e => {
      if (medianClose <= 0) return true;
      return Math.abs(e.bar.c - medianClose) / medianClose <= 0.02;
    });
    const active = admitted.length > 0 ? admitted : entries;

    const totalBaseVol = active.reduce((sum, e) => sum + e.baseVol, 0);
    let o: number, h: number, l: number, c: number;

    if (totalBaseVol > 0) {
      o = active.reduce((sum, e) => sum + e.bar.o * e.baseVol, 0) / totalBaseVol;
      h = active.reduce((sum, e) => sum + e.bar.h * e.baseVol, 0) / totalBaseVol;
      l = active.reduce((sum, e) => sum + e.bar.l * e.baseVol, 0) / totalBaseVol;
      c = active.reduce((sum, e) => sum + e.bar.c * e.baseVol, 0) / totalBaseVol;
    } else {
      const n = active.length;
      o = active.reduce((sum, e) => sum + e.bar.o, 0) / n;
      h = active.reduce((sum, e) => sum + e.bar.h, 0) / n;
      l = active.reduce((sum, e) => sum + e.bar.l, 0) / n;
      c = active.reduce((sum, e) => sum + e.bar.c, 0) / n;
    }

    // Candlestick structural sanity
    h = Math.max(h, o, c);
    l = Math.min(l, o, c);

    output.push({ t, o, h, l, c, v: totalBaseVol });
  }

  return output;
}

const aggCache = new Map<string, { expiresAt: number; result: BarsResult }>();
const aggPending = new Map<string, Promise<BarsResult>>();

/** Fetch candles in parallel from all 4 venues (Binance, Bybit, OKX, Gate.io) and merge. */
export async function fetchAggregatedBars(
  symbol: string,
  timeframe: Timeframe,
  to: number,
  count: number,
  signal?: AbortSignal
): Promise<BarsResult> {
  signal?.throwIfAborted();
  const cacheKey = `agg:${symbol.toUpperCase()}:${timeframe}:${count}:${to}`;
  const hit = aggCache.get(cacheKey);
  if (hit && Date.now() < hit.expiresAt) return hit.result;

  let request = aggPending.get(cacheKey);
  if (!request) {
    request = (async () => {
      const settled = await Promise.allSettled(
        DIRECT_VENUES.map(venue => fetchPublicBars(venue, symbol, timeframe, to, count))
      );
      const fulfilled = settled
        .filter((r): r is PromiseFulfilledResult<BarsResult> => r.status === "fulfilled")
        .map(r => r.value);

      if (!fulfilled.length) {
        const firstErr = settled.find(r => r.status === "rejected") as PromiseRejectedResult | undefined;
        throw new Error(firstErr?.reason?.message ?? "All market venues failed to return historical data");
      }

      const mergedBars = mergeVenueBars(fulfilled);
      if (!mergedBars.length) {
        throw new Error("No aligned candles returned across market venues");
      }

      const range = chartHistoryRange(to, count, timeframe);
      const refContract = fulfilled[0].contract;
      const root = refContract.root || symbol.replace(/[-_]?USDT(-SWAP)?$/i, "").toUpperCase();
      const minTickSize = Math.min(...fulfilled.map(f => f.contract.tickSize).filter(t => t > 0));
      const minStep = Math.min(...fulfilled.map(f => f.contract.quantityStep ?? 1).filter(s => s > 0));

      const contract: ContractMetadata = {
        root,
        symbol: `${root}USDT`,
        description: `${root}/USDT perpetual (Aggregated)`,
        exchange: "BINANCE", // representative exchange for type compatibility
        product: "perpetual",
        tickSize: Number.isFinite(minTickSize) && minTickSize > 0 ? minTickSize : 0.01,
        tickValue: Number.isFinite(minTickSize) && minTickSize > 0 ? minTickSize : 0.01,
        multiplier: 1,
        quantityStep: Number.isFinite(minStep) && minStep > 0 ? minStep : 0.001,
        currency: "USDT",
        session: "crypto",
        supportsDepth: false,
        supportsMBO: false,
        verified: true,
      };

      const participatingVenues = fulfilled.map(f => f.selectedProvider).join("+");
      const retrievedAt = Date.now();
      const result: BarsResult = {
        symbol,
        canonicalSymbol: `${root}USDT`,
        nativeSymbol: `${root}USDT`,
        timeframe,
        selectedProvider: "aggregated",
        effectiveProvider: `aggregated(${participatingVenues})`,
        environment: "live",
        dataStatus: "HISTORICAL",
        contract,
        retrievedAt,
        sourceTimestamp: mergedBars.at(-1)?.t ?? null,
        timestampUnit: "ms",
        integrity: "provider-ohlcv",
        cache: "network",
        requestedFrom: range.from,
        requestedTo: to,
        requestedCount: count,
        gapCount: Math.max(0, range.expected - mergedBars.length),
        hasOpenCandle: mergedBars.some(b => b.t + TIMEFRAME_SECONDS[timeframe] * 1000 > retrievedAt),
        volumeUnit: "base",
        bars: mergedBars,
      };

      aggCache.set(cacheKey, { expiresAt: Date.now() + 5000, result });
      if (aggCache.size > 50) aggCache.delete(aggCache.keys().next().value!);
      return result;
    })().finally(() => aggPending.delete(cacheKey));

    aggPending.set(cacheKey, request);
  }

  const result = await request;
  signal?.throwIfAborted();
  return result;
}

/** Unified chart loader: fetches aggregated data for crypto perpetuals when enabled, or single venue. */
export async function fetchChartBars(
  symbol: string,
  timeframe: Timeframe,
  to: number,
  count: number,
  aggregated: boolean,
  provider: string,
  signal?: AbortSignal,
  allowOlderHistory = false
): Promise<BarsResult> {
  const isCryptoPerp = /^[A-Z0-9]+([_-]?USDT(-SWAP)?)?$/i.test(symbol) && provider !== "mock";
  if (aggregated && isCryptoPerp) {
    return fetchAggregatedBars(symbol, timeframe, to, count, signal);
  }
  return fetchBarsDeduplicated(provider, symbol, timeframe, to, count, signal, allowOlderHistory);
}
