import test from "node:test";
import assert from "node:assert/strict";
import { useChartDocuments } from "../src/stores/chart-documents";

const instrument = { provider: "binance" as const, exchange: "BINANCE" as const, product: "perpetual" as const, nativeSymbol: "BTCUSDT" };

test("drawing store creates, edits, duplicates, locks, and deletes within one document", () => {
  useChartDocuments.setState({ documents: {} });
  const documentId = useChartDocuments.getState().ensure({ instrument, timeframe: "5m" });
  const drawingId = useChartDocuments.getState().createDrawing(documentId, "trend-line", [{ time: 1_000, price: 10 }, { time: 2_000, price: 20 }]);
  assert.ok(drawingId);
  useChartDocuments.getState().updateDrawing(documentId, drawingId, { style: { color: "#ffffff" }, visibility: { timeframes: ["5m"] } });
  assert.equal(useChartDocuments.getState().documents[documentId].drawings[0].style.color, "#ffffff");
  const duplicateId = useChartDocuments.getState().duplicateDrawing(documentId, drawingId);
  assert.ok(duplicateId);
  assert.deepEqual(useChartDocuments.getState().documents[documentId].drawings[1].visibility, { timeframes: ["5m"] });
  useChartDocuments.getState().updateDrawing(documentId, drawingId, { locked: true });
  useChartDocuments.getState().updateDrawing(documentId, drawingId, { anchors: [{ time: 9_000, price: 90 }, { time: 10_000, price: 100 }] });
  useChartDocuments.getState().deleteDrawing(documentId, drawingId);
  assert.equal(useChartDocuments.getState().documents[documentId].drawings[0].anchors[0].time, 1_000);
  assert.equal(useChartDocuments.getState().documents[documentId].drawings.length, 2);
  useChartDocuments.getState().updateDrawing(documentId, drawingId, { locked: false });
  useChartDocuments.getState().deleteDrawing(documentId, drawingId);
  assert.deepEqual(useChartDocuments.getState().documents[documentId].drawings.map(item => item.id), [duplicateId]);
});
