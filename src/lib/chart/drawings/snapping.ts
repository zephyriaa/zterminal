import type { Bar } from "@/lib/market/types";
import type { DrawingCoordinates } from "./coordinates";
import type { MagnetMode, ScreenPoint } from "./contracts";

export function snapDrawingPoint(point: ScreenPoint, bars: readonly Bar[], mode: MagnetMode, coordinates: DrawingCoordinates) {
  const raw = coordinates.unproject(point);
  if (!raw || mode === "off" || !bars.length) return { anchor: raw, target: null };
  let low = 0, high = bars.length - 1;
  while (high - low > 1) {
    const middle = (low + high) >>> 1;
    if (bars[middle].t <= raw.time) low = middle; else high = middle;
  }
  const candidates = [bars[low], bars[high]];
  let best: { anchor: { time: number; price: number }; target: ScreenPoint; distance: number } | null = null;
  for (const bar of candidates) for (const price of [bar.o, bar.h, bar.l, bar.c]) {
    const anchor = { time: bar.t, price }, target = coordinates.project(anchor);
    if (!target) continue;
    const distance = Math.hypot(target.x - point.x, target.y - point.y);
    if (!best || distance < best.distance) best = { anchor, target, distance };
  }
  if (!best || (mode === "weak" && best.distance > 12)) return { anchor: raw, target: null };
  return { anchor: best.anchor, target: best.target };
}
