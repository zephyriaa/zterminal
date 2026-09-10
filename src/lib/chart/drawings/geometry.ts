import type { DrawingAnchor, DrawingObject } from "../contracts";
import type { ProjectedDrawing, ScreenPoint } from "./contracts";

export function distance(a: ScreenPoint, b: ScreenPoint) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function distanceToSegment(point: ScreenPoint, start: ScreenPoint, end: ScreenPoint) {
  const dx = end.x - start.x, dy = end.y - start.y;
  if (dx === 0 && dy === 0) return distance(point, start);
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy)));
  return distance(point, { x: start.x + t * dx, y: start.y + t * dy });
}

export function drawingHit(projected: ProjectedDrawing, point: ScreenPoint, tolerance = 7) {
  const [a, b = a] = projected.points;
  const type = projected.drawing.type;
  if (["long-position", "short-position"].includes(type)) {
    const c = projected.points[2] ?? b;
    const left = Math.min(a.x, b.x) - tolerance;
    const right = Math.max(a.x, b.x) + tolerance;
    const top = Math.min(a.y, b.y, c.y) - tolerance;
    const bottom = Math.max(a.y, b.y, c.y) + tolerance;
    return point.x >= left && point.x <= right && point.y >= top && point.y <= bottom;
  }
  if (["rectangle", "price-range", "date-range"].includes(type)) {
    const left = Math.min(a.x, b.x), right = Math.max(a.x, b.x), top = Math.min(a.y, b.y), bottom = Math.max(a.y, b.y);
    const inside = point.x >= left - tolerance && point.x <= right + tolerance && point.y >= top - tolerance && point.y <= bottom + tolerance;
    return inside && (Math.min(Math.abs(point.x - left), Math.abs(point.x - right), Math.abs(point.y - top), Math.abs(point.y - bottom)) <= tolerance || type === "price-range");
  }
  if (["horizontal-line", "price-label"].includes(type)) return Math.abs(point.y - a.y) <= tolerance;
  if (type === "vertical-line") return Math.abs(point.x - a.x) <= tolerance;
  if (type === "fibonacci-retracement") {
    const top = Math.min(a.y, b.y), bottom = Math.max(a.y, b.y), left = Math.min(a.x, b.x), right = Math.max(a.x, b.x);
    return point.x >= left - tolerance && point.x <= right + tolerance && [0, .236, .382, .5, .618, .786, 1].some(level => Math.abs(point.y - (a.y + (b.y - a.y) * level)) <= tolerance);
  }
  if (["text"].includes(type)) return distance(point, a) <= 24;
  return distanceToSegment(point, a, b) <= tolerance;
}

export function nearestDrawing(drawings: ProjectedDrawing[], point: ScreenPoint) {
  return [...drawings].reverse().find(item => drawingHit(item, point))?.drawing.id ?? null;
}

export function nearestAnchor(projected: ProjectedDrawing, point: ScreenPoint, tolerance = 9) {
  const index = projected.points.findIndex(anchor => distance(anchor, point) <= tolerance);
  return index < 0 ? null : index;
}

export function moveAnchors(anchors: DrawingAnchor[], from: DrawingAnchor, to: DrawingAnchor): DrawingAnchor[] {
  const dt = to.time - from.time, dp = to.price - from.price;
  return anchors.map(anchor => ({ time: Math.max(0, anchor.time + dt), price: anchor.price + dp }));
}

export function isDrawingVisible(drawing: DrawingObject, timeframe: string, replayCursor?: number) {
  if (drawing.hidden) return false;
  if (drawing.visibility.timeframes !== "all" && !drawing.visibility.timeframes.includes(timeframe as never)) return false;
  return replayCursor == null || drawing.anchors.every(anchor => anchor.time <= replayCursor);
}
