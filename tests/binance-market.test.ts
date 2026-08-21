import assert from "node:assert/strict";
import test from "node:test";
import { BinanceOrderBook } from "../mini-services/market-data/binance-order-book";

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
