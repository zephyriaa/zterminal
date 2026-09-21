import type { DockviewApi, SerializedDockview } from "dockview-core";

export const WORKSPACE_LAYOUT_KEY = "zt_workspace_layout_v2";
export const PANEL_DEFINITIONS = {
  chart: { component: "chart", title: "Primary Chart" },
  orderbook: { component: "orderbook", title: "Order Book / Context" },
  research: { component: "research", title: "Research Report" },
  strategy: { component: "strategy", title: "Python Strategy" },
  indicators: { component: "indicators", title: "Indicators" },
  calendar: { component: "calendar", title: "Economic Calendar" },
  settings: { component: "settings", title: "Terminal Preferences" },
  "chart-settings": { component: "chart-settings", title: "Chart Settings" },
} as const;
export type DockPanelId = keyof typeof PANEL_DEFINITIONS;
export const REQUIRED_PANELS: DockPanelId[] = ["chart", "orderbook", "research", "strategy"];
export function isDockPanelId(id: string): id is DockPanelId {
  return Object.hasOwn(PANEL_DEFINITIONS, id);
}

export function buildDefaultLayout(api: DockviewApi) {
  const chart = api.addPanel({ id: "chart", ...PANEL_DEFINITIONS.chart });
  const book = api.addPanel({ id: "orderbook", ...PANEL_DEFINITIONS.orderbook, position: { referencePanel: chart.id, direction: "right" } });
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

function validateSavedLayout(value: unknown): asserts value is SerializedDockview {
  if (!value || typeof value !== "object") throw new Error("Invalid workspace");
  const layout = value as SerializedDockview;
  if (layout.grid?.root?.type !== "branch" || !layout.panels || typeof layout.panels !== "object") throw new Error("Incompatible workspace");
  for (const [id, panel] of Object.entries(layout.panels)) {
    if (!isDockPanelId(id) || panel.id !== id || panel.contentComponent !== PANEL_DEFINITIONS[id].component || panel.tabComponent) throw new Error("Unknown workspace panel");
  }
  if (REQUIRED_PANELS.some(id => !Object.hasOwn(layout.panels, id))) throw new Error("Incomplete workspace");
}

/** Only Dockview-produced state is restored. Failed restores never become defaults. */
export function initializeWorkspace(api: DockviewApi, storage: Storage) {
  try {
    const saved = storage.getItem(WORKSPACE_LAYOUT_KEY);
    if (saved) {
      const layout: unknown = JSON.parse(saved);
      validateSavedLayout(layout);
      api.fromJSON(layout);
      if (REQUIRED_PANELS.some(id => !api.getPanel(id))) throw new Error("Missing workspace panel");
      // Maximization is a viewport choice, not a saved desktop layout preference.
      api.exitMaximizedGroup();
      return;
    }
  } catch {
    discardWorkspaceLayout(storage);
    api.clear();
  }
  buildDefaultLayout(api);
}

/** Attach only after initialization; flush pending changes before route teardown. */
export function persistWorkspace(api: DockviewApi, storage: Storage, delay = 250) {
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
      buildDefaultLayout(api);
      schedule();
    },
    flush,
    dispose() { disposed = true; listener.dispose(); if (timer) flush(); },
  };
}
