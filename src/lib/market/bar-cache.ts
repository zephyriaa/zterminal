"use client";

import type { Bar, BarsResult, Timeframe } from "./types";
import { chartHistoryRange, normalizeChartBars } from "./chart-data";
import { alignToTimeframe } from "./session";
import { normalizeGateioSymbol } from "./gateio";

const DB_NAME = "zterminal-market-cache-v1";
const DB_VERSION = 2;
const HISTORY_STORE = "history-results";
const BARS_STORE = "bars";
const DATASETS_STORE = "datasets";

export interface DatasetMetadata {
  id: string; // `${symbol}:${timeframe}`
  symbol: string;
  timeframe: string;
  source: "binance" | "gateio" | "custom_csv" | "custom_parquet";
  description?: string;
  earliestMs: number;
  latestMs: number;
  count: number;
  updatedAt: number;
}

interface StoredBarRecord {
  key: string; // `${symbol}:${timeframe}:${t}`
  symbol: string;
  timeframe: string;
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  buyVol?: number;
  sellVol?: number;
}

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof indexedDB !== "undefined";
}

let dbPromise: Promise<IDBDatabase> | null = null;

function getDB(): Promise<IDBDatabase> {
  if (!isBrowser()) {
    return Promise.reject(new Error("IndexedDB is not available in non-browser environments."));
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(HISTORY_STORE)) db.createObjectStore(HISTORY_STORE);
        if (!db.objectStoreNames.contains(BARS_STORE)) {
          const barsStore = db.createObjectStore(BARS_STORE, { keyPath: "key" });
          barsStore.createIndex("by_series_time", ["symbol", "timeframe", "t"], { unique: true });
        }
        if (!db.objectStoreNames.contains(DATASETS_STORE)) {
          db.createObjectStore(DATASETS_STORE, { keyPath: "id" });
        }
      };

      request.onsuccess = () => { request.result.onversionchange = () => { request.result.close(); dbPromise = null; }; resolve(request.result); };
      request.onerror = () => { dbPromise = null; reject(request.error); };
      request.onblocked = () => { dbPromise = null; reject(new Error("Market cache upgrade blocked by another tab")); };
    });
  }
  return dbPromise;
}

/**
 * Retrieves cached bars for a given symbol, timeframe, and timestamp interval [fromMs, toMs].
 */
export async function getCachedBars(
  symbol: string,
  timeframe: Timeframe,
  fromMs: number,
  toMs: number
): Promise<Bar[]> {
  if (!isBrowser()) return [];
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([BARS_STORE], "readonly");
      const store = transaction.objectStore(BARS_STORE);
      const index = store.index("by_series_time");
      const range = IDBKeyRange.bound([symbol, timeframe, fromMs], [symbol, timeframe, toMs]);
      const request = index.getAll(range);

      request.onsuccess = () => {
        const records = request.result as StoredBarRecord[];
        const bars: Bar[] = records.map((r) => ({
          t: r.t,
          o: r.o,
          h: r.h,
          l: r.l,
          c: r.c,
          v: r.v,
          buyVol: r.buyVol,
          sellVol: r.sellVol,
        }));
        // Ensure sorted by time
        bars.sort((a, b) => a.t - b.t);
        resolve(bars);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn("Failed to retrieve cached bars from IndexedDB:", err);
    return [];
  }
}

/**
 * Stores an array of bars for a given symbol and timeframe, updating dataset metadata.
 */
export async function cacheBars(
  symbol: string,
  timeframe: Timeframe,
  bars: Bar[],
  source: DatasetMetadata["source"] = "binance"
): Promise<void> {
  if (!isBrowser() || bars.length === 0) return;
  try {
    const db = await getDB();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction([BARS_STORE, DATASETS_STORE], "readwrite");
      const barsStore = transaction.objectStore(BARS_STORE);
      const datasetsStore = transaction.objectStore(DATASETS_STORE);

      for (const b of bars) {
        const record: StoredBarRecord = {
          key: `${symbol}:${timeframe}:${b.t}`,
          symbol,
          timeframe,
          t: b.t,
          o: b.o,
          h: b.h,
          l: b.l,
          c: b.c,
          v: b.v,
          buyVol: b.buyVol,
          sellVol: b.sellVol,
        };
        barsStore.put(record);
      }

      // Update metadata
      const datasetId = `${symbol}:${timeframe}`;
      const metaReq = datasetsStore.get(datasetId);

      metaReq.onsuccess = () => {
        const existing = metaReq.result as DatasetMetadata | undefined;
        const sortedTimes = bars.map((b) => b.t).sort((a, b) => a - b);
        const earliest = existing
          ? Math.min(existing.earliestMs, sortedTimes[0])
          : sortedTimes[0];
        const latest = existing
          ? Math.max(existing.latestMs, sortedTimes[sortedTimes.length - 1])
          : sortedTimes[sortedTimes.length - 1];

        const updated: DatasetMetadata = {
          id: datasetId,
          symbol,
          timeframe,
          source: existing?.source ?? source,
          earliestMs: earliest,
          latestMs: latest,
          count: (existing?.count ?? 0) + bars.length,
          updatedAt: Date.now(),
        };
        datasetsStore.put(updated);
      };

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } catch (err) {
    console.warn("Failed to cache bars to IndexedDB:", err);
  }
}

/**
 * Returns metadata of all cached datasets.
 */
export async function listCachedDatasets(): Promise<DatasetMetadata[]> {
  if (!isBrowser()) return [];
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([DATASETS_STORE], "readonly");
      const store = transaction.objectStore(DATASETS_STORE);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result as DatasetMetadata[]);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn("Failed to list cached datasets:", err);
    return [];
  }
}

/**
 * Purges all cached bars and metadata for a specific dataset or all datasets.
 */
export async function purgeDataset(datasetId?: string): Promise<void> {
  if (!isBrowser()) return;
  try {
    const db = await getDB();
    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction([BARS_STORE, DATASETS_STORE], "readwrite");
      const barsStore = transaction.objectStore(BARS_STORE);
      const datasetsStore = transaction.objectStore(DATASETS_STORE);

      if (datasetId) {
        datasetsStore.delete(datasetId);
        // Delete all bars matching symbol and timeframe
        const [symbol, timeframe] = datasetId.split(":");
        const index = barsStore.index("by_series_time");
        const range = IDBKeyRange.bound([symbol, timeframe, 0], [symbol, timeframe, Infinity]);
        const req = index.openCursor(range);
        req.onsuccess = (e) => {
          const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
          if (cursor) {
            cursor.delete();
            cursor.continue();
          }
        };
      } else {
        barsStore.clear();
        datasetsStore.clear();
      }

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } catch (err) {
    console.warn("Failed to purge dataset:", err);
  }
}

/** Full provenance is retained separately from legacy unqualified bar records. */
function chartCacheKey(provider: string, symbol: string, timeframe: Timeframe, to: number, count: number) {
  const native = normalizeGateioSymbol(symbol);
  if (!native) throw new Error("Unsupported cached instrument");
  const range = chartHistoryRange(to, count, timeframe);
  return `${provider}:${native}:${timeframe}:${count}:${range.from}:${range.lastOpen}`;
}

export async function cacheChartHistory(result: BarsResult) {
  if (!isBrowser()) return;
  const db = await getDB(), key = chartCacheKey(result.selectedProvider, result.symbol, result.timeframe, result.requestedTo, result.requestedCount);
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(HISTORY_STORE, "readwrite"), store = tx.objectStore(HISTORY_STORE);
    store.put(result, key);
    const keys = store.getAllKeys();
    keys.onsuccess = () => { for (const old of keys.result.filter(value => value !== key).slice(0, Math.max(0, keys.result.length - 50))) store.delete(old); };
    tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
  });
}

/** Only initial charts may explicitly opt into an older saved window; research and paging require their requested range. */
export function restoreCachedChartHistory(result: BarsResult | undefined, provider: string, symbol: string, timeframe: Timeframe, to: number, count: number, allowOlder = false): BarsResult | null {
  try {
    if (!result || result.selectedProvider !== provider || result.effectiveProvider !== provider || result.timeframe !== timeframe || result.requestedCount !== count || result.environment !== "live" || result.integrity !== "provider-ohlcv" || !result.contract?.verified || result.contract.product !== "perpetual" || result.contract.exchange.toLowerCase() !== provider || normalizeGateioSymbol(result.contract.symbol) !== normalizeGateioSymbol(symbol) || normalizeGateioSymbol(result.symbol) !== normalizeGateioSymbol(symbol) || result.nativeSymbol !== result.contract.symbol || !Number.isFinite(result.retrievedAt) || result.retrievedAt <= 0 || result.retrievedAt > Date.now() || result.requestedTo > to || result.timestampUnit !== "ms") return null;
    if (!allowOlder && chartCacheKey(provider, symbol, timeframe, to, count) !== chartCacheKey(provider, result.symbol, timeframe, result.requestedTo, result.requestedCount)) return null;
    const bars = normalizeChartBars(result.bars), range = chartHistoryRange(result.requestedTo, result.requestedCount, timeframe);
    if (!bars.length || result.sourceTimestamp !== bars.at(-1)?.t || result.requestedFrom !== range.from || result.gapCount !== range.expected - bars.length || bars.some(bar => bar.t < range.from || bar.t >= result.requestedTo || alignToTimeframe(bar.t, timeframe) !== bar.t) || result.volumeUnit !== (provider === "gateio" ? "contracts" : "base")) return null;
    return { ...result, bars, cache: "disk", dataStatus: "STALE" };
  } catch { return null; }
}

export async function cachedChartHistory(provider: string, symbol: string, timeframe: Timeframe, to: number, count: number, allowOlder = false): Promise<BarsResult | null> {
  if (!isBrowser()) return null;
  try {
    const db = await getDB(), key = chartCacheKey(provider, symbol, timeframe, to, count);
    const results = await new Promise<BarsResult[]>((resolve, reject) => {
      const tx = db.transaction(HISTORY_STORE, "readonly"), store = tx.objectStore(HISTORY_STORE);
      const request = allowOlder ? store.getAll() : store.get(key);
      tx.oncomplete = () => resolve(allowOlder ? request.result : [request.result]);
      tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
    });
    for (const result of results.filter(Boolean).sort((a, b) => b.requestedTo - a.requestedTo)) {
      const restored = restoreCachedChartHistory(result, provider, symbol, timeframe, to, count, allowOlder);
      if (restored) return restored;
    }
    return null;
  } catch { return null; }
}
