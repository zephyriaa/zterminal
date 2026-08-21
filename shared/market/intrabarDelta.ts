import type { MarketInterval } from "../../server/marketContracts";
import { MARKET_INTERVAL_MS } from "../../server/marketContracts";

export type IntrabarCandle = { t: number; o: number; h: number; l: number; c: number; v: number };
export type IntrabarDeltaPoint = { t: number; delta: number; cumulativeDelta: number; intrabarCount: number };

export const INTRABAR_DELTA_METHOD = "INTRABAR_CANDLE_DIRECTION_ESTIMATE" as const;

export function selectIntrabarInterval(chartInterval: MarketInterval): MarketInterval | null {
  if (chartInterval === "1m") return null;
  if (chartInterval === "5m" || chartInterval === "15m") return "1m";
  if (chartInterval === "30m" || chartInterval === "1h") return "5m";
  return "15m";
}

export function requiredIntervalBars(from: number, to: number, interval: MarketInterval) {
  if (!Number.isFinite(from) || !Number.isFinite(to) || from > to) return 0;
  return Math.floor((to - from) / MARKET_INTERVAL_MS[interval]) + 1;
}

export function hasCompleteIntrabarSequence(bars: IntrabarCandle[], from: number, to: number, interval: MarketInterval) {
  const expected = requiredIntervalBars(from, to, interval);
  if (!expected || bars.length !== expected) return false;
  return bars.every((bar, index) => bar.t === from + index * MARKET_INTERVAL_MS[interval]);
}

/**
 * Aggregates complete lower-timeframe OHLCV candles into a chart-timeframe directional-volume estimate.
 * This is not trade-signed volume: an intrabar close above/open below contributes positive/negative volume,
 * while a flat intrabar contributes zero. Callers must expose the method and coverage with the result.
 */
export function calculateIntrabarDelta(input: { bars: IntrabarCandle[]; chartInterval: MarketInterval; from: number; to: number }): IntrabarDeltaPoint[] {
  const { bars, chartInterval, from, to } = input;
  const chartMs = MARKET_INTERVAL_MS[chartInterval];
  const grouped = new Map<number, { delta: number; intrabarCount: number }>();
  for (const bar of bars) {
    if (bar.t < from || bar.t > to || !Number.isFinite(bar.v)) continue;
    const bucket = Math.floor(bar.t / chartMs) * chartMs;
    const current = grouped.get(bucket) ?? { delta: 0, intrabarCount: 0 };
    const sign = bar.c > bar.o ? 1 : bar.c < bar.o ? -1 : 0;
    current.delta += sign * bar.v;
    current.intrabarCount += 1;
    grouped.set(bucket, current);
  }

  let cumulativeDelta = 0;
  const points: IntrabarDeltaPoint[] = [];
  for (let timestamp = from; timestamp <= to; timestamp += chartMs) {
    const point = grouped.get(timestamp);
    if (!point) continue;
    cumulativeDelta += point.delta;
    points.push({ t: timestamp, delta: point.delta, cumulativeDelta, intrabarCount: point.intrabarCount });
  }
  return points;
}
