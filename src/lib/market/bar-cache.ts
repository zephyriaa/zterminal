"use client";

import type { Bar, Timeframe } from "./types";

const DB_NAME = "zterminal-market-cache-v1";
const DB_VERSION = 1;
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
        if (!db.objectStoreNames.contains(BARS_STORE)) {
          const barsStore = db.createObjectStore(BARS_STORE, { keyPath: "key" });
          barsStore.createIndex("by_series_time", ["symbol", "timeframe", "t"], { unique: true });
        }
        if (!db.objectStoreNames.contains(DATASETS_STORE)) {
          db.createObjectStore(DATASETS_STORE, { keyPath: "id" });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
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
