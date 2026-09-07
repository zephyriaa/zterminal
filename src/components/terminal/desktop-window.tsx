"use client";
import { useEffect, useRef, useState, type ReactNode, type PointerEvent } from "react";
import { Maximize2, Minimize2, Minus, X } from "lucide-react";
import { usePanels } from "@/stores/panels";
import { clampPanel, migrateLegacyPanel, panelBounds, type Bounds, type Placement } from "@/lib/panel-layout";
import { cn } from "@/lib/utils";
export type DesktopWindowBounds = Bounds;
type Props = { id: string; title: string; subtitle?: string; children: ReactNode; initialBounds: Bounds; minWidth?: number; minHeight?: number; icon?: ReactNode; className?: string; headerActions?: ReactNode; onClose?: () => void };

/** Docking, minimizing and closing preserve mounted content and its draft state. */
export function DesktopWindow({ id, title, subtitle, children, initialBounds, icon, className, headerActions, onClose }: Props) {
  const state = usePanels();
  const panel = state.panels[id];
  const initial = useRef(initialBounds);
  const [opened, setOpened] = useState(false);
  const [preview, setPreview] = useState<Bounds | null>(null);
  const drag = useRef<{ x: number; y: number; bounds: Bounds; move: boolean; placement: Placement; last: Bounds } | null>(null);
  useEffect(() => { state.register(id, title, migrateLegacyPanel(id, initial.current, key => localStorage.getItem(key))); }, [id, title, state.register]);
  useEffect(() => {
    if (panel?.status === "open") { const timer = setTimeout(() => setOpened(true), 0); return () => clearTimeout(timer); }
  }, [panel?.status]);
  useEffect(() => {
    const move = (event: globalThis.PointerEvent) => {
      const action = drag.current;
      if (!action) return;
      const dx = event.clientX - action.x, dy = event.clientY - action.y;
      const viewport = usePanels.getState().viewport;
      let next = action.bounds;
      if (action.move) next = { ...next, x: next.x + dx, y: next.y + dy };
      else if (action.placement === "right") next = { ...next, x: next.x + dx, width: next.width - dx };
      else if (action.placement === "bottom") next = { ...next, y: next.y + dy, height: next.height - dy };
      else next = { ...next, width: next.width + dx, height: action.placement === "floating" ? next.height + dy : next.height };
      action.last = clampPanel(next, viewport.width, viewport.height);
      setPreview(action.last);
    };
    const stop = () => {
      const action = drag.current;
      if (!action) return;
      const store = usePanels.getState();
      if (action.placement === "floating") store.patch(id, { bounds: action.last });
      else store.resizeDock(action.placement, action.placement === "bottom" ? action.last.height : action.last.width);
      drag.current = null; setPreview(null);
    };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", stop); window.addEventListener("pointercancel", stop);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", stop); window.removeEventListener("pointercancel", stop); };
  }, [id]);
  if (!panel) return null;
  const { width, height } = state.viewport;
  const narrow = width < 768;
  const selected = state.panels[state.active]?.status === "open" ? state.active : Object.values(state.panels).find(p => p.status === "open")?.id;
  const hidden = panel.status !== "open" || (narrow && selected !== id);
  const bounds = preview ?? panelBounds(state, id, width, height);
  const begin = (event: PointerEvent, move: boolean) => {
    if (event.button !== 0 || narrow || panel.maximized || (move && panel.placement !== "floating")) return;
    if (move && (event.target as HTMLElement).closest("button, select, input, a")) return;
    event.preventDefault();
    drag.current = { x: event.clientX, y: event.clientY, bounds, move, placement: panel.placement, last: bounds };
  };
  const focus = () => { if (state.active !== id) state.focus(id); };
  return <section id={`panel-${id}`} tabIndex={-1} hidden={hidden} aria-label={`${title} panel`} onFocusCapture={focus} onPointerDown={focus} className={cn("zt-desktop-window zt-managed-panel", panel.placement !== "floating" && "zt-docked-panel", className)} style={{ left: bounds.x, top: bounds.y, width: bounds.width, height: bounds.height, zIndex: panel.maximized ? 500 : panel.placement === "floating" ? 50 + panel.order : 1, display: hidden ? "none" : "flex" }}>
    <header className="zt-desktop-window-titlebar" onPointerDown={event => begin(event, true)}>
      <div className="zt-window-title-group">{icon}<div className="min-w-0"><div className="zt-window-title">{title}</div>{subtitle && <div className="zt-window-subtitle">{subtitle}</div>}</div></div>
      <div className="zt-window-title-actions" onPointerDown={event => event.stopPropagation()}>
        {headerActions}<select aria-label={`Place ${title} panel`} value={panel.placement} onChange={event => state.place(id, event.target.value as Placement)} className="zt-panel-placement">
          {id === "chart" && <option value="center">Center</option>}<option value="left">Left</option><option value="right">Right</option><option value="bottom">Bottom</option><option value="floating">Float</option>
        </select>
        <button type="button" onClick={() => state.patch(id, { status: "minimized" })} aria-label={`Minimize ${title}`} title="Minimize to task strip"><Minus /></button>
        <button type="button" onClick={() => state.patch(id, { maximized: !panel.maximized })} aria-label={`${panel.maximized ? "Restore" : "Maximize"} ${title}`} title="Maximize or restore">{panel.maximized ? <Minimize2 /> : <Maximize2 />}</button>
        {onClose && <button type="button" onClick={() => state.patch(id, { status: "closed" })} aria-label={`Close ${title}`} title="Close panel; keep work"><X /></button>}
      </div>
    </header>
    <div className="zt-desktop-window-body">{(opened || panel.status === "open") && children}</div>
    {!narrow && !panel.maximized && panel.placement !== "center" && <button type="button" className={`zt-panel-resizer at-${panel.placement}`} aria-label={`Resize ${title} panel; use arrow keys`} onPointerDown={event => begin(event, false)} onKeyDown={event => {
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
      event.preventDefault();
      const delta = ["ArrowRight", "ArrowDown"].includes(event.key) ? 20 : -20;
      if (panel.placement === "floating") state.patch(id, { bounds: clampPanel({ ...bounds, width: bounds.width + (["ArrowRight", "ArrowLeft"].includes(event.key) ? delta : 0), height: bounds.height + (["ArrowUp", "ArrowDown"].includes(event.key) ? delta : 0) }, width, height) });
      else state.resizeDock(panel.placement, panel.placement === "bottom" ? bounds.height - delta : bounds.width + (panel.placement === "right" ? -delta : delta));
    }} />}
  </section>;
}
