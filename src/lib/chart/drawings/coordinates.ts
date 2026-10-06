import type { DrawingAnchor } from "../contracts";
import type { ScreenPoint } from "./contracts";

export interface DrawingCoordinates {
  project(anchor: DrawingAnchor): ScreenPoint | null;
  unproject(point: ScreenPoint): DrawingAnchor | null;
}

/** Interpolate through actual timestamps; extrapolate only using available bars. */
export function timeToLogical(times: readonly number[], time: number, interval: number) {
  if (!times.length) return null;
  if (time <= times[0]) return (time - times[0]) / interval;
  const last = times.length - 1;
  if (time >= times[last]) return last + (time - times[last]) / interval;
  let low = 0, high = last;
  while (high - low > 1) {
    const middle = (low + high) >>> 1;
    if (times[middle] <= time) low = middle; else high = middle;
  }
  return low + (time - times[low]) / (times[high] - times[low]);
}

export function logicalToTime(times: readonly number[], logical: number, interval: number) {
  if (!times.length) return null;
  const last = times.length - 1;
  if (logical <= 0) return times[0] + logical * interval;
  if (logical >= last) return times[last] + (logical - last) * interval;
  const low = Math.floor(logical);
  return times[low] + (times[low + 1] - times[low]) * (logical - low);
}
