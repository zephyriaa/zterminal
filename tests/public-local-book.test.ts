import assert from "node:assert/strict";
import test from "node:test";
import { LocalOrderBook } from "../src/lib/market/public-stream/local-book";

test("local book preserves decimal keys, ordering, and zero deletion", () => {
  const book = new LocalOrderBook();
  book.apply("buy", "77000.10", "2"); book.apply("buy", "77000.1", "3"); book.apply("sell", "77001", "1");
  assert.equal(book.top("buy")[0].size, 3);
  book.apply("buy", "77000.1", 0);
  assert.equal(book.bestBid(), undefined);
  assert.equal(book.isCrossed(), false);
});
