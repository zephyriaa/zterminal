"use client";

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { Maximize2, Minimize2, Minus, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type DesktopWindowBounds = { x: number; y: number; width: number; height: number };
type ResizeEdge = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
type Interaction = { kind: "move" | "resize"; edge?: ResizeEdge; startX: number; startY: number; origin: DesktopWindowBounds };

type DesktopWindowProps = {
  id: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
  initialBounds: DesktopWindowBounds;
  minWidth?: number;
  minHeight?: number;
  icon?: ReactNode;
  className?: string;
  headerActions?: ReactNode;
  onClose?: () => void;
};

let topWindowZ = 40;

function clampBounds(bounds: DesktopWindowBounds, minWidth: number, minHeight: number) {
  const maxWidth = typeof window === "undefined" ? 1600 : Math.max(minWidth, window.innerWidth - 20);
  const maxHeight = typeof window === "undefined" ? 1000 : Math.max(minHeight, window.innerHeight - 150);
  const width = Math.min(maxWidth, Math.max(minWidth, bounds.width));
  const height = Math.min(maxHeight, Math.max(minHeight, bounds.height));
  const maxX = typeof window === "undefined" ? bounds.x : Math.max(6, window.innerWidth - Math.min(width, 180));
  const maxY = typeof window === "undefined" ? bounds.y : Math.max(6, window.innerHeight - Math.min(height, 120));
  return {
    x: Math.max(6, Math.min(maxX, bounds.x)),
    y: Math.max(6, Math.min(maxY, bounds.y)),
    width,
    height,
  };
}

function loadBounds(key: string, initialBounds: DesktopWindowBounds, minWidth: number, minHeight: number) {
  if (typeof window === "undefined") return initialBounds;
  try {
    const saved = JSON.parse(window.localStorage.getItem(key) ?? "null") as Partial<DesktopWindowBounds> | null;
    return clampBounds({ ...initialBounds, ...saved }, minWidth, minHeight);
  } catch {
    return clampBounds(initialBounds, minWidth, minHeight);
  }
}

export function DesktopWindow({
  id,
  title,
  subtitle,
  children,
  initialBounds,
  minWidth = 360,
  minHeight = 220,
  icon,
  className,
  headerActions,
  onClose,
}: DesktopWindowProps) {
  const storageKey = `zterminal.desktop-window.${id}.v1`;
  const initialBoundsRef = useRef(initialBounds);
  const [bounds, setBounds] = useState<DesktopWindowBounds>(initialBounds);
  const [mode, setMode] = useState<"normal" | "maximized" | "minimized">("normal");
  // A stable initial value keeps the server and client tree identical. Focus
  // interactions raise a window only after hydration, when module-local order
  // is meaningful in the active browser session.
  const [zIndex, setZIndex] = useState(40);
  const interaction = useRef<Interaction | null>(null);

  useEffect(() => {
    setBounds(loadBounds(storageKey, initialBoundsRef.current, minWidth, minHeight));
  }, [storageKey, minWidth, minHeight]);

  useEffect(() => {
    const resetLayout = () => {
      try { window.localStorage.removeItem(storageKey); } catch { /* optional persistence */ }
      setBounds(clampBounds(initialBoundsRef.current, minWidth, minHeight));
      setMode("normal");
      setZIndex(++topWindowZ);
    };
    window.addEventListener("zterminal:reset-layout", resetLayout);
    return () => window.removeEventListener("zterminal:reset-layout", resetLayout);
  }, [minHeight, minWidth, storageKey]);

  useEffect(() => {
    const move = (event: PointerEvent) => {
      const active = interaction.current;
      if (!active) return;
      const dx = event.clientX - active.startX;
      const dy = event.clientY - active.startY;
      const origin = active.origin;
      let next = origin;
      if (active.kind === "move") {
        next = { ...origin, x: origin.x + dx, y: origin.y + dy };
      } else {
        const edge = active.edge ?? "se";
        const includesN = edge.includes("n");
        const includesS = edge.includes("s");
        const includesW = edge.includes("w");
        const includesE = edge.includes("e");
        const width = origin.width + (includesE ? dx : includesW ? -dx : 0);
        const height = origin.height + (includesS ? dy : includesN ? -dy : 0);
        const clampedWidth = Math.max(minWidth, width);
        const clampedHeight = Math.max(minHeight, height);
        next = {
          x: includesW ? origin.x + (origin.width - clampedWidth) : origin.x,
          y: includesN ? origin.y + (origin.height - clampedHeight) : origin.y,
          width: clampedWidth,
          height: clampedHeight,
        };
      }
      setBounds(clampBounds(next, minWidth, minHeight));
    };
    const stop = () => {
      interaction.current = null;
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    };
  }, [minHeight, minWidth]);

  useEffect(() => {
    if (mode !== "normal") return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(bounds));
    } catch {
      // Local layout persistence is optional.
    }
  }, [bounds, mode, storageKey]);

  const focus = () => setZIndex(++topWindowZ);
  const beginMove = (event: ReactPointerEvent<HTMLElement>) => {
    if (mode !== "normal" || event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest("button, input, select, textarea, a, summary")) return;
    event.preventDefault();
    focus();
    interaction.current = { kind: "move", startX: event.clientX, startY: event.clientY, origin: bounds };
  };
  const beginResize = (edge: ResizeEdge, event: ReactPointerEvent<HTMLButtonElement>) => {
    if (mode !== "normal" || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    focus();
    interaction.current = { kind: "resize", edge, startX: event.clientX, startY: event.clientY, origin: bounds };
  };

  const style: CSSProperties = mode === "maximized"
    ? { inset: 0, zIndex }
    : { left: bounds.x, top: bounds.y, width: bounds.width, height: bounds.height, zIndex };

  if (mode === "minimized") {
    return (
      <button
        type="button"
        className="zt-window-task"
        style={{ zIndex }}
        onClick={() => { focus(); setMode("normal"); }}
        aria-label={`Restore ${title} window`}
      >
        {icon}<span>{title}</span><Maximize2 className="h-3.5 w-3.5" />
      </button>
    );
  }

  return (
    <section
      className={cn("zt-desktop-window", mode === "maximized" && "is-maximized", className)}
      style={style}
      onPointerDown={focus}
      aria-label={`${title} window`}
    >
      <header className="zt-desktop-window-titlebar" onPointerDown={beginMove}>
        <div className="zt-window-title-group">
          <span className="zt-window-grip" aria-hidden="true">⋮⋮</span>
          {icon && <span className="zt-window-title-icon" aria-hidden="true">{icon}</span>}
          <div className="min-w-0">
            {subtitle && <div className="zt-window-subtitle">{subtitle}</div>}
            <div className="zt-window-title">{title}</div>
          </div>
        </div>
        <div className="zt-window-title-actions" onPointerDown={(event) => event.stopPropagation()}>
          {headerActions}
          <button type="button" onClick={() => setMode("minimized")} aria-label={`Minimize ${title}`} title="Minimize"><Minus /></button>
          <button type="button" onClick={() => setMode((current) => current === "maximized" ? "normal" : "maximized")} aria-label={mode === "maximized" ? `Restore ${title}` : `Maximize ${title}`} title={mode === "maximized" ? "Restore" : "Maximize"}>{mode === "maximized" ? <Minimize2 /> : <Maximize2 />}</button>
          {onClose && <button type="button" className="is-close" onClick={onClose} aria-label={`Close ${title}`} title="Close"><X /></button>}
        </div>
      </header>
      <div className="zt-desktop-window-body">{children}</div>
      {(["n", "s", "e", "w", "ne", "nw", "se", "sw"] as ResizeEdge[]).map((edge) => (
        <button key={edge} type="button" className={`zt-window-resize zt-window-resize-${edge}`} onPointerDown={(event) => beginResize(edge, event)} aria-label={`Resize ${title} window`} tabIndex={-1} />
      ))}
    </section>
  );
}
