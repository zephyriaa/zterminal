import assert from "node:assert/strict";
import test from "node:test";
import { BinanceOrderBook } from "../mini-services/market-data/binance-order-book";
import { fetchBinanceHistoricalBars } from "../src/lib/market/binance";

test("bridges a Binance snapshot using the first depth range that covers the next update id", () => {
  const book = new BinanceOrderBook();
  book.apply({ U: 96, u: 100, pu: 95, E: 1, b: [["99", "2"]], a: [] });
  book.apply({ U: 101, u: 108, pu: 100, E: 2, b: [["100", "3"]], a: [["101", "0"]] });
  book.apply({ U: 109, u: 116, pu: 108, E: 3, b: [], a: [["102", "4"]] });

  assert.equal(book.bootstrap({ lastUpdateId: 100, bids: [["98", "1"]], asks: [["101", "2"]] }), true);
  assert.equal(book.isReady(), true);
  assert.equal(book.lastSequence(), 116);
  assert.deepEqual(book.levels(), [
    { price: 100, size: 3, side: "buy" },
    { price: 98, size: 1, side: "buy" },
    { price: 102, size: 4, side: "sell" },
  ]);
});

test("uses Binance pu as the authoritative post-bridge continuity identifier", () => {
  const book = new BinanceOrderBook();
  book.apply({ U: 101, u: 120, pu: 99, E: 1, b: [], a: [] });
  assert.equal(book.bootstrap({ lastUpdateId: 100, bids: [["99", "1"]], asks: [["101", "1"]] }), true);
  // U can advance by a range; `pu` links this update to the previous final id.
  assert.equal(book.apply({ U: 130, u: 145, pu: 120, E: 2, b: [["99", "0"]], a: [] }), true);
  assert.equal(book.levels().some((level) => level.price === 99), false);
  assert.equal(book.apply({ U: 146, u: 150, pu: 144, E: 3, b: [], a: [] }), false);
});

test("does not mark a book live when no buffered diff can bridge the snapshot", () => {
  const book = new BinanceOrderBook();
  book.apply({ U: 80, u: 90, pu: 79, E: 1, b: [], a: [] });
  assert.equal(book.bootstrap({ lastUpdateId: 100, bids: [], asks: [] }), false);
  assert.equal(book.isReady(), false);
});

test("normalizes verified Binance historical klines without padding missing candles", async () => {
  const requested: string[] = [];
  const bars = await fetchBinanceHistoricalBars("BTCUSDT", "1m", 60_000, 180_000, async (input) => {
    requested.push(String(input));
    return new Response(JSON.stringify([
      [60_000, "100", "103", "99", "102", "12"],
      [120_000, "102", "104", "101", "103", "18"],
      [120_000, "102", "105", "100", "104", "19"],
      [180_000, "104", "106", "103", "105", "14"],
    ]), { status: 200 });
  });
  assert.equal(requested.length, 1);
  assert.match(requested[0], /symbol=BTCUSDT/);
  assert.deepEqual(bars, [
    { t: 60_000, o: 100, h: 103, l: 99, c: 102, v: 12 },
    { t: 120_000, o: 102, h: 105, l: 100, c: 104, v: 19 },
    { t: 180_000, o: 104, h: 106, l: 103, c: 105, v: 14 },
  ]);
});
