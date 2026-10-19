import { TIMEFRAME_SECONDS, type Timeframe } from "./types";
import { alignToTimeframe } from "./session";
import type { Bar } from "./types";

function isRenderableBar(value: unknown): value is Bar {
  if (!value || typeof value !== "object") return false;
  const bar = value as Partial<Bar>;
  return [bar.t, bar.o, bar.h, bar.l, bar.c, bar.v].every((field) => typeof field === "number" && Number.isFinite(field)) && Number.isSafeInteger(bar.t) && bar.t! >= 0 && Math.min(bar.o!, bar.h!, bar.l!, bar.c!) > 0 && bar.v! >= 0 && bar.h! >= Math.max(bar.o!, bar.c!) && bar.l! <= Math.min(bar.o!, bar.c!);
}

/** Validate and canonicalize provider bars before passing them to Lightweight Charts. */
export function normalizeChartBars(value: unknown): Bar[] {
  if (!Array.isArray(value)) throw new Error("invalid historical data");
  const byTime = new Map<number, Bar>();
  for (const candidate of value) {
    if (!isRenderableBar(candidate)) throw new Error("invalid historical OHLCV candle");
    byTime.set(candidate.t, candidate);
  }
  return [...byTime.values()].sort((a, b) => a.t - b.t);
}

/** Chart cutoff is exclusive by candle OPEN, not a research closed-candle end. */
export function chartHistoryRange(to: number, count: number, timeframe: Timeframe) {
  if (!Number.isSafeInteger(to) || to <= 0 || !Number.isInteger(count) || count < 1 || count > 1000) throw new Error("Invalid historical cutoff or count");
  const interval = TIMEFRAME_SECONDS[timeframe] * 1000;
  const lastOpen = alignToTimeframe(to - 1, timeframe);
  if (lastOpen < 0) throw new Error("Historical cutoff precedes the first supported UTC bucket");
  const firstBucket = alignToTimeframe(0, timeframe);
  const from = Math.max(firstBucket < 0 ? firstBucket + interval : firstBucket, lastOpen - (count - 1) * interval);
  return { from, to, lastOpen, expected: (lastOpen - from) / interval + 1 };
}

/** Prepend only older observations; never replace current/live candles with a page. */
export function prependChartHistory(current: Bar[], older: Bar[]): Bar[] {
  if (current.length && older.some(bar => bar.t >= current[0].t)) throw new Error("Historical page overlaps current candles");
  return normalizeChartBars([...older, ...current]);
}
