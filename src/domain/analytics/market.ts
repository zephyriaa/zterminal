import type { Bar } from "@/lib/market/types";
import type { MarketRegimeKind } from "@/domain/models";

export interface SessionVwapPoint {
  timestamp: number;
  vwap: number;
  deviation: number;
}

export interface OpeningRange {
  start: number;
  end: number;
  high: number;
  low: number;
  complete: boolean;
}

export interface VolumeProfileLevel {
  price: number;
  volume: number;
}

export interface VolumeProfile {
  pointOfControl: number | null;
  valueAreaHigh: number | null;
  valueAreaLow: number | null;
  levels: VolumeProfileLevel[];
}

export interface VolatilitySnapshot {
  atr: number | null;
  realizedVolatility: number | null;
}

export interface RegimeSnapshot {
  kind: MarketRegimeKind;
  confidence: number;
  reasons: string[];
}

function assertBars(bars: readonly Bar[]) {
  for (let index = 0; index < bars.length; index += 1) {
    const bar = bars[index];
    if (![bar.t, bar.o, bar.h, bar.l, bar.c, bar.v].every(Number.isFinite)) {
      throw new Error(`Bar ${index} contains a non-finite field.`);
    }
    if (bar.h < Math.max(bar.o, bar.c) || bar.l > Math.min(bar.o, bar.c) || bar.h < bar.l || bar.v < 0) {
      throw new Error(`Bar ${index} violates OHLCV invariants.`);
    }
    if (index > 0 && bar.t <= bars[index - 1].t) {
      throw new Error("Bars must be ordered by strictly increasing UTC open timestamp.");
    }
  }
}

/** Session reset is caller-controlled so exchange calendar/timezone policy stays explicit. */
export function computeSessionVwap(
  bars: readonly Bar[],
  sessionKey: (bar: Bar) => string,
): SessionVwapPoint[] {
  assertBars(bars);
  let currentSession: string | undefined;
  let cumulativePriceVolume = 0;
  let cumulativeVolume = 0;

  return bars.map((bar) => {
    const key = sessionKey(bar);
    if (key !== currentSession) {
      currentSession = key;
      cumulativePriceVolume = 0;
      cumulativeVolume = 0;
    }
    const typicalPrice = (bar.h + bar.l + bar.c) / 3;
    cumulativePriceVolume += typicalPrice * bar.v;
    cumulativeVolume += bar.v;
    const vwap = cumulativeVolume > 0 ? cumulativePriceVolume / cumulativeVolume : bar.c;
    return { timestamp: bar.t, vwap, deviation: bar.c - vwap };
  });
}

/** Calculates a fixed opening range; no implicit timezone conversion occurs. */
export function computeOpeningRange(
  bars: readonly Bar[],
  start: number,
  end: number,
): OpeningRange {
  assertBars(bars);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    throw new Error("Opening range end must be a finite UTC timestamp after start.");
  }
  const relevant = bars.filter((bar) => bar.t >= start && bar.t < end);
  return {
    start,
    end,
    high: relevant.length ? Math.max(...relevant.map((bar) => bar.h)) : Number.NaN,
    low: relevant.length ? Math.min(...relevant.map((bar) => bar.l)) : Number.NaN,
    complete: relevant.length > 0 && bars.some((bar) => bar.t >= end),
  };
}

/** Approximates bar volume at its typical price, suitable only for OHLCV-level profiles. */
export function buildVolumeProfile(
  bars: readonly Bar[],
  tickSize: number,
  valueAreaFraction = 0.7,
): VolumeProfile {
  assertBars(bars);
  if (!Number.isFinite(tickSize) || tickSize <= 0) throw new Error("Tick size must be positive.");
  if (!Number.isFinite(valueAreaFraction) || valueAreaFraction <= 0 || valueAreaFraction > 1) {
    throw new Error("Value-area fraction must be within (0, 1].");
  }
  const byPrice = new Map<number, number>();
  for (const bar of bars) {
    const price = Math.round(((bar.h + bar.l + bar.c) / 3) / tickSize) * tickSize;
    byPrice.set(price, (byPrice.get(price) ?? 0) + bar.v);
  }
  const levels = [...byPrice.entries()]
    .map(([price, volume]) => ({ price, volume }))
    .sort((left, right) => left.price - right.price);
  if (!levels.length) return { pointOfControl: null, valueAreaHigh: null, valueAreaLow: null, levels };

  const pocIndex = levels.reduce((best, level, index) => level.volume > levels[best].volume ? index : best, 0);
  const totalVolume = levels.reduce((sum, level) => sum + level.volume, 0);
  let accumulated = levels[pocIndex].volume;
  let lowIndex = pocIndex;
  let highIndex = pocIndex;
  while (accumulated < totalVolume * valueAreaFraction && (lowIndex > 0 || highIndex < levels.length - 1)) {
    const lowerVolume = lowIndex > 0 ? levels[lowIndex - 1].volume : -1;
    const upperVolume = highIndex < levels.length - 1 ? levels[highIndex + 1].volume : -1;
    if (upperVolume > lowerVolume) {
      highIndex += 1;
      accumulated += levels[highIndex].volume;
    } else {
      lowIndex -= 1;
      accumulated += levels[lowIndex].volume;
    }
  }
  return {
    pointOfControl: levels[pocIndex].price,
    valueAreaHigh: levels[highIndex].price,
    valueAreaLow: levels[lowIndex].price,
    levels,
  };
}

export function calculateVolatility(bars: readonly Bar[], period: number): VolatilitySnapshot {
  assertBars(bars);
  if (!Number.isInteger(period) || period < 2) throw new Error("Volatility period must be an integer of at least two.");
  if (bars.length < period) return { atr: null, realizedVolatility: null };
  const subset = bars.slice(-period);
  const trueRanges = subset.map((bar, index) => {
    const previousClose = index === 0 ? bar.o : subset[index - 1].c;
    return Math.max(bar.h - bar.l, Math.abs(bar.h - previousClose), Math.abs(bar.l - previousClose));
  });
  const atr = trueRanges.reduce((sum, value) => sum + value, 0) / trueRanges.length;
  const returns = subset.slice(1).map((bar, index) => Math.log(bar.c / subset[index].c));
  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const variance = returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / returns.length;
  return { atr, realizedVolatility: Math.sqrt(variance) };
}

/**
 * A transparent, deliberately simple classifier. Thresholds are supplied by the caller,
 * making the regime policy testable and avoiding hidden magic constants.
 */
export function classifyRegime(
  bars: readonly Bar[],
  options: { lookback: number; trendThreshold: number; compressionThreshold: number },
): RegimeSnapshot {
  assertBars(bars);
  const { lookback, trendThreshold, compressionThreshold } = options;
  if (!Number.isInteger(lookback) || lookback < 3 || bars.length < lookback) {
    return { kind: "unknown", confidence: 0, reasons: ["Insufficient ordered bars for the selected regime lookback."] };
  }
  const sample = bars.slice(-lookback);
  const first = sample[0].c;
  const last = sample.at(-1)!.c;
  const normalizedMove = Math.abs(last - first) / Math.max(Math.abs(first), Number.EPSILON);
  const { realizedVolatility } = calculateVolatility(sample, sample.length);
  const reasons = [`Normalized close movement: ${normalizedMove.toFixed(6)}.`, `Realized volatility: ${(realizedVolatility ?? 0).toFixed(6)}.`];
  if (normalizedMove >= trendThreshold) {
    return { kind: "trend", confidence: Math.min(1, normalizedMove / (trendThreshold * 2)), reasons };
  }
  if ((realizedVolatility ?? 0) <= compressionThreshold) {
    return { kind: "compression", confidence: Math.min(1, 1 - (realizedVolatility ?? 0) / compressionThreshold), reasons };
  }
  if ((realizedVolatility ?? 0) >= compressionThreshold * 3) {
    return { kind: "high_volatility", confidence: Math.min(1, (realizedVolatility ?? 0) / (compressionThreshold * 6)), reasons };
  }
  return { kind: "balance", confidence: Math.max(0, 1 - normalizedMove / trendThreshold), reasons };
}
