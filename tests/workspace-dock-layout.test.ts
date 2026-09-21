import test from "node:test";
import assert from "node:assert/strict";
import type { DockviewApi, SerializedDockview } from "dockview-core";
import { initializeWorkspace, persistWorkspace, WORKSPACE_LAYOUT_KEY, REQUIRED_PANELS, PANEL_DEFINITIONS } from "../src/lib/workspace-dock-layout";

// Captured from Dockview 8.3.1 toJSON() in the browser, never used as a default.
const savedLayout = {
  grid: { root: { type: "branch", data: [
    { type: "leaf", data: { views: ["chart"], activeView: "chart", id: "1" }, size: 872 },
    { type: "branch", data: [
      { type: "leaf", data: { views: ["orderbook"], activeView: "orderbook", id: "2" }, size: 429 },
      { type: "leaf", data: { views: ["research", "strategy"], activeView: "research", id: "3" }, size: 429 },
    ], size: 374 },
  ], size: 858 }, width: 1246, height: 858, orientation: "HORIZONTAL" },
  panels: Object.fromEntries(REQUIRED_PANELS.map(id => [id, { id, contentComponent: PANEL_DEFINITIONS[id].component, title: PANEL_DEFINITIONS[id].title }])), activeGroup: "1",
};

function harness(saved?: string, restoreFailure = false, omitChartOnRestore = false) {
  const values = new Map<string, string>(saved ? [[WORKSPACE_LAYOUT_KEY, saved]] : []);
  const calls: string[] = [];
  const panels = new Map<string, unknown>();
  const listeners = new Set<() => void>();
  const change = () => listeners.forEach(listener => listener());
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); calls.push("write"); }, removeItem: (key: string) => { values.delete(key); calls.push("discard"); } };
  const api = {
    width: 1200, height: 800,
    addPanel(options: { id: string; position?: unknown }) { calls.push(`add:${options.id}`); const panel = { id: options.id, api: { setActive: () => calls.push(`active:${options.id}`), setSize: () => {} } }; panels.set(options.id, panel); change(); return panel; },
    clear() { calls.push("clear"); panels.clear(); change(); },
    fromJSON(layout: SerializedDockview) { calls.push("restore"); if (restoreFailure) throw new Error("dockview: invalid schema"); Object.keys(layout.panels).forEach(id => { if (id !== "chart" || !omitChartOnRestore) panels.set(id, {}); }); },
    getPanel: (id: string) => panels.get(id),
    exitMaximizedGroup() {},
    toJSON: () => savedLayout,
    onDidLayoutChange(listener: () => void) { listeners.add(listener); return { dispose: () => { listeners.delete(listener); } }; },
  } as unknown as DockviewApi;
  return { api, storage, calls, values, listeners, change };
}
test("no saved layout uses addPanel and activates the primary chart", () => {
  const h = harness(); initializeWorkspace(h.api, h.storage);
  assert.deepEqual(h.calls.filter(call => call.startsWith("add:")), REQUIRED_PANELS.map(id => `add:${id}`));
  assert.equal(h.calls.at(-1), "active:chart"); assert.ok(!h.calls.includes("restore"));
});
test("valid Dockview state restores without rebuilding", () => {
  const h = harness(JSON.stringify(savedLayout)); initializeWorkspace(h.api, h.storage);
  assert.deepEqual(h.calls, ["restore"]);
});
for (const [name, saved] of [
  ["malformed JSON", "{"],
  ["obsolete splitview", JSON.stringify({ grid: { root: { type: "splitview", views: [] } } })],
  ["missing required chart", JSON.stringify({ ...savedLayout, panels: { ...savedLayout.panels, chart: undefined } })],
  ["unknown component", JSON.stringify({ ...savedLayout, panels: { ...savedLayout.panels, chart: { id: "chart", contentComponent: "missing" } } })],
] as const) test(`${name} is discarded and never passed to fromJSON`, () => {
  const h = harness(saved); initializeWorkspace(h.api, h.storage);
  assert.deepEqual(h.calls.slice(0, 3), ["discard", "clear", "add:chart"]);
  assert.ok(!h.calls.includes("restore")); assert.equal(h.values.size, 0);
});
for (const failure of ["schema", "missing restored chart"] as const) test(`${failure} rebuilds once after a failed restore`, () => {
  const h = harness(JSON.stringify(savedLayout), failure === "schema", failure !== "schema"); initializeWorkspace(h.api, h.storage);
  assert.equal(h.calls.filter(call => call === "restore").length, 1);
  assert.ok(h.calls.includes("clear")); assert.equal(h.calls.at(-1), "active:chart");
});
test("reset discards old state, rebuilds, debounces subsequent writes and disposes", async () => {
  const h = harness(); initializeWorkspace(h.api, h.storage);
  const persistence = persistWorkspace(h.api, h.storage, 10);
  persistence.reset(); h.change(); h.change();
  assert.equal(h.values.size, 0);
  await new Promise(resolve => setTimeout(resolve, 30));
  assert.equal(h.calls.filter(call => call === "write").length, 1);
  assert.deepEqual(JSON.parse(h.values.get(WORKSPACE_LAYOUT_KEY)!), savedLayout);
  h.change(); persistence.dispose(); assert.equal(h.listeners.size, 0);
  const count = h.calls.length; h.change(); await new Promise(resolve => setTimeout(resolve, 30)); assert.equal(h.calls.length, count);
});
test("unavailable browser storage still initializes and resets", () => {
  const h = harness(); const storage = { getItem() { throw new Error("Denied"); }, setItem() { throw new Error("Full"); }, removeItem() { throw new Error("Denied"); } };
  initializeWorkspace(h.api, storage);
  const persistence = persistWorkspace(h.api, storage); persistence.reset(); persistence.dispose();
  assert.ok(h.api.getPanel("chart"));
});
