import type { DepthLevel, DerivativesEvent, TradeEvent } from "./types";

/** Every UI metric and event produced by this module should disclose this identifier. */
export const ORDER_FLOW_CALCULATION_VERSION = "p0.1.0";

export type TradeSideFilter = "buy" | "sell" | "all";

export type TradeTapeOptions = {
  side?: TradeSideFilter;
  minimumQuantity?: number;
  minimumNotional?: number;
  aggregationWindowMs?: number;
};

export type TapeRow = {
  timestamp: number;
  side: "buy" | "sell";
  price: number;
  quantity: number;
  notional: number;
  count: number;
  firstSequence?: number;
  lastSequence?: number;
};

export type DeltaBucket = {
  timestamp: number;
  endTimestamp: number;
  buyVolume: number;
  sellVolume: number;
  delta: number;
  tradeCount: number;
};

export type CVDPoint = DeltaBucket & {
  value: number;
};

export type FootprintLevel = {
  price: number;
  buyVolume: number;
  sellVolume: number;
  delta: number;
  totalVolume: number;
  tradeCount: number;
};

export type FootprintBucket = DeltaBucket & {
  levels: FootprintLevel[];
};

export type BookImbalance = {
  value: number | null;
  bidDepth: number;
  askDepth: number;
  window: number;
};

export type Microprice = {
  value: number | null;
  bestBid?: { price: number; size: number };
  bestAsk?: { price: number; size: number };
};

export type OpenInterestChange = {
  value: number | null;
  percent: number | null;
  current: number | null;
  baseline: number | null;
  status: "live" | "unavailable";
};

export type ResearchEvent = {
  id: string;
  kind: "sweep-candidate" | "absorption-candidate";
  side: "buy" | "sell";
  timestamp: number;
  summary: string;
  source: {
    providerSequences: number[];
    tradeCount: number;
    rollingWindow: { from: number; to: number; milliseconds: number };
  };
  thresholds: Record<string, number>;
  calculationVersion: string;
  metrics: { buyVolume: number; sellVolume: number; delta: number; priceRange: number; notional: number };
};

export type ResearchEventOptions = {
  now?: number;
  windowMs?: number;
  minimumVolume?: number;
  dominance?: number;
  minimumLevels?: number;
  maxAbsorptionRangeTicks?: number;
  tickSize: number;
};

function chronological(trades: readonly TradeEvent[]) {
  return [...trades].sort((a, b) => a.timestamp - b.timestamp || (a.sequence ?? 0) - (b.sequence ?? 0));
}

function quantity(trade: TradeEvent) {
  return Number.isFinite(trade.quantity) && trade.quantity > 0 ? trade.quantity : 0;
}

function stablePriceBin(price: number, tickSize: number) {
  if (!Number.isFinite(price) || !Number.isFinite(tickSize) || tickSize <= 0) return price;
  const decimals = Math.max(0, Math.min(12, Math.ceil(-Math.log10(tickSize)) + 2));
  return Number((Math.round(price / tickSize) * tickSize).toFixed(decimals));
}

/**
 * Filters exchange-reported aggressive trade prints and can aggregate rows by
 * time, price, and side. No trade direction is inferred in this layer.
 */
export function buildTradeTape(trades: readonly TradeEvent[], options: TradeTapeOptions = {}): TapeRow[] {
  const side = options.side ?? "all";
  const minimumQuantity = Math.max(0, options.minimumQuantity ?? 0);
  const minimumNotional = Math.max(0, options.minimumNotional ?? 0);
  const aggregationWindowMs = Math.max(0, options.aggregationWindowMs ?? 0);
  const rows = chronological(trades)
    .filter((trade) => (side === "all" || trade.side === side) && quantity(trade) >= minimumQuantity && trade.price * quantity(trade) >= minimumNotional);

  if (!aggregationWindowMs) {
    return rows.map((trade) => ({
      timestamp: trade.timestamp,
      side: trade.side,
      price: trade.price,
      quantity: quantity(trade),
      notional: trade.price * quantity(trade),
      count: 1,
      firstSequence: trade.sequence,
      lastSequence: trade.sequence,
    }));
  }

  const grouped = new Map<string, TapeRow>();
  for (const trade of rows) {
    const timestamp = Math.floor(trade.timestamp / aggregationWindowMs) * aggregationWindowMs;
    const key = `${timestamp}:${trade.side}:${trade.price}`;
    const prior = grouped.get(key);
    if (prior) {
      prior.quantity += quantity(trade);
      prior.notional += trade.price * quantity(trade);
      prior.count += 1;
      prior.lastSequence = trade.sequence;
    } else {
      grouped.set(key, {
        timestamp,
        side: trade.side,
        price: trade.price,
        quantity: quantity(trade),
        notional: trade.price * quantity(trade),
        count: 1,
        firstSequence: trade.sequence,
        lastSequence: trade.sequence,
      });
    }
  }
  return [...grouped.values()].sort((a, b) => a.timestamp - b.timestamp || a.price - b.price || a.side.localeCompare(b.side));
}

/** Returns buy volume minus sell volume in deterministic fixed-width time buckets. */
export function calculateDeltaBuckets(trades: readonly TradeEvent[], bucketMs = 1_000): DeltaBucket[] {
  const windowMs = Math.max(1, Math.floor(bucketMs));
  const buckets = new Map<number, DeltaBucket>();
  for (const trade of chronological(trades)) {
    const timestamp = Math.floor(trade.timestamp / windowMs) * windowMs;
    const bucket = buckets.get(timestamp) ?? {
      timestamp,
      endTimestamp: timestamp + windowMs,
      buyVolume: 0,
      sellVolume: 0,
      delta: 0,
      tradeCount: 0,
    };
    if (trade.side === "buy") bucket.buyVolume += quantity(trade);
    else bucket.sellVolume += quantity(trade);
    bucket.delta = bucket.buyVolume - bucket.sellVolume;
    bucket.tradeCount += 1;
    buckets.set(timestamp, bucket);
  }
  return [...buckets.values()].sort((a, b) => a.timestamp - b.timestamp);
}

/** Running CVD seeded at `startValue`, using only observed trade sides and quantities. */
export function calculateCVD(trades: readonly TradeEvent[], bucketMs = 1_000, startValue = 0): CVDPoint[] {
  let value = startValue;
  return calculateDeltaBuckets(trades, bucketMs).map((bucket) => {
    value += bucket.delta;
    return { ...bucket, value };
  });
}

/**
 * Aggregates buy/sell volume by both time bucket and tick-rounded price level.
 * The result is suitable for a footprint sub-panel; it never fills missing
 * price levels with zero-volume synthetic prints.
 */
export function buildFootprint(trades: readonly TradeEvent[], tickSize: number, bucketMs = 60_000): FootprintBucket[] {
  const windowMs = Math.max(1, Math.floor(bucketMs));
  const buckets = new Map<number, Map<number, FootprintLevel>>();
  for (const trade of chronological(trades)) {
    const timestamp = Math.floor(trade.timestamp / windowMs) * windowMs;
    const price = stablePriceBin(trade.price, tickSize);
    const levels = buckets.get(timestamp) ?? new Map<number, FootprintLevel>();
    const level = levels.get(price) ?? { price, buyVolume: 0, sellVolume: 0, delta: 0, totalVolume: 0, tradeCount: 0 };
    if (trade.side === "buy") level.buyVolume += quantity(trade);
    else level.sellVolume += quantity(trade);
    level.delta = level.buyVolume - level.sellVolume;
    level.totalVolume = level.buyVolume + level.sellVolume;
    level.tradeCount += 1;
    levels.set(price, level);
    buckets.set(timestamp, levels);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a - b)
    .map(([timestamp, levels]) => {
      const orderedLevels = [...levels.values()].sort((a, b) => b.price - a.price);
      const buyVolume = orderedLevels.reduce((total, level) => total + level.buyVolume, 0);
      const sellVolume = orderedLevels.reduce((total, level) => total + level.sellVolume, 0);
      return {
        timestamp,
        endTimestamp: timestamp + windowMs,
        buyVolume,
        sellVolume,
        delta: buyVolume - sellVolume,
        tradeCount: orderedLevels.reduce((total, level) => total + level.tradeCount, 0),
        levels: orderedLevels,
      };
    });
}

/** `(bid depth - ask depth) / (bid depth + ask depth)` across the requested nearest levels. */
export function calculateBookImbalance(depth: readonly DepthLevel[], window = 5): BookImbalance {
  const levelCount = Math.max(1, Math.floor(window));
  const bids = depth.filter((level) => level.side === "buy").sort((a, b) => b.price - a.price).slice(0, levelCount);
  const asks = depth.filter((level) => level.side === "sell").sort((a, b) => a.price - b.price).slice(0, levelCount);
  const bidDepth = bids.reduce((total, level) => total + Math.max(0, level.size), 0);
  const askDepth = asks.reduce((total, level) => total + Math.max(0, level.size), 0);
  const denominator = bidDepth + askDepth;
  return { value: denominator > 0 ? (bidDepth - askDepth) / denominator : null, bidDepth, askDepth, window: levelCount };
}

/** `ask × bid size/(bid size + ask size) + bid × ask size/(bid size + ask size)` from the top of verified L2. */
export function calculateMicroprice(depth: readonly DepthLevel[]): Microprice {
  const bestBid = depth.filter((level) => level.side === "buy" && level.size > 0).sort((a, b) => b.price - a.price)[0];
  const bestAsk = depth.filter((level) => level.side === "sell" && level.size > 0).sort((a, b) => a.price - b.price)[0];
  if (!bestBid || !bestAsk || bestBid.size + bestAsk.size <= 0) return { value: null };
  return {
    value: bestAsk.price * (bestBid.size / (bestBid.size + bestAsk.size)) + bestBid.price * (bestAsk.size / (bestBid.size + bestAsk.size)),
    bestBid: { price: bestBid.price, size: bestBid.size },
    bestAsk: { price: bestAsk.price, size: bestAsk.size },
  };
}

/** Calculates OI change only where two provider-confirmed OI observations exist. */
export function calculateOpenInterestChange(current: DerivativesEvent | null, baseline: DerivativesEvent | null): OpenInterestChange {
  const currentValue = current?.openInterest;
  const baselineValue = baseline?.openInterest;
  if (current?.openInterestStatus === "unavailable" || !Number.isFinite(currentValue) || !Number.isFinite(baselineValue)) {
    return { value: null, percent: null, current: Number.isFinite(currentValue) ? currentValue! : null, baseline: Number.isFinite(baselineValue) ? baselineValue! : null, status: "unavailable" };
  }
  const value = currentValue! - baselineValue!;
  return { value, percent: baselineValue ? value / baselineValue : null, current: currentValue!, baseline: baselineValue!, status: "live" };
}

/**
 * Labels only transparent, deterministic *candidates*. A sweep requires a
 * dominant-side, multi-level burst. An absorption candidate requires dominant
 * aggressive flow while price stays within a small declared range. These are
 * research prompts, not trading signals or claimed market facts.
 */
export function detectResearchEvents(trades: readonly TradeEvent[], options: ResearchEventOptions): ResearchEvent[] {
  const now = options.now ?? trades.reduce((latest, trade) => Math.max(latest, trade.timestamp), 0);
  const windowMs = Math.max(1, options.windowMs ?? 3_000);
  const minimumVolume = Math.max(0, options.minimumVolume ?? 5);
  const dominance = Math.min(1, Math.max(0.5, options.dominance ?? 0.8));
  const minimumLevels = Math.max(1, Math.floor(options.minimumLevels ?? 3));
  const maxAbsorptionRangeTicks = Math.max(1, options.maxAbsorptionRangeTicks ?? 2);
  const active = chronological(trades).filter((trade) => trade.timestamp >= now - windowMs && trade.timestamp <= now);
  if (!active.length) return [];
  const buyVolume = active.filter((trade) => trade.side === "buy").reduce((sum, trade) => sum + quantity(trade), 0);
  const sellVolume = active.filter((trade) => trade.side === "sell").reduce((sum, trade) => sum + quantity(trade), 0);
  const total = buyVolume + sellVolume;
  if (total < minimumVolume) return [];
  const side: "buy" | "sell" = buyVolume >= sellVolume ? "buy" : "sell";
  const dominantVolume = side === "buy" ? buyVolume : sellVolume;
  if (dominantVolume / total < dominance) return [];
  const prices = active.map((trade) => trade.price);
  const priceRange = Math.max(...prices) - Math.min(...prices);
  const levels = new Set(active.map((trade) => stablePriceBin(trade.price, options.tickSize))).size;
  const delta = buyVolume - sellVolume;
  const notional = active.reduce((sum, trade) => sum + trade.price * quantity(trade), 0);
  const source = {
    providerSequences: active.map((trade) => trade.sequence).filter((sequence): sequence is number => typeof sequence === "number"),
    tradeCount: active.length,
    rollingWindow: { from: now - windowMs, to: now, milliseconds: windowMs },
  };
  const thresholds = { minimumVolume, dominance, minimumLevels, maxAbsorptionRangeTicks, tickSize: options.tickSize };
  const metrics = { buyVolume, sellVolume, delta, priceRange, notional };
  const events: ResearchEvent[] = [];
  if (levels >= minimumLevels) {
    events.push({
      id: `sweep:${now}:${side}:${source.providerSequences.at(-1) ?? active.length}`,
      kind: "sweep-candidate",
      side,
      timestamp: now,
      summary: `${side === "buy" ? "Buy" : "Sell"} sweep candidate across ${levels} price levels`,
      source,
      thresholds,
      calculationVersion: ORDER_FLOW_CALCULATION_VERSION,
      metrics,
    });
  }
  if (priceRange <= options.tickSize * maxAbsorptionRangeTicks) {
    events.push({
      id: `absorption:${now}:${side}:${source.providerSequences.at(-1) ?? active.length}`,
      kind: "absorption-candidate",
      side,
      timestamp: now,
      summary: `${side === "buy" ? "Buy" : "Sell"} absorption candidate within ${priceRange.toFixed(8)} price range`,
      source,
      thresholds,
      calculationVersion: ORDER_FLOW_CALCULATION_VERSION,
      metrics,
    });
  }
  return events;
}

export type CVDDivergenceType =
  | "bullish_regular"
  | "bearish_regular"
  | "bullish_hidden"
  | "bearish_hidden";

export interface CVDDivergenceSignal {
  timestamp: number;
  type: CVDDivergenceType;
  priceAnchorA: number;
  priceAnchorB: number;
  cvdAnchorA: number;
  cvdAnchorB: number;
  description: string;
}

/**
 * Detects divergences between price swings and Cumulative Volume Delta (CVD) swings.
 * High-precision local compute pattern used by institutional order-flow desks.
 */
export function detectCVDDivergences(
  bars: { t: number; h: number; l: number; c: number }[],
  cvd: CVDPoint[],
  lookback = 10,
): CVDDivergenceSignal[] {
  if (bars.length < lookback || cvd.length < lookback) return [];

  const signals: CVDDivergenceSignal[] = [];
  const cvdMap = new Map<number, number>();
  for (const pt of cvd) {
    cvdMap.set(pt.timestamp, pt.value);
  }

  // Iterate rolling swing points
  for (let i = lookback; i < bars.length; i++) {
    const currentBar = bars[i];
    const prevBar = bars[i - Math.floor(lookback / 2)];
    const currentCvd = cvdMap.get(currentBar.t) ?? cvd[Math.min(i, cvd.length - 1)].value;
    const prevCvd = cvdMap.get(prevBar.t) ?? cvd[Math.min(i - Math.floor(lookback / 2), cvd.length - 1)].value;

    // Regular Bullish: Lower Low in price but Higher Low in CVD (Absorption of aggressive selling)
    if (currentBar.l < prevBar.l && currentCvd > prevCvd) {
      signals.push({
        timestamp: currentBar.t,
        type: "bullish_regular",
        priceAnchorA: prevBar.l,
        priceAnchorB: currentBar.l,
        cvdAnchorA: prevCvd,
        cvdAnchorB: currentCvd,
        description: `Regular Bullish Divergence: Price Lower Low (${currentBar.l}) with CVD Higher Low (${currentCvd.toFixed(2)})`,
      });
    }

    // Regular Bearish: Higher High in price but Lower High in CVD (Absorption of aggressive buying)
    if (currentBar.h > prevBar.h && currentCvd < prevCvd) {
      signals.push({
        timestamp: currentBar.t,
        type: "bearish_regular",
        priceAnchorA: prevBar.h,
        priceAnchorB: currentBar.h,
        cvdAnchorA: prevCvd,
        cvdAnchorB: currentCvd,
        description: `Regular Bearish Divergence: Price Higher High (${currentBar.h}) with CVD Lower High (${currentCvd.toFixed(2)})`,
      });
    }
  }

  return signals;
}

export interface DiagonalImbalanceLevel {
  price: number;
  askVolume: number;
  bidVolumeLower: number;
  ratio: number;
  imbalanceSide: "buy_imbalance" | "sell_imbalance" | "neutral";
}

/**
 * Calculates standard diagonal footprint order-flow imbalances across adjacent price tiers.
 * A buy imbalance occurs when Ask at Price P is >= ratio * Bid at Price P - 1 tick.
 */
export function calculateDiagonalImbalances(
  levels: FootprintLevel[],
  ratioThreshold = 3.0,
): DiagonalImbalanceLevel[] {
  if (levels.length < 2) return [];

  const sorted = [...levels].sort((a, b) => a.price - b.price);
  const results: DiagonalImbalanceLevel[] = [];

  for (let i = 1; i < sorted.length; i++) {
    const higher = sorted[i];
    const lower = sorted[i - 1];

    const buyRatio = lower.sellVolume > 0 ? higher.buyVolume / lower.sellVolume : higher.buyVolume > 0 ? 999 : 0;
    const sellRatio = higher.buyVolume > 0 ? lower.sellVolume / higher.buyVolume : lower.sellVolume > 0 ? 999 : 0;

    if (buyRatio >= ratioThreshold) {
      results.push({
        price: higher.price,
        askVolume: higher.buyVolume,
        bidVolumeLower: lower.sellVolume,
        ratio: buyRatio,
        imbalanceSide: "buy_imbalance",
      });
    } else if (sellRatio >= ratioThreshold) {
      results.push({
        price: lower.price,
        askVolume: higher.buyVolume,
        bidVolumeLower: lower.sellVolume,
        ratio: sellRatio,
        imbalanceSide: "sell_imbalance",
      });
    }
  }

  return results;
}

