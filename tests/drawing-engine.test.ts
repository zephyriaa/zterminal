import test from "node:test";
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { createChartDocument, defaultDrawingStyle, sanitizeDrawing, type DrawingObject, type DrawingType } from "../src/lib/chart/contracts";
import { clipLine, drawingHit, drawingSegments, nearestDrawing, textBounds, moveAnchors } from "../src/lib/chart/drawings/geometry";
import { timeToLogical, logicalToTime, type DrawingCoordinates } from "../src/lib/chart/drawings/coordinates";
import { snapDrawingPoint } from "../src/lib/chart/drawings/snapping";
import { workspaceChartDocuments } from "../src/lib/chart/workspace-snapshot";
import { useChartDocuments } from "../src/stores/chart-documents";
import { useWorkspace } from "../src/stores/workspace";

const instrument = { provider: "binance" as const, exchange: "BINANCE" as const, product: "perpetual" as const, nativeSymbol: "BTCUSDT" };
const drawing = (type: DrawingType, zOrder = 0): DrawingObject => ({ schemaVersion: 1, id: `drawing-${zOrder}`, type, chartId: "chart", instrument, anchors: [{ time: 1000, price: 10 }, { time: 2000, price: 20 }], style: defaultDrawingStyle(type), locked: false, hidden: false, visibility: { timeframes: "all" }, zOrder, createdAt: 1, updatedAt: 1 });

test("market timestamps interpolate gaps and round-trip future coordinates across timeframes", () => {
  for (const times of [[1000, 2000, 5000], [1000, 5000, 9000]]) for (const time of [0, 1000, 1500, 3000, 5000, 10000]) {
    const logical = timeToLogical(times, time, 1000)!;
    assert.equal(logicalToTime(times, logical, 1000), time);
  }
  assert.equal(timeToLogical([], 1000, 1000), null);
  assert.equal(logicalToTime([1000], 2, 300000), 601000);
});

test("directed rays and extended lines share renderer/hit geometry including vertical rays", () => {
  assert.deepEqual(clipLine({ x: 50, y: 50 }, { x: 40, y: 50 }, 100, 100, false, true), [{ x: 50, y: 50 }, { x: 0, y: 50 }]);
  assert.deepEqual(clipLine({ x: 50, y: 50 }, { x: 50, y: 40 }, 100, 100, false, true), [{ x: 50, y: 50 }, { x: 50, y: 0 }]);
  const ray = { drawing: drawing("ray"), points: [{ x: 50, y: 50 }, { x: 40, y: 50 }], viewport: { width: 100, height: 100 } };
  assert.equal(drawingHit(ray, { x: 10, y: 54 }), true);
  assert.equal(drawingHit(ray, { x: 80, y: 50 }), false);
  assert.equal(drawingHit({ ...ray, drawing: drawing("extended-line") }, { x: 80, y: 50 }), true);
  assert.equal(drawingHit({ ...ray, drawing: drawing("horizontal-ray") }, { x: 10, y: 53 }), true);
  assert.equal(drawingHit({ ...ray, drawing: drawing("horizontal-ray") }, { x: 80, y: 50 }), false);
});

test("channels, ellipses, paths, date ranges and text have semantic hit regions", () => {
  const points = [{ x: 10, y: 10 }, { x: 90, y: 10 }, { x: 70, y: 30 }];
  const channel = { drawing: drawing("parallel-channel"), points };
  assert.equal(drawingSegments(channel).length, 3);
  assert.equal(drawingHit(channel, { x: 50, y: 30 }), true);
  const extendedChannel = { ...channel, drawing: { ...channel.drawing, style: { ...channel.drawing.style, extendEnd: true } }, viewport: { width: 200, height: 100 } };
  assert.equal(drawingHit(extendedChannel, { x: 150, y: 10 }), true);
  assert.equal(drawingHit({ drawing: drawing("ellipse"), points: [{ x: 0, y: 0 }, { x: 100, y: 100 }] }, { x: 50, y: 50 }), true);
  const thinEllipse = { drawing: drawing("ellipse"), points: [{ x: 0, y: 0 }, { x: 1000, y: 10 }] };
  assert.equal(drawingHit(thinEllipse, { x: 1100, y: 5 }), false, "thin ellipse has no remote phantom hit region");
  assert.equal(drawingHit(thinEllipse, { x: 1006, y: 5 }), true);
  assert.equal(drawingHit(thinEllipse, { x: 990, y: 15 }), false, "edge tolerance measures physical pixels rather than normalized radii");
  assert.equal(drawingHit({ drawing: drawing("polyline"), points }, { x: 80, y: 20 }), true);
  assert.equal(drawingHit({ drawing: drawing("date-range"), points: points.slice(0, 2), viewport: { width: 100, height: 200 } }, { x: 50, y: 190 }), true);
  const note = { drawing: { ...drawing("text"), style: { ...defaultDrawingStyle("text"), text: "A sufficiently long research annotation", textSize: 24 } }, points: [points[0]] };
  const bounds = textBounds(note);
  assert.equal(drawingHit(note, { x: bounds.left + bounds.width - 5, y: bounds.top + 5 }), true);
});

test("overlapping selection follows persisted z-order rather than array order", () => {
  const points = [{ x: 0, y: 10 }, { x: 100, y: 10 }];
  assert.equal(nearestDrawing([{ drawing: drawing("trend-line", 9), points }, { drawing: drawing("trend-line", 1), points }], { x: 50, y: 11 }), "drawing-9");
});

test("weak snapping has CSS-pixel tolerance; strong mode never sees bars absent from replay data", () => {
  const coordinates: DrawingCoordinates = { project: a => ({ x: a.time, y: a.price }), unproject: p => ({ time: p.x, price: p.y }) };
  const bars = [{ t: 10, o: 20, h: 30, l: 10, c: 25, v: 1 }];
  assert.deepEqual(snapDrawingPoint({ x: 11, y: 24 }, bars, "weak", coordinates).anchor, { time: 10, price: 25 });
  assert.equal(snapDrawingPoint({ x: 11, y: 80 }, bars, "weak", coordinates).target, null);
  assert.equal(snapDrawingPoint({ x: 100, y: 80 }, bars, "strong", coordinates).anchor?.time, 10);
  assert.equal(snapDrawingPoint({ x: 100, y: 80 }, [], "strong", coordinates).anchor?.time, 100);
});

test("movement preserves geometry at the epoch boundary; advanced drawings survive serialization", () => {
  assert.deepEqual(moveAnchors([{ time: 10, price: 1 }, { time: 20, price: 2 }], { time: 20, price: 2 }, { time: 0, price: 3 }), [{ time: 0, price: 2 }, { time: 10, price: 3 }]);
  for (const type of ["parallel-channel", "fibonacci-extension", "polyline"] as const) {
    const value = { ...drawing(type), anchors: [{ time: 1000, price: 1 }, { time: 2000, price: 2 }, { time: 3000, price: 3 }] };
    const restored = sanitizeDrawing(JSON.parse(JSON.stringify(value)), { instrument, chartId: "chart" });
    assert.ok(restored); assert.equal(restored.anchors.length, 3);
  }
});

test("history handles create, edit, delete, lock, hide, duplicate, clear and isolates chart ownership", () => {
  useChartDocuments.setState({ documents: {}, drawingHistory: {} });
  const store = useChartDocuments.getState(), id = store.ensure({ instrument, timeframe: "5m" }), second = store.ensure({ instrument, timeframe: "5m", chartId: "second" });
  const first = store.createDrawing(id, "trend-line", drawing("trend-line").anchors)!;
  store.updateDrawing(id, first, { anchors: [{ time: 3000, price: 20 }, { time: 4000, price: 30 }] });
  const duplicate = store.duplicateDrawing(id, first)!;
  assert.equal(useChartDocuments.getState().drawingHistory[id].past.length, 3);
  store.undoDrawings(id); assert.equal(useChartDocuments.getState().documents[id].drawings.length, 1);
  store.redoDrawings(id); assert.equal(useChartDocuments.getState().documents[id].drawings[1].id, duplicate);
  store.updateDrawing(id, first, { hidden: true, locked: true });
  store.clearDrawings(id); assert.deepEqual(useChartDocuments.getState().documents[id].drawings.map(d => d.id), [first]);
  store.undoDrawings(id); assert.equal(useChartDocuments.getState().documents[id].drawings.length, 2);
  assert.equal(useChartDocuments.getState().documents[second].drawings.length, 0);
  store.undoDrawings(id); assert.equal(useChartDocuments.getState().documents[id].drawings[0].locked, false);
  store.deleteDrawing(id, first); store.undoDrawings(id);
  assert.equal(useChartDocuments.getState().documents[id].drawings[0].id, first);
});

test("workspace save copies drawings into the new workspace; reload rejects corrupt and foreign drawings", () => {
  useChartDocuments.setState({ documents: {}, drawingHistory: {} });
  const document = createChartDocument({ workspaceId: "source", instrument, timeframe: "5m", chartId: "chart" });
  document.drawings = [drawing("trend-line")];
  useChartDocuments.setState({ documents: { [document.id]: document } });
  useWorkspace.setState({ activeWorkspaceId: "source", workspaces: [], cloudAuthenticated: false });
  useWorkspace.getState().saveWorkspace("Snapshot");
  const saved = useWorkspace.getState().workspaces.at(-1)!;
  assert.equal(saved.chartDocuments?.[0].drawings.length, 1);
  assert.equal(saved.chartDocuments?.[0].workspaceId, saved.id);
  useChartDocuments.setState({ documents: {} });
  useWorkspace.getState().loadWorkspace(saved.id);
  assert.equal(Object.values(useChartDocuments.getState().documents)[0].drawings[0].id, document.drawings[0].id);
  assert.equal(workspaceChartDocuments([{ ...document, instrument: null }, { ...document, drawings: [{ ...document.drawings[0], chartId: "foreign" }] }], "target")[0].drawings.length, 0);
  const id = Object.values(useChartDocuments.getState().documents)[0].id;
  useChartDocuments.getState().createDrawing(id, "horizontal-line", [{ time: 1000, price: 5 }]);
  useChartDocuments.getState().restoreDocuments(saved.id, [{ ...useChartDocuments.getState().documents[id], updatedAt: Date.now() + 1000 }]);
  assert.equal(useChartDocuments.getState().drawingHistory[id], undefined, "restoring a newer external revision discards obsolete undo history");
});

test("cloud drawing caches follow the verified account and leave local documents intact", () => {
  useChartDocuments.setState({ documents: {}, drawingHistory: {}, workspaceOwners: {} });
  const store = useChartDocuments.getState();
  const local = store.ensure({ instrument, timeframe: "5m" });
  const first = store.ensure({ workspaceId: "cloud-one", instrument, timeframe: "5m" });
  const second = store.ensure({ workspaceId: "cloud-two", instrument, timeframe: "5m" });
  store.bindCloudWorkspace("cloud-one", "first-user"); store.bindCloudWorkspace("cloud-two", "second-user");
  store.purgeCloudDocuments("first-user");
  assert.ok(useChartDocuments.getState().documents[first]); assert.equal(useChartDocuments.getState().documents[second], undefined);
  store.purgeCloudDocuments(null);
  assert.ok(useChartDocuments.getState().documents[local]); assert.equal(useChartDocuments.getState().documents[first], undefined);
  assert.deepEqual(useChartDocuments.getState().workspaceOwners, {});
});

test("1000-drawing hit testing remains within an interactive budget", () => {
  const projected = Array.from({ length: 1000 }, (_, i) => ({ drawing: drawing("trend-line", i), points: [{ x: 0, y: i }, { x: 800, y: i }] }));
  const start = performance.now();
  for (let i = 0; i < 100; i++) nearestDrawing(projected, { x: 400, y: i });
  const elapsed = performance.now() - start;
  assert.ok(elapsed < 1000, `100 scans took ${elapsed.toFixed(1)}ms`);
});
