import type { DockviewApi, SerializedDockview } from "dockview-core";
import type { WorkspaceStarter } from "./workspaces/model";

export const WORKSPACE_LAYOUT_KEY = "zt_workspace_layout_v2";
export const PANEL_DEFINITIONS = {
  chart: { component: "chart", title: "Primary Chart" },
  orderbook: { component: "orderbook", title: "Order Book / Context" },
  gex: { component: "gex", title: "Deribit GEX Surface" },
  research: { component: "research", title: "Research Report" },
  strategy: { component: "strategy", title: "Python Strategy" },
  indicators: { component: "indicators", title: "Indicators" },
  calendar: { component: "calendar", title: "Economic Calendar" },
  settings: { component: "settings", title: "Terminal Preferences" },
  "chart-settings": { component: "chart-settings", title: "Chart Settings" },
} as const;
export type DockPanelId = keyof typeof PANEL_DEFINITIONS;
export const REQUIRED_PANELS: DockPanelId[] = [];
export function isDockPanelId(id: string): id is DockPanelId {
  return Object.hasOwn(PANEL_DEFINITIONS, id);
}

export function buildDefaultLayout(api: DockviewApi, starter?: WorkspaceStarter) {
  const chart = api.addPanel({ id: "chart", ...PANEL_DEFINITIONS.chart });
  if (starter === "chart") { chart.api.setActive(); return; }
  if (starter === "research") {
    const editor = api.addPanel({ id: "strategy", ...PANEL_DEFINITIONS.strategy, position: { referencePanel: chart.id, direction: "right" } });
    chart.api.setSize({ width: Math.round(api.width * 0.45) }); editor.api.setActive(); return;
  }
  const book = api.addPanel({ id: "orderbook", ...PANEL_DEFINITIONS.orderbook, position: { referencePanel: chart.id, direction: "right" } });
  if (starter === "orderflow") { chart.api.setSize({ width: Math.round(api.width * 0.7) }); chart.api.setActive(); return; }
  const report = api.addPanel({ id: "research", ...PANEL_DEFINITIONS.research, position: { referencePanel: book.id, direction: "below" } });
  api.addPanel({ id: "strategy", ...PANEL_DEFINITIONS.strategy, position: { referencePanel: report.id, direction: "within" }, inactive: true });
  chart.api.setSize({ width: Math.round(api.width * 0.7) });
  book.api.setSize({ height: Math.round(api.height * 0.5) });
  chart.api.setActive();
}

type Storage = Pick<globalThis.Storage, "getItem" | "setItem" | "removeItem">;
export function discardWorkspaceLayout(storage?: Storage) {
  try { (storage ?? window.localStorage).removeItem(WORKSPACE_LAYOUT_KEY); } catch { /* Private mode still supports an in-memory workspace. */ }
}

export function validateSavedLayout(value: unknown): asserts value is SerializedDockview {
  if (!value || typeof value !== "object") throw new Error("Invalid workspace");
  const layout = value as SerializedDockview;
  if (layout.grid?.root?.type !== "branch" || !layout.panels || typeof layout.panels !== "object") throw new Error("Incompatible workspace");
  for (const [id, panel] of Object.entries(layout.panels)) {
    if (!isDockPanelId(id) || panel.id !== id || panel.contentComponent !== PANEL_DEFINITIONS[id].component || panel.tabComponent) throw new Error("Unknown workspace panel");
  }
}

/** Only Dockview-produced state is restored. Failed restores never become defaults. */
export function initializeWorkspace(api: DockviewApi, storage: Storage, starter?: WorkspaceStarter) {
  try {
    const saved = storage.getItem(WORKSPACE_LAYOUT_KEY);
    if (saved) {
      const layout: unknown = JSON.parse(saved);
      validateSavedLayout(layout);
      api.fromJSON(layout);
      if (Object.keys(layout.panels).some(id => !api.getPanel(id))) throw new Error("Missing restored workspace panel");
      // Maximization is a viewport choice, not a saved desktop layout preference.
      api.exitMaximizedGroup();
      return;
    }
  } catch (error) {
    if (starter) { api.clear(); throw new Error(`The saved panel layout could not be restored: ${(error as Error).message}. Reset its layout explicitly to recover.`); }
    discardWorkspaceLayout(storage);
    api.clear();
  }
  buildDefaultLayout(api, starter);
}

/** Attach only after initialization; flush pending changes before route teardown. */
export function persistWorkspace(api: DockviewApi, storage: Storage, delay = 250, starter?: WorkspaceStarter) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;
  const flush = () => {
    clearTimeout(timer);
    timer = undefined;
    try { storage.setItem(WORKSPACE_LAYOUT_KEY, JSON.stringify(api.toJSON())); } catch { /* Storage may be disabled or full. */ }
  };
  const schedule = () => { if (!disposed) { clearTimeout(timer); timer = setTimeout(flush, delay); } };
  const listener = api.onDidLayoutChange(schedule);
  schedule();
  return {
    reset() {
      clearTimeout(timer);
      discardWorkspaceLayout(storage);
      api.clear();
      buildDefaultLayout(api, starter);
      schedule();
    },
    flush,
    dispose() { disposed = true; listener.dispose(); if (timer) flush(); },
  };
}
