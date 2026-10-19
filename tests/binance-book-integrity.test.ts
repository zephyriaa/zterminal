import assert from "node:assert/strict";
import test from "node:test";
import { BinanceDepthSynchronizer } from "../src/lib/market/public-stream/binance-depth";
import { BinanceOrderBook } from "../mini-services/market-data/binance-order-book";
const snapshot = { lastUpdateId: 100, bids: [["99", "1"]], asks: [["101", "1"]] } as const;
const snap = () => JSON.parse(JSON.stringify(snapshot));
const delta = (U: number, u: number, pu: number, b: [string, string][] = [], a: [string, string][] = []) => ({ U, u, pu, E: 1, b, a });

test("USD-M first event may end exactly at snapshot id, without requiring snapshot plus one", () => {
  const direct = new BinanceDepthSynchronizer(); direct.push(delta(99, 100, 98)); assert.equal(direct.bridge(snap()), true); assert.equal(direct.status, "LIVE");
  const gateway = new BinanceOrderBook(); gateway.apply(delta(99, 100, 98)); assert.equal(gateway.bootstrap(snap()), true); assert.equal(gateway.isReady(), true);
});
test("USD-M post-bridge continuity uses pu even when U jumps across update-id ranges", () => {
  const direct = new BinanceDepthSynchronizer(); direct.push(delta(99, 101, 98)); assert.equal(direct.bridge(snap()), true);
  direct.push(delta(110, 120, 101, [["99", "2"]])); assert.equal(direct.status, "LIVE"); assert.equal(direct.book.bestBid()?.size, 2);
});
test("malformed live direct depth fails closed without retaining partially applied levels", () => {
  const direct = new BinanceDepthSynchronizer(); direct.push(delta(99, 101, 98)); direct.bridge(snap());
  assert.doesNotThrow(() => direct.push(delta(102, 103, 101, [["99", "2"], ["98", "invalid"]])));
  assert.equal(direct.status, "ERROR"); assert.deepEqual(direct.book.top("buy"), []);
  direct.push(delta(102, 104, 101, [["98", "3"]])); assert.deepEqual(direct.book.top("buy"), []);
});
test("gateway rejects crossed books and clears readiness after malformed snapshots or deltas", () => {
  for (const kind of ["crossed", "delta", "snapshot"]) {
    const gateway = new BinanceOrderBook(); gateway.apply(delta(99, 101, 98)); gateway.bootstrap(snap());
    assert.throws(() => {
      if (kind === "snapshot") gateway.bootstrap({ ...snap(), bids: [["99", "2"], ["98", "bad"]] });
      else gateway.apply(delta(102, 103, 101, kind === "crossed" ? [["102", "2"]] : [["99", "2"], ["98", "bad"]]));
    });
    assert.equal(gateway.isReady(), false, kind); assert.deepEqual(gateway.levels(), [], kind); assert.equal(gateway.bestQuote(), null);
  }
});
