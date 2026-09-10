import type {
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  ISeriesPrimitive,
  PrimitiveHoveredItem,
  SeriesAttachedParameter,
  Time,
} from "lightweight-charts";
import type { DrawingObject } from "../contracts";
import { drawingHit } from "./geometry";
import type { ProjectedDrawing, ScreenPoint } from "./contracts";

function alpha(color: string, opacity: number) {
  const hex = color.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(hex)) return color;
  const value = Number.parseInt(hex, 16);
  return `rgba(${value >> 16},${value >> 8 & 255},${value & 255},${opacity})`;
}

function dash(style: DrawingObject["style"]["lineStyle"]) {
  return style === "dashed" ? [7, 5] : style === "dotted" ? [2, 4] : [];
}

function extended(a: ScreenPoint, b: ScreenPoint, width: number, both: boolean) {
  const dx = b.x - a.x;
  if (Math.abs(dx) < .001) return [{ x: a.x, y: 0 }, { x: b.x, y: 100000 }];
  const slope = (b.y - a.y) / dx;
  const startX = both ? 0 : a.x;
  return [{ x: startX, y: a.y + slope * (startX - a.x) }, { x: width, y: a.y + slope * (width - a.x) }];
}

function label(ctx: CanvasRenderingContext2D, text: string, point: ScreenPoint, color: string) {
  ctx.font = "11px ui-monospace, monospace";
  const width = ctx.measureText(text).width + 10;
  ctx.fillStyle = "rgba(7,11,17,.9)";
  ctx.fillRect(point.x + 7, point.y - 19, width, 17);
  ctx.fillStyle = color;
  ctx.fillText(text, point.x + 12, point.y - 7);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, w, h, r);
  } else {
    ctx.rect(x, y, w, h);
  }
}

function drawPositionTool(
  ctx: CanvasRenderingContext2D,
  projected: ProjectedDrawing
) {
  const { drawing, points } = projected;
  const isLong = drawing.type === "long-position";
  const [entryPoint, targetPoint, stopPoint = { x: targetPoint.x, y: entryPoint.y + (entryPoint.y - targetPoint.y) * 0.5 }] = points;
  const style = drawing.style;

  const x0 = Math.min(entryPoint.x, targetPoint.x);
  const x1 = Math.max(entryPoint.x, targetPoint.x);
  const width = Math.max(2, x1 - x0);

  const yEntry = entryPoint.y;
  const yTarget = targetPoint.y;
  const yStop = stopPoint.y;

  const targetColor = style.targetColor || "#22c55e";
  const targetFill = style.targetFill || targetColor;
  const stopColor = style.stopColor || "#ef4444";
  const stopFill = style.stopFill || stopColor;
  const entryColor = style.color || "#38bdf8";

  // 1. Target (Profit) Zone
  const targetTop = Math.min(yEntry, yTarget);
  const targetHeight = Math.max(1, Math.abs(yTarget - yEntry));
  ctx.fillStyle = alpha(targetFill, Math.min(0.35, style.opacity * 0.22));
  ctx.fillRect(x0, targetTop, width, targetHeight);

  // Target outer border
  ctx.lineWidth = style.width || 1;
  ctx.strokeStyle = alpha(targetColor, style.opacity * 0.85);
  ctx.strokeRect(x0, targetTop, width, targetHeight);

  // Highlight target extreme boundary
  ctx.beginPath();
  ctx.strokeStyle = targetColor;
  ctx.lineWidth = Math.max(1, (style.width || 1) + 1);
  ctx.moveTo(x0, yTarget);
  ctx.lineTo(x1, yTarget);
  ctx.stroke();

  // 2. Stop (Loss) Zone
  const stopTop = Math.min(yEntry, yStop);
  const stopHeight = Math.max(1, Math.abs(yStop - yEntry));
  ctx.fillStyle = alpha(stopFill, Math.min(0.35, style.opacity * 0.22));
  ctx.fillRect(x0, stopTop, width, stopHeight);

  // Stop outer border
  ctx.lineWidth = style.width || 1;
  ctx.strokeStyle = alpha(stopColor, style.opacity * 0.85);
  ctx.strokeRect(x0, stopTop, width, stopHeight);

  // Highlight stop extreme boundary
  ctx.beginPath();
  ctx.strokeStyle = stopColor;
  ctx.lineWidth = Math.max(1, (style.width || 1) + 1);
  ctx.moveTo(x0, yStop);
  ctx.lineTo(x1, yStop);
  ctx.stroke();

  // 3. Entry Line
  ctx.beginPath();
  ctx.strokeStyle = entryColor;
  ctx.lineWidth = Math.max(1, style.width || 1);
  ctx.setLineDash(dash(style.lineStyle));
  ctx.moveTo(x0, yEntry);
  ctx.lineTo(x1, yEntry);
  ctx.stroke();
  ctx.setLineDash([]);

  // Calculate prices and percentages
  const entryPrice = drawing.anchors[0].price;
  const targetPrice = drawing.anchors[1].price;
  let stopPrice = style.stopPrice;
  const rr = style.riskReward && style.riskReward > 0 ? style.riskReward : 2.0;
  if (stopPrice == null || !Number.isFinite(stopPrice)) {
    const delta = Math.abs(targetPrice - entryPrice);
    stopPrice = isLong
      ? (targetPrice >= entryPrice ? entryPrice - delta / rr : entryPrice + delta / rr)
      : (targetPrice <= entryPrice ? entryPrice + delta / rr : entryPrice - delta / rr);
  }

  const targetDelta = Math.abs(targetPrice - entryPrice);
  const targetPct = entryPrice !== 0 ? (targetDelta / entryPrice) * 100 : 0;
  const stopDelta = Math.abs(entryPrice - stopPrice);
  const stopPct = entryPrice !== 0 ? (stopDelta / entryPrice) * 100 : 0;
  const calculatedRR = stopDelta > 0 ? targetDelta / stopDelta : rr;

  // 4. Badges & Labels
  ctx.font = "bold 10px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
  const targetLabelText = `Target: ${targetPrice.toFixed(2)} (+${targetPct.toFixed(2)}%)`;
  const targetTextWidth = ctx.measureText(targetLabelText).width;
  const labelX = Math.max(x0 + 6, Math.min(x1 - targetTextWidth - 10, x0 + 8));

  // Target tag pill
  const isTargetAbove = yTarget <= yEntry;
  ctx.fillStyle = "rgba(7, 11, 19, 0.9)";
  ctx.fillRect(labelX - 4, yTarget - (isTargetAbove ? 16 : -4), targetTextWidth + 8, 14);
  ctx.fillStyle = targetColor;
  ctx.fillText(targetLabelText, labelX, yTarget - (isTargetAbove ? 5 : -15));

  // Stop Price Tag
  const stopLabelText = `Stop: ${stopPrice.toFixed(2)} (-${stopPct.toFixed(2)}%)`;
  const stopTextWidth = ctx.measureText(stopLabelText).width;
  const stopLabelX = Math.max(x0 + 6, Math.min(x1 - stopTextWidth - 10, x0 + 8));

  const isStopAbove = yStop <= yEntry;
  ctx.fillStyle = "rgba(7, 11, 19, 0.9)";
  ctx.fillRect(stopLabelX - 4, yStop - (isStopAbove ? 16 : -4), stopTextWidth + 8, 14);
  ctx.fillStyle = stopColor;
  ctx.fillText(stopLabelText, stopLabelX, yStop - (isStopAbove ? 5 : -15));

  // 5. Center Risk/Reward Badge (TradingView style pill on entry line)
  if (width >= 60) {
    const badgeText = `Risk/Reward: ${calculatedRR.toFixed(2)}`;
    ctx.font = "600 11px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    const badgeWidth = ctx.measureText(badgeText).width + 16;
    const badgeX = (x0 + x1) / 2 - badgeWidth / 2;
    const badgeY = yEntry - 10;

    ctx.fillStyle = "rgba(10, 14, 24, 0.92)";
    ctx.beginPath();
    roundRect(ctx, badgeX, badgeY, badgeWidth, 20, 4);
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(139, 155, 192, 0.35)";
    ctx.stroke();

    ctx.fillStyle = "#e2e8f0";
    ctx.fillText(badgeText, badgeX + 8, badgeY + 14);
  }
}

class Renderer implements IPrimitivePaneRenderer {
  constructor(private readonly read: () => { drawings: ProjectedDrawing[]; selectedId: string | null }) {}

  draw(target: Parameters<IPrimitivePaneRenderer["draw"]>[0]) {
    target.useMediaCoordinateSpace(({ context: ctx, mediaSize }) => {
      const { drawings, selectedId } = this.read();
      for (const projected of drawings) {
        const { drawing, points } = projected;
        const [rawA, rawB = rawA] = points;
        let a = rawA, b = rawB;
        const style = drawing.style;
        ctx.save();
        ctx.globalAlpha = style.opacity;
        ctx.strokeStyle = style.color;
        ctx.fillStyle = alpha(style.fill ?? style.color, Math.min(.18, style.opacity * .18));
        ctx.lineWidth = style.width;
        ctx.setLineDash(dash(style.lineStyle));
        if (drawing.type === "extended-line") [a, b] = extended(a, b, mediaSize.width, true);
        if (["ray", "horizontal-ray"].includes(drawing.type)) [a, b] = drawing.type === "horizontal-ray" ? [a, { x: mediaSize.width, y: a.y }] : extended(a, b, mediaSize.width, false);
        if (["horizontal-line", "price-label"].includes(drawing.type)) [a, b] = [{ x: 0, y: a.y }, { x: mediaSize.width, y: a.y }];
        if (drawing.type === "vertical-line") [a, b] = [{ x: a.x, y: 0 }, { x: a.x, y: mediaSize.height }];

        if (drawing.type === "long-position" || drawing.type === "short-position") {
          drawPositionTool(ctx, projected);
        } else if (["rectangle", "price-range"].includes(drawing.type)) {
          const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y), w = Math.abs(b.x - a.x), h = Math.abs(b.y - a.y);
          ctx.fillRect(x, y, w, h); ctx.strokeRect(x, y, w, h);
        } else if (drawing.type === "date-range") {
          const x = Math.min(a.x, b.x), w = Math.abs(b.x - a.x);
          ctx.fillRect(x, 0, w, mediaSize.height); ctx.strokeRect(x, 0, w, mediaSize.height);
        } else if (drawing.type === "fibonacci-retracement") {
          const levels = [0, .236, .382, .5, .618, .786, 1];
          for (const level of levels) {
            const y = rawA.y + (rawB.y - rawA.y) * level;
            ctx.beginPath(); ctx.moveTo(Math.min(rawA.x, rawB.x), y); ctx.lineTo(Math.max(rawA.x, rawB.x), y); ctx.stroke();
            label(ctx, `${(level * 100).toFixed(1)}%`, { x: Math.max(rawA.x, rawB.x), y }, style.color);
          }
        } else if (["text", "price-label"].includes(drawing.type)) {
          label(ctx, style.text || (drawing.type === "price-label" ? drawing.anchors[0].price.toFixed(2) : "Text"), rawA, style.color);
        } else {
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          if (drawing.type === "arrow") {
            const angle = Math.atan2(b.y - a.y, b.x - a.x), size = 9;
            ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - size * Math.cos(angle - .45), b.y - size * Math.sin(angle - .45)); ctx.lineTo(b.x - size * Math.cos(angle + .45), b.y - size * Math.sin(angle + .45)); ctx.closePath(); ctx.fillStyle = style.color; ctx.fill();
          }
        }
        if (["ruler", "price-range", "date-range"].includes(drawing.type)) {
          const priceDelta = drawing.anchors[1].price - drawing.anchors[0].price;
          const percent = drawing.anchors[0].price === 0 ? 0 : priceDelta / drawing.anchors[0].price * 100;
          const duration = Math.abs(drawing.anchors[1].time - drawing.anchors[0].time);
          const text = drawing.type === "date-range" ? `${Math.round(duration / 60000)}m` : `${priceDelta >= 0 ? "+" : ""}${priceDelta.toFixed(2)}  ${percent.toFixed(2)}%`;
          label(ctx, text, rawB, style.color);
        }
        if (drawing.id === selectedId && !drawing.locked) {
          ctx.globalAlpha = 1; ctx.setLineDash([]);
          for (const point of points) {
            ctx.beginPath();
            ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
            ctx.fillStyle = "#0c101b";
            ctx.fill();
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = "#38bdf8";
            ctx.stroke();
          }
        }
        ctx.restore();
      }
    });
  }
}

class View implements IPrimitivePaneView {
  private readonly output: Renderer;
  constructor(read: () => { drawings: ProjectedDrawing[]; selectedId: string | null }) { this.output = new Renderer(read); }
  zGeneric() { return "top" as const; }
  zOrder() { return this.zGeneric(); }
  renderer() { return this.output; }
}

export class DrawingPrimitive implements ISeriesPrimitive<Time> {
  private attachedState: SeriesAttachedParameter<Time> | null = null;
  private drawings: DrawingObject[] = [];
  private projected: ProjectedDrawing[] = [];
  private selectedId: string | null = null;
  private readonly view = new View(() => ({ drawings: this.projected, selectedId: this.selectedId }));

  attached(param: SeriesAttachedParameter<Time>) { this.attachedState = param; this.updateAllViews(); }
  detached() { this.attachedState = null; this.projected = []; }
  paneViews() { return [this.view]; }
  setDrawings(drawings: DrawingObject[], selectedId: string | null) { this.drawings = drawings; this.selectedId = selectedId; this.updateAllViews(); this.attachedState?.requestUpdate(); }
  updateAllViews() {
    if (!this.attachedState) return;
    const { chart, series } = this.attachedState;
    this.projected = this.drawings.map(drawing => {
      const points = drawing.anchors.map(anchor => ({ x: chart.timeScale().timeToCoordinate((anchor.time / 1000) as Time), y: series.priceToCoordinate(anchor.price) }));
      if (points.some(point => point.x == null || point.y == null)) return null;

      if (drawing.type === "long-position" || drawing.type === "short-position") {
        const [a0, a1] = drawing.anchors;
        let stopPrice = drawing.style.stopPrice;
        const rr = drawing.style.riskReward && drawing.style.riskReward > 0 ? drawing.style.riskReward : 2.0;
        const delta = Math.abs(a1.price - a0.price);
        if (stopPrice == null || !Number.isFinite(stopPrice)) {
          stopPrice = drawing.type === "long-position"
            ? (a1.price >= a0.price ? a0.price - delta / rr : a0.price + delta / rr)
            : (a1.price <= a0.price ? a0.price + delta / rr : a0.price - delta / rr);
        }
        const stopY = series.priceToCoordinate(stopPrice);
        if (stopY != null) {
          const pt0 = points[0] as ScreenPoint;
          const pt1 = points[1] as ScreenPoint;
          return {
            drawing,
            points: [pt0, pt1, { x: pt1.x, y: stopY }],
          };
        }
      }

      return { drawing, points: points as ScreenPoint[] };
    }).filter((item): item is ProjectedDrawing => item !== null);
  }
  hitTest(x: number, y: number): PrimitiveHoveredItem | null {
    const found = [...this.projected].reverse().find(item => drawingHit(item, { x, y }));
    return found ? { externalId: found.drawing.id, zOrder: "top", cursorStyle: found.drawing.locked ? "not-allowed" : "pointer", hitTestPriority: 1, itemType: "primitive" } : null;
  }
  getProjected() { return this.projected; }
}
