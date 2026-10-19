import assert from "node:assert/strict";
import test from "node:test";
import { appendObservedDepth, buildOrderFlowContext, DEFAULT_ORDER_FLOW_SETTINGS, ORDER_FLOW_LAYERS, sanitizeOrderFlowSettings } from "../src/lib/market/order-flow-context";
import type { DepthEvent, TradeEvent } from "../src/lib/market/types";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DepthHeatmap, OrderFlowContext } from "../src/components/terminal/docking/order-flow-context";
import type { MarketStream } from "../src/hooks/use-market-stream";
import { getContract } from "../src/lib/market/contracts";
import { CHART_OVERLAY_SCHEMA_VERSION } from "../src/lib/chart/overlays/contracts";
import { createChartDocument, migrateChartDocument } from "../src/lib/chart/contracts";
import { useChartDocuments } from "../src/stores/chart-documents";
const trades: TradeEvent[] = [
  { type: "trade", provider: "binance", environment: "live", exchange: "BINANCE", symbol: "BTCUSDT", timestamp: 1000, sequence: 1, price: 100, quantity: 2, side: "buy", quantityUnit: "base" },
  { type: "trade", provider: "binance", environment: "live", exchange: "BINANCE", symbol: "BTCUSDT", timestamp: 1500, sequence: 2, price: 101, quantity: 1, side: "sell", quantityUnit: "base" },
  { type: "trade", provider: "binance", environment: "live", exchange: "BINANCE", symbol: "BTCUSDT", timestamp: 2500, sequence: 3, price: 102, quantity: 3, side: "buy", quantityUnit: "base" },
];
const depth: DepthEvent = { type: "depth", provider: "binance", environment: "live", exchange: "BINANCE", symbol: "BTCUSDT", timestamp: 2500, sequence: 10, levels: [{ side: "buy", price: 99, size: 3 }, { side: "sell", price: 101, size: 1 }] };
const settings = { ...DEFAULT_ORDER_FLOW_SETTINGS, layers: ORDER_FLOW_LAYERS.map(layer => layer.id) };
const input = { provider: "binance" as const, symbol: "BTCUSDT", available: true, trades, depth, tickSize: 1, now: 3000, settings };
test("each promised live layer agrees with an independent three-trade/two-level ledger", () => {
  const model = buildOrderFlowContext(input);
  assert.equal(model.status, "observed"); assert.equal(model.quantityUnit, "base");
  assert.deepEqual(model.cvd.map(point => point.value), [1, 4]);
  assert.deepEqual(model.cvd.map(point => point.delta), [1, 3]);
  assert.equal(model.footprint.length, 2);
  assert.deepEqual(model.tradeProfile.map(level => [level.price, level.buyVolume, level.sellVolume]), [[102, 3, 0], [101, 0, 1], [100, 2, 0]]);
  assert.equal(model.imbalance?.value, .5); assert.equal(model.microprice?.value, 100.5);
  assert.deepEqual(model.candidates.map(event => event.kind).sort(), ["absorption-candidate", "sweep-candidate"]);
  assert.equal(model.candidates[0].metrics.notional, 607);
});
test("unavailable, stale and switched inputs cannot produce old meaningful metrics", () => {
  const absent = buildOrderFlowContext({ ...input, available: false });
  assert.equal(absent.status, "unavailable"); assert.equal(absent.microprice, null); assert.equal(absent.cvd.length, 0);
  const stale = buildOrderFlowContext({ ...input, now: 20000 }); assert.equal(stale.microprice?.value ?? null, null);
  assert.throws(() => buildOrderFlowContext({ ...input, trades: [{ ...trades[0], symbol: "ETHUSDT" }] }), /identity/i);
  assert.throws(() => buildOrderFlowContext({ ...input, depth: { ...depth, provider: "gateio" } }), /identity/i);
});

test("independent trade and book availability preserves only the valid study outputs", () => {
  const tradeOnly = buildOrderFlowContext({ ...input, depthAvailable: false });
  assert.equal(tradeOnly.cvd.at(-1)?.value, 4); assert.equal(tradeOnly.microprice, null);
  const bookOnly = buildOrderFlowContext({ ...input, available: false, depthAvailable: true });
  assert.equal(bookOnly.tradeCount, 0); assert.equal(bookOnly.cvd.length, 0);
  assert.equal(bookOnly.microprice?.value, 100.5); assert.equal(bookOnly.imbalance?.value, .5);
});
test("window and bucket controls change calculations; empty observations remain unavailable", () => {
  const short = buildOrderFlowContext({ ...input, settings: { ...settings, windowSeconds: 1 } });
  assert.equal(short.tradeCount, 1); assert.equal(short.cvd.at(-1)?.value, 3); assert.equal(short.tradeProfile.length, 1);
  const empty = buildOrderFlowContext({ ...input, trades: [], depth: null }); assert.equal(empty.tradeCount, 0); assert.equal(empty.cvd.length, 0); assert.equal(empty.microprice?.value ?? null, null);
  const bounded = sanitizeOrderFlowSettings({ ...settings, layers: ["cvd", "cvd", "made-up"], windowSeconds: Infinity, bucketSeconds: 0, bookLevels: 1000 });
  assert.deepEqual(bounded.layers, ["cvd"]); assert.equal(bounded.windowSeconds, DEFAULT_ORDER_FLOW_SETTINGS.windowSeconds); assert.equal(bounded.bucketSeconds, 1); assert.equal(bounded.bookLevels, 20);
});
test("heatmap records actual verified frames only, with bounded memory and strict identity", () => {
  const first = appendObservedDepth([], depth); assert.equal(first.length, 1);
  assert.equal(appendObservedDepth(first, depth), first);
  const second = appendObservedDepth(first, { ...depth, sequence: 12, timestamp: 3000 }); assert.equal(second.length, 2);
  assert.throws(() => appendObservedDepth(second, { ...depth, sequence: 11 }), /old|order/i);
  assert.throws(() => appendObservedDepth(second, { ...depth, symbol: "ETHUSDT", sequence: 13, timestamp: 4000 }), /identity/i);
  assert.throws(() => appendObservedDepth([], { ...depth, levels: [{ side: "buy", price: 102, size: 3 }, { side: "sell", price: 101, size: 1 }] }), /book|cross/i);
  let frames = first; for (let i = 1; i <= 130; i++) frames = appendObservedDepth(frames, { ...depth, sequence: 12 + i, timestamp: 3000 + i });
  assert.equal(frames.length, 120); assert.equal(frames.at(-1)?.sequence, 142);
});
test("the real context renderer exposes each layer and withholds outputs when quality is unavailable", () => {
  const stream: MarketStream = { provider: "binance", environment: "live", state: "connected", dataStatus: "LIVE", nativeSymbol: "BTCUSDT", canonicalSymbol: "BTCUSDT", product: "perpetual", integrity: "provider-stream", trades, lastTrade: trades.at(-1)!, quote: null, depth: depth.levels, depthSnapshot: depth, derivatives: null, derivativesHistory: [], liquidations: [], health: null, retrievedAt: 3000 };
  const props = { stream, contract: { ...getContract("BTCUSDT"), verified: true }, settings, scopeKey: "fixture", visible: true, configurable: true, onChange() {}, onVisible() {}, onRemove() {} };
  const html = renderToStaticMarkup(createElement(OrderFlowContext, props));
  for (const layer of ORDER_FLOW_LAYERS) assert.ok(html.includes(layer.label), layer.id);
  assert.ok(html.includes("100.5")); assert.ok(html.includes("sweep candidate")); assert.ok(html.includes("Observed order-flow outputs"));
  const gapped = renderToStaticMarkup(createElement(OrderFlowContext, { ...props, stream: { ...stream, dataStatus: "DEGRADED" } }));
  assert.ok(!gapped.includes("Observed order-flow outputs")); assert.ok(gapped.includes("Dependent outputs are withheld"));
  const hidden = renderToStaticMarkup(createElement(OrderFlowContext, { ...props, visible: false })); assert.ok(!hidden.includes("Observed order-flow outputs"));
});
test("heatmap SVG has one cell per actual retained level and never invents columns between frames", () => {
  const frames = appendObservedDepth(appendObservedDepth([], depth), { ...depth, sequence: 12, timestamp: 5000 });
  const html = renderToStaticMarkup(createElement(DepthHeatmap, { frames }));
  assert.equal((html.match(/<rect /g) ?? []).length, 4); assert.ok(html.includes('x="55"')); assert.ok(html.includes('x="490"'));
});
test("settings roundtrip through the canonical document and never persist live trade/book payloads", () => {
  const instrument = { provider: "binance" as const, exchange: "BINANCE" as const, product: "perpetual" as const, nativeSymbol: "BTCUSDT" };
  const document = createChartDocument({ workspaceId: "one", chartId: "primary", instrument, timeframe: "1m" });
  const overlay = { schemaVersion: CHART_OVERLAY_SCHEMA_VERSION, id: "order-flow.context", type: "order-flow-context" as const, visible: true, zIndex: 0, settings: { ...settings, windowSeconds: 45, frames: [depth], trades } };
  const restored = migrateChartDocument(JSON.parse(JSON.stringify({ ...document, overlays: [overlay] })), document);
  assert.equal(restored.overlays.length, 1); const restoredSettings = sanitizeOrderFlowSettings(restored.overlays[0].settings);
  assert.equal(restoredSettings.windowSeconds, 45); assert.deepEqual(restoredSettings.layers, settings.layers);
  assert.ok(!("frames" in restored.overlays[0].settings)); assert.ok(!("trades" in restored.overlays[0].settings));
  useChartDocuments.setState({ documents: {} }); const store = useChartDocuments.getState();
  const first = store.ensure({ workspaceId: "one", chartId: "primary", instrument, timeframe: "1m" });
  const other = store.ensure({ workspaceId: "two", chartId: "primary", instrument, timeframe: "1m" });
  const secondary = store.ensure({ workspaceId: "one", chartId: "secondary", instrument, timeframe: "1m" });
  store.setOverlay(first, overlay); assert.equal(useChartDocuments.getState().documents[other].overlays.length, 0); assert.equal(useChartDocuments.getState().documents[secondary].overlays.length, 0);
  store.setOverlay(first, { ...overlay, visible: false }); assert.equal(useChartDocuments.getState().documents[first].overlays[0].visible, false);
  store.removeOverlay(first, overlay.id); assert.equal(useChartDocuments.getState().documents[first].overlays.length, 0);
});
