"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Bar } from "@/lib/market/types";
import { defaultDrawingStyle, drawingAnchorCount, type DrawingAnchor, type DrawingObject, type DrawingType } from "@/lib/chart/contracts";
import type { DrawingTool, MagnetMode, ProjectedDrawing, ScreenPoint } from "@/lib/chart/drawings/contracts";
import type { DrawingCoordinates } from "@/lib/chart/drawings/coordinates";
import { distance, drawingHit, moveAnchors, nearestAnchor } from "@/lib/chart/drawings/geometry";
import { snapDrawingPoint } from "@/lib/chart/drawings/snapping";

type Gesture = { drawing: DrawingObject; index: number | null; start: DrawingAnchor; pointerId: number };
type Creation = { type: DrawingType; anchors: DrawingAnchor[]; down: ScreenPoint; pointerId: number; dragging: boolean };
type Props = {
  tool: DrawingTool; magnet: MagnetMode; bars: Bar[]; drawings: DrawingObject[]; selectedId: string | null;
  coordinates: () => DrawingCoordinates | null;
  viewport: () => { width: number; height: number };
  projected: () => ProjectedDrawing[];
  onTool: (tool: DrawingTool) => void; onSelect: (id: string | null) => void;
  onPreview: (drawing: DrawingObject | null) => void; onSnap: (point: ScreenPoint | null) => void;
  onCreate: (type: DrawingType, anchors: DrawingAnchor[]) => string | null;
  onUpdate: (id: string, patch: Partial<DrawingObject>) => void;
  onDelete: (id: string) => void; onDuplicate: (id: string) => void;
  persistent?: boolean;
};

function preview(type: DrawingType, anchors: DrawingAnchor[]): DrawingObject {
  return { schemaVersion: 1, id: "__drawing-preview__", type,
    instrument: { provider: "gateio", exchange: "GATEIO", product: "perpetual", nativeSymbol: "__preview__" }, chartId: "__preview__",
    anchors, style: defaultDrawingStyle(type), visibility: { timeframes: "all" }, locked: false, hidden: false,
    zOrder: 10000, createdAt: 0, updatedAt: 0 };
}

export function DrawingInteractionLayer(props: Props) {
  const input = useRef<HTMLDivElement>(null), live = useRef(props);
  useLayoutEffect(() => { live.current = props; });
  const cancelRef = useRef<() => void>(() => {});
  const [menu, setMenu] = useState<{ x: number; y: number; id: string } | null>(null);
  useEffect(() => {
    const element = input.current, surface = element?.parentElement;
    if (!element || !surface) return;
    let gesture: Gesture | null = null, creation: Creation | null = null, draft: DrawingObject | null = null;
    let frame = 0, nextPreview: DrawingObject | null = null;
    const publish = (value: DrawingObject | null) => {
      draft = value; nextPreview = value;
      if (!frame) frame = requestAnimationFrame(() => { frame = 0; live.current.onPreview(nextPreview); });
    };
    const clear = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0; draft = null; nextPreview = null;
      live.current.onPreview(null); live.current.onSnap(null);
    };
    const release = (id: number | undefined) => { if (id != null && element.hasPointerCapture(id)) element.releasePointerCapture(id); };
    const cancel = () => { const id = gesture?.pointerId ?? creation?.pointerId; gesture = null; creation = null; clear(); release(id); setMenu(null); };
    cancelRef.current = cancel;
    const screen = (event: MouseEvent | PointerEvent) => { const rect = surface.getBoundingClientRect(); return { x: event.clientX - rect.left, y: event.clientY - rect.top }; };
    const isControl = (event: Event) => event.target instanceof Element && Boolean(event.target.closest("button,input,textarea,select,[contenteditable=true],[role=menu]"));
    const inPane = (p: ScreenPoint) => { const size = live.current.viewport(); return p.x >= 0 && p.y >= 0 && p.x < size.width && p.y < size.height; };
    const pick = (p: ScreenPoint) => {
      const drawings = live.current.projected();
      const selected = drawings.find(item => item.drawing.id === live.current.selectedId);
      if (selected && nearestAnchor(selected, p) != null) return selected;
      return [...drawings].reverse().find(item => drawingHit(item, p)) ?? null;
    };
    const anchorFor = (p: ScreenPoint, constrained: boolean, from?: DrawingAnchor) => {
      const coordinates = live.current.coordinates();
      if (!coordinates) return null;
      if (constrained && from) {
        const start = coordinates.project(from);
        if (start) {
          const length = distance(start, p), angle = Math.round(Math.atan2(p.y - start.y, p.x - start.x) / (Math.PI / 4)) * Math.PI / 4;
          p = { x: start.x + Math.cos(angle) * length, y: start.y + Math.sin(angle) * length };
        }
      }
      const result = snapDrawingPoint(p, live.current.bars, live.current.magnet, coordinates);
      live.current.onSnap(result.target);
      return result.anchor;
    };
    const complete = (type: DrawingType, anchors: DrawingAnchor[]) => {
      const id = live.current.onCreate(type, anchors);
      cancel(); live.current.onSelect(id);
      if (!live.current.persistent) live.current.onTool("cursor");
    };
    const down = (event: PointerEvent) => {
      if (isControl(event) || event.button !== 0 || !event.isPrimary) return;
      const p = screen(event);
      if (!inPane(p)) return;
      setMenu(null);
      const hit = pick(p), tool = live.current.tool;
      if (tool === "cursor" || tool === "crosshair" || tool === "eraser") {
        live.current.onSelect(hit?.drawing.id ?? null);
        if (!hit) return; // Empty space stays available to the chart's pan/zoom controller.
        event.preventDefault(); event.stopPropagation(); element.focus({ preventScroll: true });
        if (tool === "eraser") { if (!hit.drawing.locked) live.current.onDelete(hit.drawing.id); return; }
        if (hit.drawing.locked) return;
        const anchor = live.current.coordinates()?.unproject(p);
        if (!anchor) return;
        gesture = { drawing: hit.drawing, index: nearestAnchor(hit, p), start: anchor, pointerId: event.pointerId };
        element.setPointerCapture(event.pointerId); return;
      }
      event.preventDefault(); event.stopPropagation(); element.focus({ preventScroll: true });
      const anchor = anchorFor(p, event.shiftKey, creation?.anchors.at(-1));
      if (!anchor) return;
      if (drawingAnchorCount(tool) === 1) { complete(tool, [anchor]); return; }
      if (creation?.type === tool) {
        // Double-click closes a path without appending a duplicate final anchor.
        if (tool === "polyline" && event.detail >= 2) { complete(tool, creation.anchors); return; }
        creation.anchors.push(anchor);
        if (tool !== "polyline" && creation.anchors.length === drawingAnchorCount(tool)) { complete(tool, creation.anchors); return; }
        creation.down = p;
      } else creation = { type: tool, anchors: [anchor], down: p, pointerId: event.pointerId, dragging: false };
      publish(preview(tool, [...creation.anchors, anchor]));
      element.setPointerCapture(event.pointerId);
    };
    const move = (event: PointerEvent) => {
      if (isControl(event)) return;
      const p = screen(event);
      if (!gesture && !creation) { surface.style.cursor = inPane(p) && pick(p) ? "pointer" : ""; return; }
      const anchor = gesture?.index === null ? live.current.coordinates()?.unproject(p) : anchorFor(p, event.shiftKey, creation?.anchors.at(-1));
      if (!anchor) return;
      event.stopPropagation();
      if (creation) {
        if (event.buttons && distance(creation.down, p) > 4) creation.dragging = true;
        const anchors = [...creation.anchors, anchor];
        // Three-anchor previews use the last point until the second click.
        while (anchors.length < drawingAnchorCount(creation.type)) anchors.push(anchor);
        publish(preview(creation.type, anchors));
      }
      if (gesture) {
        const { drawing, index, start } = gesture;
        if (index === 2 && ["long-position", "short-position"].includes(drawing.type)) {
          const delta = Math.abs(drawing.anchors[1].price - drawing.anchors[0].price), risk = Math.abs(drawing.anchors[0].price - anchor.price);
          publish({ ...drawing, style: { ...drawing.style, stopPrice: anchor.price, riskReward: risk ? delta / risk : drawing.style.riskReward } });
        } else if (index != null) publish({ ...drawing, anchors: drawing.anchors.map((value, i) => i === index ? anchor : value) });
        else publish({ ...drawing, anchors: moveAnchors(drawing.anchors, start, anchor), style: drawing.style.stopPrice == null ? drawing.style : { ...drawing.style, stopPrice: drawing.style.stopPrice + anchor.price - start.price } });
      }
    };
    const up = (event: PointerEvent) => {
      if (gesture) {
        event.stopPropagation();
        const id = gesture.drawing.id;
        if (draft) live.current.onUpdate(id, { anchors: draft.anchors, style: draft.style });
        gesture = null; clear(); release(event.pointerId);
      } else if (creation) {
        event.stopPropagation(); release(event.pointerId);
        if (creation.dragging && drawingAnchorCount(creation.type) === 2 && creation.type !== "polyline" && draft) complete(creation.type, draft.anchors);
      }
    };
    const lost = () => { if (gesture) cancel(); };
    const context = (event: MouseEvent) => {
      if (isControl(event)) return;
      if (gesture || creation) { event.preventDefault(); event.stopPropagation(); cancel(); return; }
      const p = screen(event), hit = inPane(p) ? pick(p) : null;
      if (!hit) return;
      event.preventDefault(); event.stopPropagation(); live.current.onSelect(hit.drawing.id);
      const size = live.current.viewport();
      setMenu({ x: Math.max(0, Math.min(p.x, size.width - 160)), y: Math.max(0, Math.min(p.y, size.height - 240)), id: hit.drawing.id });
    };
    const keyboard = (event: KeyboardEvent) => {
      if (isControl(event) || event.target instanceof Element && event.target.closest(".monaco-editor")) return;
      if (event.key === "Escape") { cancel(); live.current.onSelect(null); live.current.onTool("cursor"); }
      if (event.key === "Enter" && creation?.type === "polyline" && creation.anchors.length >= 2) { event.preventDefault(); complete(creation.type, creation.anchors); }
    };
    const doubleClick = (event: MouseEvent) => {
      if (creation?.type === "polyline") {
        event.preventDefault(); event.stopPropagation();
        const anchors = creation.anchors.filter((a, i, list) => i === 0 || a.time !== list[i - 1].time || a.price !== list[i - 1].price);
        if (anchors.length >= 2) complete(creation.type, anchors);
      } else if (creation || pick(screen(event))) event.stopPropagation();
    };
    surface.addEventListener("pointerdown", down, true); surface.addEventListener("pointermove", move, true);
    surface.addEventListener("pointerup", up, true); surface.addEventListener("pointercancel", cancel, true);
    element.addEventListener("lostpointercapture", lost);
    surface.addEventListener("contextmenu", context, true); surface.addEventListener("dblclick", doubleClick, true);
    window.addEventListener("keydown", keyboard);
    return () => {
      cancel(); surface.style.cursor = "";
      surface.removeEventListener("pointerdown", down, true); surface.removeEventListener("pointermove", move, true);
      surface.removeEventListener("pointerup", up, true); surface.removeEventListener("pointercancel", cancel, true);
      element.removeEventListener("lostpointercapture", lost);
      surface.removeEventListener("contextmenu", context, true); surface.removeEventListener("dblclick", doubleClick, true);
      window.removeEventListener("keydown", keyboard);
    };
  }, []);
  useEffect(() => { cancelRef.current(); }, [props.tool]);
  const selected = menu ? props.drawings.find(drawing => drawing.id === menu.id) : null;
  const command = (action: () => void) => { action(); setMenu(null); };
  return <div ref={input} className="zt-drawing-input" style={{ pointerEvents: "none" }} tabIndex={-1} aria-label="Chart drawing interaction layer">
    {menu && selected && <div className="zt-drawing-context" role="menu" style={{ left: menu.x, top: menu.y, pointerEvents: "auto" }}>
      <button role="menuitem" type="button" onClick={() => command(() => props.onSelect(menu.id))}>Settings</button>
      <button role="menuitem" type="button" onClick={() => command(() => props.onDuplicate(menu.id))}>Duplicate</button>
      <button role="menuitem" type="button" onClick={() => command(() => props.onUpdate(menu.id, { zOrder: Math.max(...props.drawings.map(d => d.zOrder)) + 1 }))}>Bring forward</button>
      <button role="menuitem" type="button" onClick={() => command(() => props.onUpdate(menu.id, { zOrder: Math.min(...props.drawings.map(d => d.zOrder)) - 1 }))}>Send backward</button>
      <button role="menuitem" type="button" onClick={() => command(() => props.onUpdate(menu.id, { locked: !selected.locked }))}>{selected.locked ? "Unlock" : "Lock"}</button>
      <button role="menuitem" type="button" onClick={() => command(() => props.onUpdate(menu.id, { hidden: true }))}>Hide</button>
      <button role="menuitem" type="button" className="is-danger" disabled={selected.locked} onClick={() => command(() => props.onDelete(menu.id))}>Delete</button>
    </div>}
  </div>;
}
