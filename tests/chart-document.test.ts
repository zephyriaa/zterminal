import test from "node:test";
import assert from "node:assert/strict";
import { createChartDocument, migrateChartDocument, sanitizeChartSettings } from "../src/lib/chart/contracts";

const btc = { provider: "binance" as const, exchange: "BINANCE" as const, product: "perpetual" as const, nativeSymbol: "BTCUSDT" };

test("chart documents isolate provider and instrument identity", () => {
  const first = createChartDocument({ instrument: btc, timeframe: "5m", now: 1 });
  const second = createChartDocument({ instrument: { ...btc, nativeSymbol: "ETHUSDT" }, timeframe: "5m", now: 1 });
  assert.notEqual(first.id, second.id);
  assert.equal(first.schemaVersion, 2);
});

test("chart settings migration clamps unsafe persisted values", () => {
  const settings = sanitizeChartSettings({ futureBars: 999, gridOpacity: -1, scaleMode: "bad", candleUpColor: "red", scaleMarginTop: 2 });
  assert.equal(settings.futureBars, 80);
  assert.equal(settings.gridOpacity, 0);
  assert.equal(settings.scaleMode, "normal");
  assert.equal(settings.candleUpColor, "#34d399");
  assert.equal(settings.scaleMarginTop, 0.4);
});

test("malformed and cross-instrument drawings are not migrated", () => {
  const fallback = createChartDocument({ instrument: btc, timeframe: "1h", now: 1 });
  const wrong = migrateChartDocument({ ...fallback, panes: [{ id: "volume", height: 9, visible: false }], drawings: [{ chartId: fallback.chartId, instrument: { ...btc, nativeSymbol: "ETHUSDT" } }] }, fallback);
  assert.equal(wrong.panes.find(pane => pane.id === "volume")?.height, 0.45);
  assert.equal(wrong.panes.find(pane => pane.id === "volume")?.visible, false);
  assert.deepEqual(wrong.drawings, []);
});
