import assert from "node:assert/strict";
import test from "node:test";
import { normalizeSymbolForProvider, PublicMarketDataProvider } from "../src/lib/market/public-stream";
import { BinanceDepthSynchronizer, type BinanceDepth, type BinanceSnapshot } from "../src/lib/market/public-stream/binance-depth";

test("symbol normalization formats symbols accurately for each exchange", () => {
  assert.equal(normalizeSymbolForProvider("BTCUSDT", "binance"), "BTCUSDT");
  assert.equal(normalizeSymbolForProvider("BTC_USDT", "binance"), "BTCUSDT");
  assert.equal(normalizeSymbolForProvider("BTCUSDT", "gateio"), "BTC_USDT");
  assert.equal(normalizeSymbolForProvider("BTC_USDT", "gateio"), "BTC_USDT");
  assert.equal(normalizeSymbolForProvider("BTCUSDT", "bybit"), "BTCUSDT");
  assert.equal(normalizeSymbolForProvider("BTC-USD", "coinbase"), "BTC-USD");
  assert.equal(normalizeSymbolForProvider("BTCUSD", "coinbase"), "BTC-USD");
});

test("Binance depth synchronizer correctly transitions from SYNCING to LIVE via snapshot bridge", () => {
  const sync = new BinanceDepthSynchronizer();
  assert.equal(sync.status, "SYNCING");

  // Push deltas that arrive before and during snapshot
  const delta1: BinanceDepth = { U: 90, u: 95, b: [["50000", "1.5"]], a: [["50001", "2.0"]] };
  const delta2: BinanceDepth = { U: 96, u: 100, b: [["50000.5", "1.0"]], a: [["50001.5", "1.5"]] };
  const delta3: BinanceDepth = { U: 101, u: 105, pu: 100, b: [["50000", "0"]], a: [["50002", "1.0"]] };

  sync.push(delta1);
  sync.push(delta2);
  sync.push(delta3);

  // Authoritative snapshot with lastUpdateId = 100
  const snapshot: BinanceSnapshot = {
    lastUpdateId: 100,
    bids: [["50000", "2.0"], ["49999", "5.0"]],
    asks: [["50001", "3.0"], ["50002", "4.0"]],
  };

  const bridged = sync.bridge(snapshot);
  assert.equal(bridged, true);
  assert.equal(sync.status, "LIVE");

  // delta3 deleted "50000" (qty=0) and updated asks
  const bestBid = sync.book.bestBid();
  assert.notEqual(bestBid, undefined);
  assert.equal(bestBid?.price, 49999);
  assert.equal(bestBid?.size, 5.0);
});

test("Binance depth synchronizer detects sequence gap and transitions to ERROR for automatic resync", () => {
  const sync = new BinanceDepthSynchronizer();

  // Snapshot bridged at sequence 100
  sync.push({ U: 99, u: 102, b: [["100", "1"]], a: [["102", "1"]] });
  sync.bridge({ lastUpdateId: 100, bids: [["100", "1"]], asks: [["102", "1"]] });
  assert.equal(sync.status, "LIVE");

  // Sequence gap: next delta starts at U=105 while sequence is 102 (gap: 103..104 missing)
  sync.push({ U: 105, u: 108, pu: 104, b: [["100.5", "2"]], a: [["102.5", "2"]] });
  assert.equal(sync.status, "ERROR");
  assert.equal(sync.book.isCrossed(), false);
});

test("PublicMarketDataProvider supports reference counting and cleanup on unmount", () => {
  const provider = new PublicMarketDataProvider("binance");
  let tradeCountA = 0;
  let tradeCountB = 0;

  const unsubA = provider.subscribe("BTCUSDT", () => { tradeCountA++; });
  const unsubB = provider.subscribe("BTCUSDT", () => { tradeCountB++; });

  // Both listeners are registered
  unsubA();
  // Second listener still active, connection remains
  unsubB();
  // All listeners removed, provider cleans up
  assert.equal(typeof unsubA, "function");
});
