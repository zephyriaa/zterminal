import test from "node:test";
import assert from "node:assert/strict";
import { defaultDrawingStyle, sanitizeDrawing, type DrawingObject } from "../src/lib/chart/contracts";
import { distanceToSegment, drawingHit, isDrawingVisible, moveAnchors, nearestAnchor } from "../src/lib/chart/drawings/geometry";

const instrument = { provider: "binance" as const, exchange: "BINANCE" as const, product: "perpetual" as const, nativeSymbol: "BTCUSDT" };
const base: DrawingObject = { schemaVersion: 1, id: "line-1", type: "trend-line", instrument, chartId: "chart", anchors: [{ time: 100, price: 10 }, { time: 200, price: 20 }], style: defaultDrawingStyle("trend-line"), visibility: { timeframes: "all" }, locked: false, hidden: false, zOrder: 0, createdAt: 1, updatedAt: 1 };

test("drawing sanitation preserves only the exact chart and instrument", () => {
  assert.equal(sanitizeDrawing(base, { instrument, chartId: "chart" })?.id, "line-1");
  assert.equal(sanitizeDrawing({ ...base, instrument: { ...instrument, provider: "gateio" } }, { instrument, chartId: "chart" }), null);
  assert.equal(sanitizeDrawing({ ...base, anchors: [{ time: 1, price: 1 }] }, { instrument, chartId: "chart" }), null);
});

test("drawing geometry hit tests lines, boxes, and handles deterministically", () => {
  assert.equal(distanceToSegment({ x: 5, y: 2 }, { x: 0, y: 0 }, { x: 10, y: 0 }), 2);
  const line = { drawing: base, points: [{ x: 0, y: 0 }, { x: 10, y: 10 }] };
  assert.equal(drawingHit(line, { x: 5, y: 5 }, 1), true);
  assert.equal(nearestAnchor(line, { x: 1, y: 1 }, 2), 0);
  const box = { drawing: { ...base, type: "rectangle" as const }, points: [{ x: 0, y: 0 }, { x: 20, y: 20 }] };
  assert.equal(drawingHit(box, { x: 0, y: 10 }, 1), true);
  assert.equal(drawingHit(box, { x: 10, y: 10 }, 1), false);
});

test("drawing movement and replay visibility cannot reveal future anchors", () => {
  assert.deepEqual(moveAnchors(base.anchors, { time: 100, price: 10 }, { time: 150, price: 8 }), [{ time: 150, price: 8 }, { time: 250, price: 18 }]);
  assert.equal(isDrawingVisible(base, "5m", 199), false);
  assert.equal(isDrawingVisible(base, "5m", 200), true);
  assert.equal(isDrawingVisible({ ...base, hidden: true }, "5m", 200), false);
  assert.equal(isDrawingVisible({ ...base, visibility: { timeframes: ["1h"] } }, "5m", 200), false);
});
