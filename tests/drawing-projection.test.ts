import test from "node:test";
import assert from "node:assert/strict";
import type { IChartApi, ISeriesApi } from "lightweight-charts";
import { coordinateToDrawingAnchor, drawingAnchorToCoordinate } from "../src/lib/chart/drawing-coordinates";
import { DrawingPrimitive } from "../src/lib/chart/drawings/primitive";
import { defaultDrawingStyle, type DrawingObject } from "../src/lib/chart/contracts";

function fixture(times = [1000, 1060, 1120]) {
  const scale = {
    coordinateToLogical: (x: number) => x / 10,
    logicalToCoordinate: (i: number) => i * 10,
    coordinateToTime: (x: number) => times[Math.round(x / 10)] ?? null,
    timeToIndex: (time: number, nearest = false) => {
      const i = times.findIndex(t => t >= time);
      return i < 0 ? nearest ? times.length - 1 : null : times[i] === time || nearest ? i : null;
    },
  };
  const chart = { timeScale: () => scale } as unknown as IChartApi;
  let onDataChanged = () => {};
  let reads = 0;
  const series = { subscribeDataChanged: (callback: () => void) => { onDataChanged = callback; }, data: () => { reads++; return times.map(time => ({ time, value: 10 })); }, coordinateToPrice: (y: number) => 100 - y, priceToCoordinate: (price: number) => 100 - price } as unknown as ISeriesApi<"Line">;
  return { chart, series, append: (time: number) => { times.push(time); onDataChanged(); }, reads: () => reads };
}

test("future and fractional drawing anchors round-trip without creating candles", () => {
  const { chart, series } = fixture();
  for (const x of [-15, 0, 5, 15, 20, 35, 100]) {
    const anchor = coordinateToDrawingAnchor(chart, series, { x, y: 20 }, 60);
    assert.ok(anchor);
    assert.deepEqual(drawingAnchorToCoordinate(chart, series, anchor, 60), { x, y: 20 });
  }
  assert.equal(coordinateToDrawingAnchor(chart, series, { x: 35, y: 20 }, 60)?.time, 1210000);
  assert.equal(series.data().length, 3);
});

test("projection caches history copies and invalidates when a real candle arrives", () => {
  const { chart, series, append, reads } = fixture();
  coordinateToDrawingAnchor(chart, series, { x: 35, y: 20 }, 60);
  coordinateToDrawingAnchor(chart, series, { x: 35, y: 20 }, 60);
  assert.equal(reads(), 1);
  append(1300);
  assert.equal(coordinateToDrawingAnchor(chart, series, { x: 30, y: 20 }, 60)?.time, 1300000);
  assert.equal(reads(), 2);
});

test("historical gaps interpolate while future spacing uses the selected timeframe", () => {
  const { chart, series } = fixture([1000, 1060, 1240]);
  assert.equal(coordinateToDrawingAnchor(chart, series, { x: 15, y: 20 }, 60)?.time, 1150000);
  assert.equal(coordinateToDrawingAnchor(chart, series, { x: 30, y: 20 }, 60)?.time, 1300000);
  assert.deepEqual(drawingAnchorToCoordinate(chart, series, { time: 1150000, price: 80 }, 60), { x: 15, y: 20 });
});

test("empty charts, invalid intervals and invalid prices cannot create anchors", () => {
  const empty = fixture([]);
  assert.equal(coordinateToDrawingAnchor(empty.chart, empty.series, { x: 30, y: 20 }, 60), null);
  const { chart, series } = fixture([1000]);
  assert.equal(coordinateToDrawingAnchor(chart, series, { x: 30, y: 20 }, 0), null);
  assert.equal(coordinateToDrawingAnchor(chart, series, { x: 30, y: NaN }, 60), null);
  assert.equal(coordinateToDrawingAnchor(chart, series, { x: 10, y: 20 }, 300)?.time, 1300000);
});

test("position primitives render future targets and retain stop handles", () => {
  const { chart, series } = fixture();
  for (const type of ["long-position", "short-position"] as const) {
    const drawing: DrawingObject = { schemaVersion: 1, id: type, type, instrument: { provider: "binance", exchange: "BINANCE", product: "perpetual", nativeSymbol: "BTCUSDT" }, chartId: "chart", anchors: [{ time: 1060000, price: 80 }, { time: 1300000, price: type === "long-position" ? 90 : 70 }], style: defaultDrawingStyle(type), visibility: { timeframes: "all" }, locked: false, hidden: false, zOrder: 0, createdAt: 1, updatedAt: 1 };
    const primitive = new DrawingPrimitive(60);
    primitive.attached({ chart, series, requestUpdate: () => {} } as Parameters<DrawingPrimitive["attached"]>[0]);
    primitive.setDrawings([drawing], drawing.id);
    const projected = primitive.getProjected();
    assert.equal(projected.length, 1);
    assert.equal(projected[0].points.length, 3);
    assert.equal(projected[0].points[1].x, 50);
    assert.equal(projected[0].points[2].x, 50);
  }
});

test("renderer honors ray extensions, coincident anchors and text size", () => {
  const { chart, series } = fixture();
  const make = (type: DrawingObject["type"], anchors = [{ time: 1060000, price: 90 }, { time: 1120000, price: 80 }]): DrawingObject => ({ schemaVersion: 1, id: type, type, instrument: { provider: "binance", exchange: "BINANCE", product: "perpetual", nativeSymbol: "BTCUSDT" }, chartId: "chart", anchors, style: { ...defaultDrawingStyle(type), extendStart: true, textSize: 24 }, visibility: { timeframes: "all" }, locked: false, hidden: false, zOrder: 0, createdAt: 1, updatedAt: 1 });
  const render = (drawing: DrawingObject) => {
    const calls: { method: string; values: unknown[] }[] = [];
    const context = new Proxy({ measureText: () => ({ width: 10 }) } as unknown as CanvasRenderingContext2D, {
      get(target, method: string) { return method === "measureText" ? target.measureText : (...values: unknown[]) => calls.push({ method, values }); },
      set(_target, method: string, value: unknown) { calls.push({ method, values: [value] }); return true; },
    });
    const primitive = new DrawingPrimitive(60);
    primitive.attached({ chart, series, requestUpdate: () => {} } as Parameters<DrawingPrimitive["attached"]>[0]);
    primitive.setDrawings([drawing], null);
    primitive.paneViews()[0].renderer().draw({ useMediaCoordinateSpace: (callback: (scope: unknown) => void) => callback({ context, mediaSize: { width: 100, height: 100 } }) } as never);
    return calls;
  };
  assert.ok(render(make("ray")).some(call => call.method === "moveTo" && call.values[0] === 0));
  const coincident = render(make("extended-line", [{ time: 1060000, price: 90 }, { time: 1060000, price: 90 }]));
  assert.ok(coincident.some(call => call.method === "moveTo" && call.values[0] === 10 && call.values[1] === 10));
  assert.ok(coincident.some(call => call.method === "lineTo" && call.values[0] === 10 && call.values[1] === 10));
  assert.ok(render(make("text", [{ time: 1060000, price: 90 }])).some(call => call.method === "font" && call.values[0] === "24px ui-monospace, monospace"));
});
