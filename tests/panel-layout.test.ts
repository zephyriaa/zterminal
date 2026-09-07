import test from "node:test";
import assert from "node:assert/strict";
import { clampPanel, emptyLayout, panelBounds, migrateLegacyPanel, type PanelRecord } from "../src/lib/panel-layout";
const panel = (id: string, placement: PanelRecord["placement"]): PanelRecord => ({ id, title: id, placement, bounds: { x: 0, y: 0, width: 400, height: 300 }, status: "open", maximized: false, order: 1 });
test("docked editor and report share available chart space without overlap", () => {
  const state = { ...emptyLayout(), panels: { chart: panel("chart", "center"), strategy: panel("strategy", "right"), backtester: panel("backtester", "bottom") } };
  const chart = panelBounds(state, "chart", 1200, 800), editor = panelBounds(state, "strategy", 1200, 800), report = panelBounds(state, "backtester", 1200, 800);
  assert.equal(chart.width, editor.x);
  assert.equal(chart.height, report.y);
  assert.equal(report.width, chart.width);
  state.panels.strategy.status = "minimized";
  assert.equal(panelBounds(state, "chart", 1200, 800).width, 1200);
  state.panels.strategy.status = "open";
  assert.deepEqual(panelBounds(state, "strategy", 1200, 800), editor);
});
test("bounds restore entirely inside the viewport, including narrow screens", () => {
  const restored = clampPanel({ x: 2000, y: -10, width: 1800, height: 900 }, 390, 700);
  assert.deepEqual(restored, { x: 0, y: 0, width: 390, height: 700 });
  assert.equal(clampPanel({ x: NaN, y: Infinity, width: NaN, height: 200 }, 900, 700).x, 0);
});
test("legacy layout migration reads without changing or deleting the source", () => {
  const initial = { x: 0, y: 0, width: 400, height: 300 };
  assert.deepEqual(migrateLegacyPanel("chart", initial, () => '{"x":45}'), { ...initial, x: 45 });
  assert.deepEqual(migrateLegacyPanel("chart", initial, () => "invalid"), initial);
});
