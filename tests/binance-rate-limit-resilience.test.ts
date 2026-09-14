import assert from "node:assert/strict";
import test from "node:test";
import { BinanceDepthSynchronizer, type BinanceDepth, type BinanceSnapshot } from "../src/lib/market/public-stream/binance-depth";

test("BinanceDepthSynchronizer holds pending snapshot and bridges when matching deltas arrive later", () => {
  const sync = new BinanceDepthSynchronizer();
  assert.equal(sync.status, "SYNCING");

  // Snapshot arrives FIRST with lastUpdateId = 200
  const snapshot: BinanceSnapshot = {
    lastUpdateId: 200,
    bids: [["50000", "2.5"], ["49990", "5.0"]],
    asks: [["50010", "3.0"], ["50020", "4.0"]],
  };

  const bridgedImmediate = sync.bridge(snapshot);
  // Buffer is empty, so it cannot bridge immediately, but must NOT fail
  assert.equal(bridgedImmediate, false);
  assert.equal(sync.status, "SYNCING");

  // An old delta arrives (u <= 200), should be ignored
  const oldDelta: BinanceDepth = { U: 195, u: 199, b: [["50000", "1.0"]], a: [] };
  sync.push(oldDelta);
  assert.equal(sync.status, "SYNCING");

  // Delta arriving that bridges snapshot (covers lastUpdateId + 1 = 201)
  const bridgeDelta: BinanceDepth = {
    U: 200,
    u: 205,
    pu: 199,
    b: [["50000", "3.0"]],
    a: [["50010", "0"]], // deleted ask
  };

  sync.push(bridgeDelta);
  assert.equal(sync.status, "LIVE");

  const bestBid = sync.book.bestBid();
  assert.equal(bestBid?.price, 50000);
  assert.equal(bestBid?.size, 3.0);

  const bestAsk = sync.book.bestAsk();
  assert.equal(bestAsk?.price, 50020);
});

test("BinanceDepthSynchronizer fails if subsequent deltas jump past snapshot sequence without coverage", () => {
  const sync = new BinanceDepthSynchronizer();
  const snapshot: BinanceSnapshot = {
    lastUpdateId: 500,
    bids: [["100", "1"]],
    asks: [["101", "1"]],
  };

  sync.bridge(snapshot);
  assert.equal(sync.status, "SYNCING");

  // Delta arrives jumping past 501 (e.g. U = 505..510)
  sync.push({ U: 505, u: 510, pu: 504, b: [["100", "2"]], a: [] });
  assert.equal(sync.status, "ERROR");
});
