"use client";

import { useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import type { Bar } from "@/lib/market/types";
import { defaultDrawingStyle, drawingAnchorCount, type DrawingAnchor, type DrawingObject, type DrawingType } from "@/lib/chart/contracts";
import type { DrawingTool, MagnetMode, ProjectedDrawing } from "@/lib/chart/drawings/contracts";
import { distance, drawingHit } from "@/lib/chart/drawings/geometry";

type Gesture = { kind: "create"; start: DrawingAnchor; type: DrawingType } | { kind: "anchor"; drawing: DrawingObject; anchorIndex: number } | { kind: "move"; drawing: DrawingObject; start: DrawingAnchor };

type Props = {
  tool: DrawingTool;
  magnet: MagnetMode;
  bars: Bar[];
  drawings: DrawingObject[];
  selectedId: string | null;
  toAnchor: (point: { x: number; y: number }) => DrawingAnchor | null;
  projected: () => ProjectedDrawing[];
  onTool: (tool: DrawingTool) => void;
  onSelect: (id: string | null) => void;
  onPreview: (drawing: DrawingObject | null) => void;
  onCreate: (type: DrawingType, anchors: DrawingAnchor[]) => string | null;
  onUpdate: (id: string, patch: Partial<DrawingObject>) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
};

function point(event: ReactPointerEvent<HTMLElement> | ReactMouseEvent<HTMLElement>) { const rect = event.currentTarget.getBoundingClientRect(); return { x: event.clientX - rect.left, y: event.clientY - rect.top }; }

function closestDrawing(projected: ProjectedDrawing[], target: { x: number; y: number }) {
  for (const item of [...projected].reverse()) {
    const points = item.points;
    if (points.some(value => distance(value, target) <= 7) || drawingHit(item, target)) return item;
  }
  return null;
}

function snap(anchor: DrawingAnchor, bars: Bar[], mode: MagnetMode) {
  if (mode === "off" || bars.length === 0) return anchor;
  let bar = bars[0];
  for (const candidate of bars) if (Math.abs(candidate.t - anchor.time) < Math.abs(bar.t - anchor.time)) bar = candidate;
  const prices = [bar.o, bar.h, bar.l, bar.c];
  const price = prices.reduce((best, value) => Math.abs(value - anchor.price) < Math.abs(best - anchor.price) ? value : best);
  if (mode === "weak" && Math.abs(price - anchor.price) / Math.max(Math.abs(anchor.price), 1) > .003) return anchor;
  return { time: bar.t, price };
}

function preview(type: DrawingType, anchors: DrawingAnchor[], reference?: DrawingObject): DrawingObject {
  const now = Date.now();
  return reference ? { ...reference, anchors, updatedAt: now } : {
    schemaVersion: 1,
    id: "__drawing-preview__",
    type,
    instrument: { provider: "gateio", exchange: "GATEIO", product: "perpetual", nativeSymbol: "__preview__" },
    chartId: "__preview__",
    anchors,
    style: defaultDrawingStyle(type),
    visibility: { timeframes: "all" },
    locked: false,
    hidden: false,
    zOrder: Number.MAX_SAFE_INTEGER,
    createdAt: now,
    updatedAt: now,
  };
}

export function DrawingInteractionLayer(props: Props) {
  const gesture = useRef<Gesture | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; id: string } | null>(null);
  const active = props.tool !== "crosshair";
  const drawingById = (id: string) => props.drawings.find(drawing => drawing.id === id);
  const anchorFor = (event: ReactPointerEvent<HTMLElement>) => {
    const anchor = props.toAnchor(point(event));
    return anchor ? snap(anchor, props.bars, props.magnet) : null;
  };
  const begin = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    setMenu(null);
    const screen = point(event);
    const hit = closestDrawing(props.projected(), screen);
    if (props.tool === "eraser") { if (hit && !hit.drawing.locked) props.onDelete(hit.drawing.id); return; }
    if (props.tool === "cursor") {
      props.onSelect(hit?.drawing.id ?? null);
      if (!hit || hit.drawing.locked) return;
      const anchor = anchorFor(event);
      if (!anchor) return;
      const handle = hit.points.findIndex(value => distance(value, screen) <= 7);
      gesture.current = handle >= 0 ? { kind: "anchor", drawing: hit.drawing, anchorIndex: handle } : { kind: "move", drawing: hit.drawing, start: anchor };
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }
    if (props.tool === "crosshair") return;
    const drawingType = props.tool;
    const anchor = anchorFor(event);
    if (!anchor) return;
    if (drawingAnchorCount(drawingType) === 1) {
      const id = props.onCreate(drawingType, [anchor]);
      props.onSelect(id); props.onTool("cursor");
      return;
    }
    gesture.current = { kind: "create", start: anchor, type: drawingType };
    props.onPreview(preview(drawingType, [anchor, anchor]));
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const move = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = gesture.current;
    if (!current) return;
    const anchor = anchorFor(event);
    if (!anchor) return;
    if (current.kind === "create") props.onPreview(preview(current.type, [current.start, anchor]));
    if (current.kind === "anchor") props.onPreview(preview(current.drawing.type, current.drawing.anchors.map((value, index) => index === current.anchorIndex ? anchor : value), current.drawing));
    if (current.kind === "move") {
      const dt = anchor.time - current.start.time, dp = anchor.price - current.start.price;
      props.onPreview(preview(current.drawing.type, current.drawing.anchors.map(value => ({ time: value.time + dt, price: value.price + dp })), current.drawing));
    }
  };
  const finish = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = gesture.current;
    if (!current) return;
    const anchor = anchorFor(event);
    if (anchor) {
      if (current.kind === "create") { const id = props.onCreate(current.type, [current.start, anchor]); props.onSelect(id); props.onTool("cursor"); }
      if (current.kind === "anchor") props.onUpdate(current.drawing.id, { anchors: current.drawing.anchors.map((value, index) => index === current.anchorIndex ? anchor : value) });
      if (current.kind === "move") { const dt = anchor.time - current.start.time, dp = anchor.price - current.start.price; props.onUpdate(current.drawing.id, { anchors: current.drawing.anchors.map(value => ({ time: value.time + dt, price: value.price + dp })) }); }
    }
    gesture.current = null; props.onPreview(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  return <div className="zt-drawing-input" style={{ pointerEvents: active ? "auto" : "none" }} tabIndex={active ? 0 : -1} aria-label="Chart drawing interaction layer" onPointerDown={begin} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish} onContextMenu={event => { event.preventDefault(); const location = point(event); const hit = closestDrawing(props.projected(), location); if (hit) { props.onSelect(hit.drawing.id); setMenu({ ...location, id: hit.drawing.id }); } }} onKeyDown={event => {
    if (event.key === "Escape") { gesture.current = null; props.onPreview(null); props.onTool("cursor"); setMenu(null); }
    if ((event.key === "Delete" || event.key === "Backspace") && props.selectedId) { const selected = drawingById(props.selectedId); if (selected && !selected.locked) props.onDelete(selected.id); }
    if (event.key.toLowerCase() === "d" && (event.ctrlKey || event.metaKey) && props.selectedId) { event.preventDefault(); props.onDuplicate(props.selectedId); }
  }}>
    {menu && <div className="zt-drawing-context" role="menu" style={{ left: menu.x, top: menu.y }}>
      <button role="menuitem" type="button" onClick={() => { props.onSelect(menu.id); setMenu(null); }}>Settings</button>
      <button role="menuitem" type="button" onClick={() => { props.onDuplicate(menu.id); setMenu(null); }}>Duplicate</button>
      <button role="menuitem" type="button" onClick={() => { const drawing = drawingById(menu.id); if (drawing) props.onUpdate(menu.id, { locked: !drawing.locked }); setMenu(null); }}>{drawingById(menu.id)?.locked ? "Unlock" : "Lock"}</button>
      <button role="menuitem" type="button" onClick={() => { props.onUpdate(menu.id, { hidden: true }); setMenu(null); }}>Hide</button>
      <button role="menuitem" type="button" className="is-danger" disabled={drawingById(menu.id)?.locked} onClick={() => { props.onDelete(menu.id); setMenu(null); }}>Delete</button>
    </div>}
  </div>;
}
