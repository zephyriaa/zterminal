import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { useMultiChart } from "../src/stores/multi-chart";
import { TIMEFRAME_SECONDS } from "../src/lib/market/types";

// Execute the affected real callbacks with renderer/DOM spies; this is not a browser mount.
const source = readFileSync(new URL("../src/components/terminal/terminal-chart.tsx", import.meta.url), "utf8");
const tree = ts.createSourceFile("terminal-chart.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function callback(identifier: string, effect = false): string {
  let found: ts.Node | undefined;
  function visit(node: ts.Node) {
    if (effect && ts.isCallExpression(node) && node.expression.getText(tree) === "useEffect" && node.arguments[0]?.getText(tree).includes(identifier)) found = node.arguments[0];
    if (!effect && ts.isVariableDeclaration(node) && node.name.getText(tree) === identifier) found = node.initializer;
    if (!found) ts.forEachChild(node, visit);
  }
  visit(tree);
  assert.ok(found, identifier);
  return ts.transpileModule(`(${found.getText(tree)})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
}

test("only focused chart captures, using current rendered market identity", () => {
  let captures = 0;
  const watermarks: string[][] = [], downloads: string[] = [];
  const state = { active: false, ready: true, symbol: "ETH_USDT", timeframe: "4h", provider: "gateio", status: "cached" };
  const handler = vm.runInNewContext(callback("onCapture"), {
    captureRef: { current: state }, symbol: "BTCUSDT", timeframe: "1m",
    chartRef: { current: { takeScreenshot: () => { captures++; return {}; } } },
    applyZTerminalWatermark: (_canvas: unknown, symbol: string, timeframe: string) => { watermarks.push([symbol, timeframe]); return { toDataURL: () => "data:image/png,fixture" }; },
    document: { createElement: () => ({ set download(value: string) { downloads.push(value); }, click() {} }), body: { appendChild() {}, removeChild() {} } }, Date,
  });
  const event = { detail: { mode: "download", symbol: "BTCUSDT", timeframe: "1m", filename: "wrong-primary.png" } };
  handler(event);
  assert.equal(captures, 0);
  state.active = true; handler(event);
  assert.equal(captures, 1);
  assert.match(watermarks[0][0], /ETH_USDT/);
  assert.match(watermarks[0][0], /gateio/);
  assert.equal(watermarks[0][1], "4h");
  assert.match(downloads[0], /ETH_USDT-4h/);
});

test("empty history clears old rendered price, volume and studies", () => {
  const cleared: string[] = [];
  vm.runInNewContext(callback("const timeData", true), {
    chartRef: { current: {} }, seriesRef: { current: { setData: (data: unknown[]) => { assert.equal(data.length, 0); cleared.push("price"); } } },
    volumeSeriesRef: { current: { setData: () => cleared.push("volume") } }, indicatorSeriesRef: { current: new Map([["old", { setData: () => cleared.push("study") }]]) },
    availableBars: [], setStudyWarnings() {},
  })();
  assert.deepEqual(cleared.sort(), ["price", "study", "volume"]);
});

test("empty-history cleanup preserves an already empty warning state without another render", () => {
  const previous: string[] = [];
  let next: unknown;
  vm.runInNewContext(callback("const timeData", true), {
    chartRef: { current: {} }, seriesRef: { current: { setData() {} } }, volumeSeriesRef: { current: null }, indicatorSeriesRef: { current: new Map() }, availableBars: [],
    setStudyWarnings: (update: string[] | ((current: string[]) => string[])) => { next = typeof update === "function" ? update(previous) : update; },
  })();
  assert.equal(next, previous);
});

test("candle replay does not calculate live Big Trades or display live mark price", () => {
  let subscribed = false, marked = false;
  vm.runInNewContext(callback("observations.bigTrades", true), {
    setHoveredBigTrade() {}, activeBigTradesSettings: {}, effectiveReplayIndex: 2, snapshot: undefined, flowReady: true, timeframe: "5m",
    bigTradesPrimitiveRef: { current: { setClusters: (clusters: unknown[]) => assert.equal(clusters.length, 0) } }, observations: { bigTrades: () => { subscribed = true; return { clusters: [] }; } }, contract: { tickSize: .1 },
  })();
  vm.runInNewContext(callback("title: \"MARK\"", true), {
    seriesRef: { current: { createPriceLine: () => { marked = true; } } }, markPriceLineRef: { current: null }, effectiveReplayIndex: 2, snapshot: undefined, markPrice: 999,
    themeColors: () => ({}), LineStyle: { Dashed: 2 },
  })();
  assert.equal(subscribed, false); assert.equal(marked, false);
});

test("unavailable feed quality stops Big Trades and clears its previous renderer frame", () => {
  let subscribed = false, cleared = false;
  vm.runInNewContext(callback("observations.bigTrades", true), {
    setHoveredBigTrade() {}, activeBigTradesSettings: {}, effectiveReplayIndex: null, snapshot: undefined, flowReady: false, timeframe: "5m",
    bigTradesPrimitiveRef: { current: { setClusters: (clusters: unknown[]) => { cleared = clusters.length === 0; } } }, observations: { bigTrades: () => { subscribed = true; return { clusters: [] }; } }, contract: { tickSize: .1 },
  })();
  assert.equal(subscribed, false); assert.equal(cleared, true);
});

test("replay trade markers stop at the visible candle and empty identity clears them", () => {
  const outputs: unknown[] = [];
  const context = {
    seriesRef: { current: {} }, markerPlugin: { current: { setMarkers: (values: unknown[]) => outputs.push(JSON.parse(JSON.stringify(values))) } },
    markers: [{ t: 1000, side: "buy" }, { t: 3000, side: "sell" }], availableBars: [{ t: 1000 }],
    themeColors: () => ({}),
  };
  vm.runInNewContext(callback("const tvMarkers", true), context)();
  assert.equal((outputs[0] as unknown[]).length, 1);
  context.availableBars = [];
  vm.runInNewContext(callback("const tvMarkers", true), context)();
  assert.deepEqual(outputs[1], []);
});

test("all layouts retain a visible focused pane after shrinking", () => {
  for (const layout of ["1", "2h", "2v", "3", "4"] as const) {
    useMultiChart.setState({ activePaneIndex: 3, layout: "4" });
    useMultiChart.getState().setLayout(layout);
    const count = layout === "1" ? 1 : layout === "3" ? 3 : layout === "4" ? 4 : 2;
    assert.ok(useMultiChart.getState().activePaneIndex < count);
  }
});

test("all four series types and seven timeframes receive their own input OHLCV", () => {
  const feed = callback("const timeData", true);
  for (const chartType of ["candles", "bars", "line", "area"]) for (const timeframe of ["1m", "5m", "15m", "30m", "1h", "4h", "1d"] as const) {
    const bars = [1, 2, 3].map(i => ({ t: 1_728_000_000_000 + i * TIMEFRAME_SECONDS[timeframe] * 1000, o: i + 10, h: i + 12, l: i + 9, c: i + 11, v: i * 100 }));
    let prices: Record<string, number>[] = [], volumes: Record<string, number>[] = [];
    vm.runInNewContext(feed, {
      chartRef: { current: {} }, seriesRef: { current: { setData: (value: typeof prices) => { prices = JSON.parse(JSON.stringify(value)); } } },
      volumeSeriesRef: { current: { setData: (value: typeof volumes) => { volumes = JSON.parse(JSON.stringify(value)); } } },
      availableBars: bars, chartType, timeframe, timezone: "UTC", indicators: { volume: true }, indicatorInstances: [], indicatorSeriesRef: { current: new Map() }, settings: { candleUpColor: "#00ff00", candleDownColor: "#ff0000" }, pageViewRef: { current: null }, setStudyWarnings() {},
    })();
    assert.deepEqual(prices.map(p => p.time), bars.map(b => b.t / 1000));
    assert.deepEqual(prices.map(p => p.close ?? p.value), bars.map(b => b.c));
    if (chartType === "candles" || chartType === "bars") assert.deepEqual(prices.map(p => [p.open, p.high, p.low]), bars.map(b => [b.o, b.h, b.l]));
    assert.deepEqual(volumes.map(p => p.value), bars.map(b => b.v));
  }
});

test("replay latest-bar readout follows the visible prefix and clears stale crosshair", () => {
  const bars = [{ t: 1, c: 1 }, { t: 2, c: 99 }];
  let latest: unknown = null, crosshair: unknown = "old";
  vm.runInNewContext(callback("onLatestBar?.(", true), { bars, availableBars: bars.slice(0, 1), onLatestBar: (value: unknown) => { latest = value; } })();
  vm.runInNewContext(callback("onCrosshair?.(null)", true), { onCrosshair: (value: unknown) => { crosshair = value; } })();
  assert.equal(latest, bars[0]); assert.equal(crosshair, null);
});
