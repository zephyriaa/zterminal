export type PublicOrderFlowProvider = "gateio" | "binance_usdm" | "bybit_linear";

/** A public exchange trade whose taker side is reported by the venue, never inferred from price movement. */
export type SignedPublicTrade = {
  provider: PublicOrderFlowProvider;
  symbol: string;
  id: string;
  price: number;
  signedSize: number;
  timestamp: number;
  isInternal: boolean | null;
};

export type GatePublicTrade = SignedPublicTrade & {
  provider: "gateio";
};

export type DepthLevel = {
  price: number;
  size: number;
};

export type GateOrderBookSnapshot = {
  provider: "gateio";
  symbol: string;
  id: number;
  timestamp: number | null;
  bids: DepthLevel[];
  asks: DepthLevel[];
};

export type GateOrderBookUpdate = {
  provider: "gateio";
  symbol: string;
  firstUpdateId: number;
  lastUpdateId: number;
  timestamp: number | null;
  bids: DepthLevel[];
  asks: DepthLevel[];
};

export type CumulativeVolumeDeltaPoint = {
  timestamp: number;
  value: number;
  tradeId: string;
};

export type TimeAndSalesRow = {
  tradeId: string;
  timestamp: number;
  price: number;
  size: number;
  side: "BUY" | "SELL";
};

export type LargeTapePrint = TimeAndSalesRow & {
  provider: PublicOrderFlowProvider;
  symbol: string;
  minimumReportedSize: number;
};

export type FootprintLevel = {
  price: number;
  buySize: number;
  sellSize: number;
  delta: number;
  tradeCount: number;
};

export type LiveTapeBucket = {
  start: number;
  end: number;
  buySize: number;
  sellSize: number;
  delta: number;
  tradeCount: number;
};

export type DepthImbalanceSummary = {
  bidSize: number;
  askSize: number;
  net: number;
  ratio: number | null;
  state: "BID_HEAVY" | "ASK_HEAVY" | "BALANCED" | "EMPTY";
};

function finiteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function nonEmptyString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function timestampMs(record: Record<string, unknown>): number | null {
  const milliseconds = finiteNumber(record.create_time_ms ?? record.t ?? record.time_ms);
  if (milliseconds !== null && milliseconds >= 0) return milliseconds;
  const seconds = finiteNumber(record.create_time ?? record.time);
  return seconds !== null && seconds >= 0 ? seconds * 1_000 : null;
}

function normalizeSymbol(value: unknown): string | null {
  const symbol = nonEmptyString(value)?.toUpperCase() ?? null;
  return symbol && /^[A-Z0-9]+_USDT$/.test(symbol) ? symbol : null;
}

/** Normalizes Gate.io’s public `futures.trades` record without inferring a side from price movement. */
export function normalizeGatePublicTrade(value: unknown): GatePublicTrade | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const symbol = normalizeSymbol(record.contract);
  const id = nonEmptyString(record.id);
  const price = finiteNumber(record.price);
  const signedSize = finiteNumber(record.size);
  const timestamp = timestampMs(record);
  if (!symbol || !id || price === null || price <= 0 || signedSize === null || signedSize === 0 || timestamp === null) return null;
  return {
    provider: "gateio",
    symbol,
    id,
    price,
    signedSize,
    timestamp,
    isInternal: typeof record.is_internal === "boolean" ? record.is_internal : null,
  };
}

/** Deduplicates exchange trade IDs by provider/symbol and preserves deterministic timestamp/id order. */
export function orderPublicTrades<T extends SignedPublicTrade>(trades: T[]): T[] {
  const unique = new Map<string, T>();
  for (const trade of trades) {
    const key = `${trade.provider}:${trade.symbol}:${trade.id}`;
    if (!unique.has(key)) unique.set(key, trade);
  }
  return Array.from(unique.values()).sort((left, right) => left.timestamp - right.timestamp || left.id.localeCompare(right.id));
}

/** Gate-compatible name retained for the existing verified adapter. */
export function orderGatePublicTrades(trades: GatePublicTrade[]): GatePublicTrade[] {
  return orderPublicTrades(trades);
}

/** Normalizes raw Gate payloads, then deduplicates exchange trade IDs deterministically. */
export function normalizeGatePublicTrades(values: unknown[]): GatePublicTrade[] {
  const normalized: GatePublicTrade[] = [];
  for (const value of values) {
    const trade = normalizeGatePublicTrade(value);
    if (trade) normalized.push(trade);
  }
  return orderGatePublicTrades(normalized);
}

/** Calculates exchange-reported taker-signed CVD only from normalized public trade events. */
export function calculateCvd(trades: SignedPublicTrade[]): CumulativeVolumeDeltaPoint[] {
  let value = 0;
  return orderPublicTrades(trades).map(trade => {
    value += trade.signedSize;
    return { timestamp: trade.timestamp, value, tradeId: trade.id };
  });
}

/** Presents a bounded exchange-reported tape as Time & Sales without inferred trade direction. */
export function toTimeAndSales(trades: SignedPublicTrade[]): TimeAndSalesRow[] {
  return orderPublicTrades(trades).map(trade => ({
    tradeId: trade.id,
    timestamp: trade.timestamp,
    price: trade.price,
    size: Math.abs(trade.signedSize),
    side: trade.signedSize > 0 ? "BUY" : "SELL",
  }));
}

/** Filters current selected-venue tape by exchange-reported contract size. It is not dollar notional, historical tape, or a trade signal. */
export function findLargeTapePrints(trades: SignedPublicTrade[], minimumReportedSize: number): LargeTapePrint[] {
  if (!Number.isFinite(minimumReportedSize) || minimumReportedSize <= 0) return [];
  return orderPublicTrades(trades)
    .filter(trade => Math.abs(trade.signedSize) >= minimumReportedSize)
    .map(trade => ({ provider: trade.provider, symbol: trade.symbol, tradeId: trade.id, timestamp: trade.timestamp, price: trade.price, size: Math.abs(trade.signedSize), side: trade.signedSize > 0 ? "BUY" : "SELL", minimumReportedSize }));
}

/** Aggregates only the bounded live tape by exact exchange trade price; it is not candle-based footprint. */
export function calculateLiveTapeFootprint(trades: SignedPublicTrade[]): FootprintLevel[] {
  const levels = new Map<number, Omit<FootprintLevel, "price" | "delta">>();
  for (const trade of orderPublicTrades(trades)) {
    const current = levels.get(trade.price) ?? { buySize: 0, sellSize: 0, tradeCount: 0 };
    if (trade.signedSize > 0) current.buySize += trade.signedSize;
    else current.sellSize += Math.abs(trade.signedSize);
    current.tradeCount += 1;
    levels.set(trade.price, current);
  }
  return Array.from(levels.entries())
    .map(([price, level]) => ({ price, ...level, delta: level.buySize - level.sellSize }))
    .sort((left, right) => right.price - left.price);
}

/** Buckets only the current bounded public tape; bucket signs preserve exchange-reported taker direction. */
export function calculateLiveTapeBuckets(trades: SignedPublicTrade[], bucketMs = 30_000): LiveTapeBucket[] {
  if (!Number.isInteger(bucketMs) || bucketMs <= 0) return [];
  const buckets = new Map<number, Omit<LiveTapeBucket, "start" | "end" | "delta">>();
  for (const trade of orderPublicTrades(trades)) {
    const start = Math.floor(trade.timestamp / bucketMs) * bucketMs;
    const current = buckets.get(start) ?? { buySize: 0, sellSize: 0, tradeCount: 0 };
    if (trade.signedSize > 0) current.buySize += trade.signedSize;
    else current.sellSize += Math.abs(trade.signedSize);
    current.tradeCount += 1;
    buckets.set(start, current);
  }
  return Array.from(buckets.entries()).map(([start, bucket]) => ({ start, end: start + bucketMs, ...bucket, delta: bucket.buySize - bucket.sellSize })).sort((left, right) => left.start - right.start);
}

/** Summarizes currently reconciled top-of-book depth without implying executable liquidity or a future price direction. */
export function summarizeDepthImbalance(bids: DepthLevel[], asks: DepthLevel[]): DepthImbalanceSummary {
  const bidSize = bids.reduce((sum, level) => sum + (Number.isFinite(level.size) && level.size > 0 ? level.size : 0), 0);
  const askSize = asks.reduce((sum, level) => sum + (Number.isFinite(level.size) && level.size > 0 ? level.size : 0), 0);
  const total = bidSize + askSize;
  if (!total) return { bidSize, askSize, net: 0, ratio: null, state: "EMPTY" };
  const ratio = (bidSize - askSize) / total;
  return { bidSize, askSize, net: bidSize - askSize, ratio, state: ratio >= 0.15 ? "BID_HEAVY" : ratio <= -0.15 ? "ASK_HEAVY" : "BALANCED" };
}

function normalizeDepthLevels(value: unknown): DepthLevel[] | null {
  if (!Array.isArray(value)) return null;
  const seen = new Map<number, number>();
  for (const rawLevel of value) {
    if (!rawLevel || typeof rawLevel !== "object") return null;
    const level = rawLevel as Record<string, unknown>;
    const price = finiteNumber(level.p ?? level.price);
    const size = finiteNumber(level.s ?? level.size);
    if (price === null || price <= 0 || size === null || size < 0) return null;
    seen.set(price, size);
  }
  return Array.from(seen.entries()).map(([price, size]) => ({ price, size }));
}

function orderBookTimestamp(record: Record<string, unknown>): number | null {
  const value = finiteNumber(record.t ?? record.time_ms ?? record.time);
  return value !== null && value >= 0 ? value : null;
}

/** Normalizes a REST `with_id=true` snapshot or equivalent Gate full-depth event. */
export function normalizeGateOrderBookSnapshot(value: unknown, fallbackSymbol?: string): GateOrderBookSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const symbol = normalizeSymbol(record.contract ?? record.s ?? fallbackSymbol);
  const id = finiteNumber(record.id);
  const bids = normalizeDepthLevels(record.bids ?? record.b);
  const asks = normalizeDepthLevels(record.asks ?? record.a);
  if (!symbol || id === null || !Number.isInteger(id) || id < 0 || bids === null || asks === null) return null;
  return { provider: "gateio", symbol, id, timestamp: orderBookTimestamp(record), bids, asks };
}

/** Normalizes an incremental `futures.order_book_update` event that carries update-ID bounds. */
export function normalizeGateOrderBookUpdate(value: unknown, fallbackSymbol?: string): GateOrderBookUpdate | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const symbol = normalizeSymbol(record.s ?? record.contract ?? fallbackSymbol);
  const firstUpdateId = finiteNumber(record.U);
  const lastUpdateId = finiteNumber(record.u);
  const bids = normalizeDepthLevels(record.b ?? record.bids);
  const asks = normalizeDepthLevels(record.a ?? record.asks);
  if (!symbol || firstUpdateId === null || lastUpdateId === null || !Number.isInteger(firstUpdateId) || !Number.isInteger(lastUpdateId) || firstUpdateId < 0 || lastUpdateId < firstUpdateId || bids === null || asks === null) return null;
  return { provider: "gateio", symbol, firstUpdateId, lastUpdateId, timestamp: orderBookTimestamp(record), bids, asks };
}

/** Finds the first buffered delta that contains the update immediately after a REST snapshot. */
export function reconciliationStartIndex(snapshotId: number, updates: GateOrderBookUpdate[]): number | null {
  const expected = snapshotId + 1;
  const index = updates.findIndex(update => update.firstUpdateId <= expected && update.lastUpdateId >= expected);
  return index === -1 ? null : index;
}

/** Applies absolute Gate depth levels and rejects an update sequence gap instead of inventing a book. */
export function reconcileGateOrderBook(snapshot: GateOrderBookSnapshot, updates: GateOrderBookUpdate[]): { bids: DepthLevel[]; asks: DepthLevel[]; lastUpdateId: number } | null {
  const start = reconciliationStartIndex(snapshot.id, updates);
  if (start === null) return null;
  const bids = new Map(snapshot.bids.map(level => [level.price, level.size]));
  const asks = new Map(snapshot.asks.map(level => [level.price, level.size]));
  let lastUpdateId = snapshot.id;
  for (const update of updates.slice(start)) {
    if (update.symbol !== snapshot.symbol || update.firstUpdateId > lastUpdateId + 1 || update.lastUpdateId < lastUpdateId + 1) return null;
    for (const level of update.bids) level.size === 0 ? bids.delete(level.price) : bids.set(level.price, level.size);
    for (const level of update.asks) level.size === 0 ? asks.delete(level.price) : asks.set(level.price, level.size);
    lastUpdateId = update.lastUpdateId;
  }
  return {
    bids: Array.from(bids.entries()).map(([price, size]) => ({ price, size })).sort((left, right) => right.price - left.price),
    asks: Array.from(asks.entries()).map(([price, size]) => ({ price, size })).sort((left, right) => left.price - right.price),
    lastUpdateId,
  };
}
