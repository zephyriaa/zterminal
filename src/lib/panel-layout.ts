export type Placement = "center" | "left" | "right" | "bottom" | "floating";
export type Bounds = { x: number; y: number; width: number; height: number };
export type PanelRecord = { id: string; title: string; placement: Placement; bounds: Bounds; status: "open" | "minimized" | "closed"; maximized: boolean; order: number };
export type PanelLayout = { panels: Record<string, PanelRecord>; left: number; right: number; bottom: number; active: string };
export const emptyLayout = (): PanelLayout => ({ panels: {}, left: 280, right: 420, bottom: 300, active: "chart" });
export function clampPanel(bounds: Bounds, width: number, height: number): Bounds {
  const finite = (n: number, fallback: number) => Number.isFinite(n) ? n : fallback;
  const w = Math.min(width, Math.max(Math.min(240, width), finite(bounds.width, 420)));
  const h = Math.min(height, Math.max(Math.min(160, height), finite(bounds.height, 300)));
  return { width: w, height: h, x: Math.max(0, Math.min(width - w, finite(bounds.x, 0))), y: Math.max(0, Math.min(height - h, finite(bounds.y, 0))) };
}
export function panelBounds(layout: PanelLayout, id: string, width: number, height: number): Bounds {
  const panel = layout.panels[id];
  if (!panel || width < 768 || panel.maximized) return { x: 0, y: 0, width, height };
  if (panel.placement === "floating") return clampPanel(panel.bounds, width, height);
  const group = (placement: Placement) => Object.values(layout.panels).filter(p => p.status === "open" && p.placement === placement).sort((a, b) => a.id.localeCompare(b.id));
  const left = group("left").length ? Math.min(layout.left, width * .28) : 0;
  const right = group("right").length ? Math.min(layout.right, width * .38) : 0;
  const bottom = group("bottom").length ? Math.min(layout.bottom, height * .55) : 0;
  const members = group(panel.placement), index = Math.max(0, members.findIndex(p => p.id === id)), count = Math.max(1, members.length);
  if (panel.placement === "left" || panel.placement === "right") return { x: panel.placement === "left" ? 0 : width - right, y: index * height / count, width: panel.placement === "left" ? left : right, height: height / count };
  const centralWidth = width - left - right;
  if (panel.placement === "bottom") return { x: left + index * centralWidth / count, y: height - bottom, width: centralWidth / count, height: bottom };
  return { x: left, y: 0, width: centralWidth, height: height - bottom };
}
export function defaultPlacement(id: string): Placement {
  return id === "chart" ? "center" : id === "strategy" ? "right" : id === "backtester" ? "bottom" : id === "indicators" ? "left" : "floating";
}

/** Old records are copied, never removed. Malformed or offscreen values are clamped. */
export function migrateLegacyPanel(id: string, initial: Bounds, read: (key: string) => string | null): Bounds {
  try {
    const old = JSON.parse(read(`zterminal.desktop-window.${id}.v1`) ?? "null");
    return old && typeof old === "object" ? { ...initial, ...old } : initial;
  } catch { return initial; }
}
