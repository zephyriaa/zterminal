import type { DrawingAnchor, DrawingObject } from "../contracts";
import type { ProjectedDrawing, ScreenPoint } from "./contracts";

export function distance(a: ScreenPoint, b: ScreenPoint) { return Math.hypot(a.x - b.x, a.y - b.y); }
export function distanceToSegment(point: ScreenPoint, start: ScreenPoint, end: ScreenPoint) {
  const dx = end.x - start.x, dy = end.y - start.y;
  if (dx === 0 && dy === 0) return distance(point, start);
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy)));
  return distance(point, { x: start.x + t * dx, y: start.y + t * dy });
}

/** Clip a directed parametric line, including vertical and left-facing rays. */
export function clipLine(a: ScreenPoint, b: ScreenPoint, width: number, height: number, extendStart = false, extendEnd = false): [ScreenPoint, ScreenPoint] | null {
  const dx = b.x - a.x, dy = b.y - a.y;
  if (dx === 0 && dy === 0) return [a, b];
  let low = extendStart ? -Infinity : 0, high = extendEnd ? Infinity : 1;
  for (const [origin, delta, bound] of [[a.x, dx, width], [a.y, dy, height]]) {
    if (delta === 0) { if (origin < 0 || origin > bound) return null; continue; }
    const t0 = -origin / delta, t1 = (bound - origin) / delta;
    low = Math.max(low, Math.min(t0, t1)); high = Math.min(high, Math.max(t0, t1));
    if (low > high) return null;
  }
  return [{ x: a.x + dx * low, y: a.y + dy * low }, { x: a.x + dx * high, y: a.y + dy * high }];
}

export function channelPoints(points: ScreenPoint[], viewport?: { width: number; height: number }, extendStart = false, extendEnd = false) {
  const [a, b, c = b] = points;
  const dx = b.x - a.x, dy = b.y - a.y, denominator = dx * dx + dy * dy;
  const t = denominator ? ((c.x - a.x) * dx + (c.y - a.y) * dy) / denominator : 0;
  const offset = { x: c.x - a.x - t * dx, y: c.y - a.y - t * dy };
  const c0 = { x: a.x + offset.x, y: a.y + offset.y }, c1 = { x: b.x + offset.x, y: b.y + offset.y };
  if (viewport && (extendStart || extendEnd)) {
    const baseline = clipLine(a, b, viewport.width, viewport.height, extendStart, extendEnd);
    const parallel = clipLine(c0, c1, viewport.width, viewport.height, extendStart, extendEnd);
    if (baseline && parallel) return [baseline[0], baseline[1], parallel[1], parallel[0]];
  }
  return [a, b, c1, c0];
}

function insidePolygon(point: ScreenPoint, polygon: ScreenPoint[]) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** Renderer and hit tester consume the same line geometry. */
export function drawingSegments(projected: ProjectedDrawing): [ScreenPoint, ScreenPoint][] {
  const { drawing, points, viewport = { width: 100000, height: 100000 } } = projected;
  if (!points.length) return [];
  const [a, b = a] = points, type = drawing.type;
  if (type === "polyline") return points.slice(1).map((point, i) => [points[i], point]);
  if (type === "horizontal-line" || type === "cross-line") {
    const horizontal: [ScreenPoint, ScreenPoint] = [{ x: 0, y: a.y }, { x: viewport.width, y: a.y }];
    return type === "cross-line" ? [horizontal, [{ x: a.x, y: 0 }, { x: a.x, y: viewport.height }]] : [horizontal];
  }
  if (type === "vertical-line") return [[{ x: a.x, y: 0 }, { x: a.x, y: viewport.height }]];
  if (type === "horizontal-ray") {
    const segment = clipLine(a, { x: b.x === a.x ? a.x + 1 : b.x, y: a.y }, viewport.width, viewport.height, drawing.style.extendStart, true);
    return segment ? [segment] : [];
  }
  if (type === "parallel-channel") {
    const [p, q, r, s] = channelPoints(points, viewport, drawing.style.extendStart, drawing.style.extendEnd);
    return [[p, q], [s, r], [{ x: (p.x + s.x) / 2, y: (p.y + s.y) / 2 }, { x: (q.x + r.x) / 2, y: (q.y + r.y) / 2 }]];
  }
  if (type.startsWith("fibonacci-")) {
    const levels = projected.levels ?? (drawing.style.levels ?? [0, .236, .382, .5, .618, .786, 1]).map(value => ({ value, y: a.y + (b.y - a.y) * value }));
    return levels.map(({ y }) => [{ x: drawing.style.extendStart ? 0 : Math.min(a.x, b.x), y }, { x: drawing.style.extendEnd ? viewport.width : Math.max(a.x, b.x), y }]);
  }
  const segment = clipLine(a, b, viewport.width, viewport.height, type === "extended-line" || drawing.style.extendStart, type === "extended-line" || type === "ray" || drawing.style.extendEnd);
  return segment ? [segment] : [];
}

export function textBounds(projected: ProjectedDrawing) {
  const a = projected.points[0], style = projected.drawing.style;
  const text = style.text || (projected.drawing.type === "price-label" ? projected.drawing.anchors[0].price.toFixed(2) : "Text");
  const size = style.textSize ?? 12, lines = text.split("\n");
  const width = Math.max(...lines.map(line => line.length)) * size * .61 + 10;
  const left = a.x + 7 - (style.textAlign === "right" ? width : style.textAlign === "center" ? width / 2 : 0);
  return { left, top: a.y - size - 7, width, height: lines.length * (size + 3) + 4, lines, size };
}

function ellipseEdgeDistance(x: number, y: number, rx: number, ry: number) {
  x = Math.abs(x); y = Math.abs(y);
  const squared = (angle: number) => (x - rx * Math.cos(angle)) ** 2 + (y - ry * Math.sin(angle)) ** 2;
  // Minimize the nearest quadrant; radial normalization gives very large false-hit
  // regions near the ends of thin ellipses. Work entirely in CSS pixels.
  const ratio = (Math.sqrt(5) - 1) / 2;
  let left = 0, right = Math.PI / 2;
  let a = right - ratio * (right - left), b = left + ratio * (right - left), da = squared(a), db = squared(b);
  for (let i = 0; i < 22; i++) {
    if (da < db) { right = b; b = a; db = da; a = right - ratio * (right - left); da = squared(a); }
    else { left = a; a = b; da = db; b = left + ratio * (right - left); db = squared(b); }
  }
  return Math.sqrt(Math.min(da, db, squared(0), squared(Math.PI / 2)));
}

export function drawingHit(projected: ProjectedDrawing, point: ScreenPoint, tolerance = 7) {
  if (!projected.points.length) return false;
  const [a, b = a] = projected.points, type = projected.drawing.type;
  if (["text", "callout", "price-label"].includes(type)) {
    const bounds = textBounds(projected);
    return point.x >= bounds.left - tolerance && point.x <= bounds.left + bounds.width + tolerance && point.y >= bounds.top - tolerance && point.y <= bounds.top + bounds.height + tolerance;
  }
  if (["long-position", "short-position"].includes(type)) {
    const c = projected.points[2] ?? b;
    return point.x >= Math.min(a.x, b.x) - tolerance && point.x <= Math.max(a.x, b.x) + tolerance && point.y >= Math.min(a.y, b.y, c.y) - tolerance && point.y <= Math.max(a.y, b.y, c.y) + tolerance;
  }
  if (["rectangle", "price-range", "date-range"].includes(type)) {
    const left = Math.min(a.x, b.x), right = Math.max(a.x, b.x);
    const top = type === "date-range" ? 0 : Math.min(a.y, b.y), bottom = type === "date-range" ? projected.viewport?.height ?? Math.max(a.y, b.y) : Math.max(a.y, b.y);
    const inside = point.x >= left - tolerance && point.x <= right + tolerance && point.y >= top - tolerance && point.y <= bottom + tolerance;
    return inside && (Boolean(projected.drawing.style.fill) || type !== "rectangle" || Math.min(Math.abs(point.x - left), Math.abs(point.x - right), Math.abs(point.y - top), Math.abs(point.y - bottom)) <= tolerance);
  }
  if (type === "ellipse") {
    const rx = Math.abs(a.x - b.x) / 2, ry = Math.abs(a.y - b.y) / 2;
    if (rx < 1 || ry < 1) return distanceToSegment(point, a, b) <= tolerance;
    const x = point.x - (a.x + b.x) / 2, y = point.y - (a.y + b.y) / 2;
    if (Math.abs(x) > rx + tolerance || Math.abs(y) > ry + tolerance) return false;
    if (Math.hypot(x / rx, y / ry) <= 1 && projected.drawing.style.fill) return true;
    return ellipseEdgeDistance(x, y, rx, ry) <= tolerance;
  }
  if (type === "parallel-channel" && projected.drawing.style.fill && insidePolygon(point, channelPoints(projected.points, projected.viewport, projected.drawing.style.extendStart, projected.drawing.style.extendEnd))) return true;
  return drawingSegments(projected).some(([start, end]) => distanceToSegment(point, start, end) <= tolerance);
}

export function nearestDrawing(drawings: ProjectedDrawing[], point: ScreenPoint) {
  return [...drawings].sort((a, b) => b.drawing.zOrder - a.drawing.zOrder).find(item => drawingHit(item, point))?.drawing.id ?? null;
}
export function nearestAnchor(projected: ProjectedDrawing, point: ScreenPoint, tolerance = 9) {
  const index = projected.points.findIndex(anchor => distance(anchor, point) <= tolerance);
  return index < 0 ? null : index;
}
export function moveAnchors(anchors: DrawingAnchor[], from: DrawingAnchor, to: DrawingAnchor): DrawingAnchor[] {
  const dt = Math.max(to.time - from.time, -Math.min(...anchors.map(anchor => anchor.time))), dp = to.price - from.price;
  return anchors.map(anchor => ({ time: anchor.time + dt, price: anchor.price + dp }));
}
export function isDrawingVisible(drawing: DrawingObject, timeframe: string, replayCursor?: number) {
  if (drawing.hidden) return false;
  if (drawing.visibility.timeframes !== "all" && !drawing.visibility.timeframes.includes(timeframe as never)) return false;
  return replayCursor == null || drawing.anchors.every(anchor => anchor.time <= replayCursor);
}
