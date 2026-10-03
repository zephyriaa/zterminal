import test from "node:test";
import assert from "node:assert/strict";
import { defaultDrawingStyle, sanitizeDrawing, type DrawingObject } from "../src/lib/chart/contracts";
import { distanceToSegment, drawingHit, isDrawingVisible, isPositionTimeEdge, moveAnchors, nearestAnchor, resizePositionTime, snapDrawingAnchor } from "../src/lib/chart/drawings/geometry";

const instrument = { provider: "binance" as const, exchange: "BINANCE" as const, product: "perpetual" as const, nativeSymbol: "BTCUSDT" };
const base: DrawingObject = { schemaVersion: 1, id: "line-1", type: "trend-line", instrument, chartId: "chart", anchors: [{ time: 100, price: 10 }, { time: 200, price: 20 }], style: defaultDrawingStyle("trend-line"), visibility: { timeframes: "all" }, locked: false, hidden: false, zOrder: 0, createdAt: 1, updatedAt: 1 };

test("long/short right borders resize time without moving entry, target or stop", () => {
  for (const type of ["long-position", "short-position"] as const) {
    const drawing = { ...base, type, style: { ...defaultDrawingStyle(type), stopPrice: 5 } };
    const projected = { drawing, points: [{ x: 10, y: 50 }, { x: 60, y: 20 }, { x: 60, y: 80 }] };
    assert.equal(isPositionTimeEdge(projected, { x: 60, y: 40 }), true);
    assert.equal(isPositionTimeEdge(projected, { x: 30, y: 40 }), false);
    assert.equal(isPositionTimeEdge(projected, { x: 60, y: 100 }), false);
    assert.equal(isPositionTimeEdge({ ...projected, drawing: { ...drawing, locked: true } }, { x: 60, y: 40 }), false);
    assert.deepEqual(resizePositionTime(drawing, 500), [drawing.anchors[0], { ...drawing.anchors[1], time: 500 }]);
    assert.deepEqual(resizePositionTime(drawing, 50), [drawing.anchors[0], { ...drawing.anchors[1], time: 50 }]);
    assert.equal(drawing.style.stopPrice, 5);
    assert.equal(drawing.anchors[1].time, 200);
  }
  assert.equal(isPositionTimeEdge({ drawing: base, points: [{ x: 10, y: 50 }, { x: 60, y: 20 }] }, { x: 60, y: 40 }), false);
});

test("magnet preserves future/past space and snaps only observed candles", () => {
  const bars = [{ t: 100, o: 10, h: 12, l: 9, c: 11, v: 1 }, { t: 200, o: 11, h: 13, l: 10, c: 12, v: 1 }];
  for (const mode of ["weak", "strong"] as const) {
    assert.deepEqual(snapDrawingAnchor({ time: 250, price: 12.01 }, bars, mode), { time: 250, price: 12.01 });
    assert.deepEqual(snapDrawingAnchor({ time: 50, price: 10 }, bars, mode), { time: 50, price: 10 });
    assert.deepEqual(snapDrawingAnchor({ time: 190, price: 12.01 }, bars, mode), { time: 200, price: 12 });
  }
  assert.deepEqual(snapDrawingAnchor({ time: 190, price: 20 }, bars, "weak"), { time: 190, price: 20 });
});

test("ray, extended line and date-range hit tests match their visible geometry", () => {
  const points = [{ x: 10, y: 10 }, { x: 20, y: 20 }];
  const hit = (type: DrawingObject["type"], point: { x: number; y: number }) => drawingHit({ drawing: { ...base, type }, points }, point, 1);
  assert.equal(hit("ray", { x: 50, y: 50 }), true);
  assert.equal(hit("ray", { x: 0, y: 0 }), false);
  assert.equal(hit("extended-line", { x: 0, y: 0 }), true);
  assert.equal(hit("horizontal-ray", { x: 50, y: 10 }), true);
  assert.equal(hit("horizontal-ray", { x: 50, y: 50 }), false);
  assert.equal(hit("date-range", { x: 15, y: 200 }), true);
  assert.equal(hit("date-range", { x: 50, y: 200 }), false);
  assert.equal(drawingHit({ drawing: { ...base, style: { ...base.style, extendEnd: true } }, points }, { x: 50, y: 50 }, 1), true);
});

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

test("long and short position drawings have TradingView defaults and 3-point hit testing", () => {
  const longStyle = defaultDrawingStyle("long-position");
  assert.equal(longStyle.targetColor, "#22c55e");
  assert.equal(longStyle.stopColor, "#ef4444");
  assert.equal(longStyle.riskReward, 2);

  const shortStyle = defaultDrawingStyle("short-position");
  assert.equal(shortStyle.targetColor, "#22c55e");
  assert.equal(shortStyle.stopColor, "#ef4444");
  assert.equal(shortStyle.riskReward, 2);

  const longDrawing: DrawingObject = {
    ...base,
    id: "pos-1",
    type: "long-position",
    style: longStyle,
  };

  // Points: [Entry (0, 50), Target (50, 20), Stop (50, 80)]
  const projectedLong = {
    drawing: longDrawing,
    points: [{ x: 0, y: 50 }, { x: 50, y: 20 }, { x: 50, y: 80 }],
  };

  // Target profit zone (y between 20 and 50)
  assert.equal(drawingHit(projectedLong, { x: 25, y: 35 }, 2), true);
  // Stop loss zone (y between 50 and 80)
  assert.equal(drawingHit(projectedLong, { x: 25, y: 65 }, 2), true);
  // Stop anchor hit test
  assert.equal(nearestAnchor(projectedLong, { x: 50, y: 80 }, 3), 2);
  // Outside
  assert.equal(drawingHit(projectedLong, { x: 100, y: 35 }, 2), false);
});
