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


test("detects sequence gaps and removes zero-size depth levels", () => {
  const book = new GateOrderBook();
  book.buffer({ U: 11, u: 11, t: 1, b: [], a: [] });
  assert.equal(book.bootstrap({ id: 10, current: 10, update: 10, bids: [["9", "1"]], asks: [["11", "2"]] }), true);
  assert.equal(book.apply({ U: 12, u: 12, t: 2, b: [{ p: "9", s: "0" }], a: [] }), true);
  assert.equal(book.levels().some((level) => level.price === 9), false);
  assert.equal(book.apply({ U: 14, u: 14, t: 3, b: [], a: [] }), false);
});

test("best quote follows unordered insertions, replacements, deletions and resets", () => {
  const book = new GateOrderBook();
  assert.equal(book.bestQuote(), null);
  book.buffer({ U: 11, u: 11, t: 1, b: [], a: [] });
  book.bootstrap({ id: 10, current: 10, update: 10,
    bids: [["8", "2"], ["9", "3"], ["7", "1"]], asks: [["13", "2"], ["11", "4"], ["12", "1"]] });
  assert.deepEqual(book.bestQuote(), { bid: 9, bidSize: 3, ask: 11, askSize: 4 });
  book.apply({ U: 12, u: 12, t: 2, b: [{ p: "9", s: "0" }, { p: "8", s: "5" }], a: [{ p: "11", s: "0" }] });
  assert.deepEqual(book.bestQuote(), { bid: 8, bidSize: 5, ask: 12, askSize: 1 });
  book.apply({ U: 13, u: 13, t: 3, b: [], a: [{ p: "12", s: "0" }, { p: "13", s: "0" }] });
  assert.equal(book.bestQuote(), null);
  book.reset();
  assert.equal(book.bestQuote(), null);
});

test("best quote equals sorted depth through deterministic randomized updates", () => {
  const book = new GateOrderBook();
  book.buffer({ U: 2, u: 2, t: 1, b: [], a: [] });
  book.bootstrap({ id: 1, current: 1, update: 1, bids: [["99", "1"]], asks: [["101", "1"]] });
  let seed = 717;
  for (let sequence = 3; sequence < 203; sequence++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const offset = seed % 50;
    const size = String(seed % 7);
    book.apply({ U: sequence, u: sequence, t: sequence,
      b: [{ p: String(99 - offset), s: size }], a: [{ p: String(101 + offset), s: size }] });
    const levels = book.levels();
    const bid = levels.find(level => level.side === "buy");
    const ask = levels.find(level => level.side === "sell");
    assert.deepEqual(book.bestQuote(), bid && ask
      ? { bid: bid.price, bidSize: bid.size, ask: ask.price, askSize: ask.size } : null);
  }
});
