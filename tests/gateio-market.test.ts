import assert from "node:assert/strict";
import test from "node:test";
import {
  fetchGateioHistoricalBars,
  gateCandleToBar,
  normalizeBars,
  normalizeGateioSymbol,
  parseGateDecimal,
  upsertBar,
} from "../src/lib/market/gateio";
import { GateOrderBook } from "../mini-services/market-data/order-book";
import { compileStrategy } from "../src/lib/strategy/zs-compiler";

test("normalizes TradingView-style QQQX aliases to Gate.io native contract", () => {
  assert.equal(normalizeGateioSymbol("QQQX_USDT"), "QQQX_USDT");
  assert.equal(normalizeGateioSymbol("qqqxusdt.p"), "QQQX_USDT");
  assert.equal(normalizeGateioSymbol("QQQX_USDT.P"), "QQQX_USDT");
  assert.equal(normalizeGateioSymbol("GATEIO:QQQXUSDT.P"), "QQQX_USDT");
  assert.equal(normalizeGateioSymbol("GATEIO:QQQX_USDT.P"), "QQQX_USDT");
  assert.equal(normalizeGateioSymbol("NQ"), null);
});

test("rejects malformed upstream decimal values", () => {
  assert.equal(parseGateDecimal("12.50", "price"), 12.5);
  assert.throws(() => parseGateDecimal("NaN", "price"));
  assert.throws(() => parseGateDecimal("12x", "price"));
});

test("normalizes, deduplicates, and upserts Gate candles by timestamp", () => {
  const first = gateCandleToBar({ t: "100", o: "1", h: "4", l: "1", c: "3", v: "5" });
  const replacement = gateCandleToBar({ t: "100", o: "1", h: "5", l: "1", c: "4", v: "8" });
  const second = gateCandleToBar({ t: "160", o: "4", h: "6", l: "3", c: "5", v: "9" });
  const normalized = normalizeBars([second, first, replacement]);
  assert.deepEqual(normalized.map((bar) => [bar.t, bar.c, bar.v]), [[100_000, 4, 8], [160_000, 5, 9]]);
  assert.deepEqual(upsertBar(normalized, { ...second, c: 5.5 }), [{ ...replacement }, { ...second, c: 5.5 }]);
});

test("pages and normalizes a requested Gate.io historical candle range", async () => {
  const requests: URL[] = [];
  const bars = await fetchGateioHistoricalBars("QQQX_USDT", "1m", 0, 120_000_000, async (input) => {
    const url = new URL(input.toString());
    requests.push(url);
    const from = Number(url.searchParams.get("from"));
    return new Response(JSON.stringify([{ t: String(from), o: "1", h: "2", l: "1", c: "1.5", v: "3" }]), { status: 200 });
  });
  assert.equal(requests.length, 2);
  assert.equal(requests[0].searchParams.get("contract"), "QQQX_USDT");
  assert.equal(requests[0].searchParams.has("limit"), false);
  assert.deepEqual(bars.map((bar) => bar.t), [0, 120_000_000]);
});

test("bridges a REST order-book snapshot with buffered deltas", () => {
  const book = new GateOrderBook();
  book.buffer({ U: 101, u: 102, t: 1, b: [{ p: "99", s: "3" }], a: [{ p: "101", s: "0" }] });
  const ready = book.bootstrap({
    id: 100,
    current: 100,
    update: 100,
    bids: [["98", "2"]],
    asks: [["101", "1"]],
  });
  assert.equal(ready, true);
  assert.equal(book.isReady(), true);
  assert.equal(book.lastSequence(), 102);
  assert.deepEqual(book.levels(), [
    { price: 99, size: 3, side: "buy" },
    { price: 98, size: 2, side: "buy" },
  ]);
});

test("accepts declared inputs and built-in strategy directions in the bundled DSL pattern", () => {
  const source = `strategy("EMA Cross + VWAP Filter", overlay=true)
input.float("Fast", 8, minval=1, maxval=200)
input.float("Slow", 21, minval=1, maxval=400)
var fastEma = ema(close, Fast)
var slowEma = ema(close, Slow)
if close > vwap
  strategy.entry("long", strategy.long, qty=1)`;
  const compiled = compileStrategy(source);
  assert.equal(compiled.ok, true);
  assert.deepEqual(compiled.diagnostics.filter((diagnostic) => diagnostic.severity === "warning"), []);
});

test("detects sequence gaps and removes zero-size depth levels", () => {
  const book = new GateOrderBook();
  book.buffer({ U: 11, u: 11, t: 1, b: [], a: [] });
  assert.equal(book.bootstrap({ id: 10, current: 10, update: 10, bids: [["9", "1"]], asks: [["11", "2"]] }), true);
  assert.equal(book.apply({ U: 12, u: 12, t: 2, b: [{ p: "9", s: "0" }], a: [] }), true);
  assert.equal(book.levels().some((level) => level.price === 9), false);
  assert.equal(book.apply({ U: 14, u: 14, t: 3, b: [], a: [] }), false);
});
