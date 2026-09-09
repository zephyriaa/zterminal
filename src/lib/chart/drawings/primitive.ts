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

        if (["rectangle", "long-position", "short-position", "price-range"].includes(drawing.type)) {
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
        if (["ruler", "price-range", "date-range", "long-position", "short-position"].includes(drawing.type)) {
          const priceDelta = drawing.anchors[1].price - drawing.anchors[0].price;
          const percent = drawing.anchors[0].price === 0 ? 0 : priceDelta / drawing.anchors[0].price * 100;
          const duration = Math.abs(drawing.anchors[1].time - drawing.anchors[0].time);
          const text = drawing.type === "date-range" ? `${Math.round(duration / 60000)}m` : `${priceDelta >= 0 ? "+" : ""}${priceDelta.toFixed(2)}  ${percent.toFixed(2)}%`;
          label(ctx, text, rawB, style.color);
        }
        if (drawing.id === selectedId && !drawing.locked) {
          ctx.globalAlpha = 1; ctx.setLineDash([]);
          for (const point of points) { ctx.beginPath(); ctx.arc(point.x, point.y, 3.25, 0, Math.PI * 2); ctx.fillStyle = "#081018"; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = "#d8e7f5"; ctx.stroke(); }
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
      return points.every(point => point.x != null && point.y != null) ? { drawing, points: points as ScreenPoint[] } : null;
    }).filter((item): item is ProjectedDrawing => item !== null);
  }
  hitTest(x: number, y: number): PrimitiveHoveredItem | null {
    const found = [...this.projected].reverse().find(item => drawingHit(item, { x, y }));
    return found ? { externalId: found.drawing.id, zOrder: "top", cursorStyle: found.drawing.locked ? "not-allowed" : "pointer", hitTestPriority: 1, itemType: "primitive" } : null;
  }
  getProjected() { return this.projected; }
}
