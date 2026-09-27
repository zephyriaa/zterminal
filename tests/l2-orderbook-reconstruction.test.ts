import assert from "node:assert/strict";
import test from "node:test";
import { BinanceDepthSynchronizer, type BinanceDepth, type BinanceSnapshot } from "../src/lib/market/public-stream/binance-depth";
import { OKXDepthSynchronizer, type OKXBookPayload } from "../src/lib/market/adapters/okx-l2-adapter";
import { CoinbaseDepthSynchronizer, type CoinbaseL2Message } from "../src/lib/market/adapters/coinbase-l2-adapter";
import { crc32Signed, buildOkxChecksumString, validateOkxChecksum } from "../src/lib/market/okx-crc32";
import { ThrottledOrderBookBuffer } from "../src/lib/market/throttled-orderbook";
import type { L2OrderBookSnapshot } from "../src/lib/market/l2-types";

// Helper for Binance events
function makeBinanceDepth(U: number, u: number, pu?: number, b: [string, string][] = [], a: [string, string][] = []): BinanceDepth {
  return { U, u, pu, b, a };
}

test("Binance depth synchronizer enforces strict U <= lastUpdateId + 1 sequencing", () => {
  const sync = new BinanceDepthSynchronizer();

  // Buffer events prior to snapshot
  sync.push(makeBinanceDepth(100, 105, 99, [["65000", "1.5"]]));
  sync.push(makeBinanceDepth(106, 110, 105, [["65001", "2.0"]]));

  // Snapshot arrives with lastUpdateId = 104
  const snapshot: BinanceSnapshot = {
    lastUpdateId: 104,
    bids: [["64990", "5.0"]],
    asks: [["65010", "5.0"]],
  };

  const bridged = sync.bridge(snapshot);
  assert.equal(bridged, true);
  assert.equal(sync.status, "LIVE");

  // Valid next update: U = 111, u = 115, pu = 110
  sync.push(makeBinanceDepth(111, 115, 110, [["64995", "1.0"]]));
  assert.equal(sync.status, "LIVE");

  // Gap detected: event skips from 115 to U = 118
  sync.push(makeBinanceDepth(118, 120, 117, [["64996", "1.0"]]));
  assert.equal(sync.status, "ERROR");
  assert.equal(sync.book.bestBid(), undefined);
});

test("OKX CRC32 checksum engine matches IEEE 802.3 signed 32-bit standard", () => {
  // Test basic CRC32 calculations
  const crcEmpty = crc32Signed("");
  assert.equal(crcEmpty, 0);

  const crcTest = crc32Signed("123456789");
  // Standard IEEE 802.3 CRC32 for "123456789" is 0xCBF43926 = -873187034 as signed 32-bit int
  assert.equal(crcTest, -873187034);

  // Checksum string interleaving
  const bids: [string, string][] = [["65000", "2"], ["64900", "3"]];
  const asks: [string, string][] = [["65100", "1"], ["65200", "4"]];
  const expectedStr = "65000:2:65100:1:64900:3:65200:4";
  const str = buildOkxChecksumString(bids, asks);
  assert.equal(str, expectedStr);

  const expectedCrc = crc32Signed(expectedStr);
  assert.equal(validateOkxChecksum(bids, asks, expectedCrc), true);
  assert.equal(validateOkxChecksum(bids, asks, expectedCrc + 1), false);
});

test("OKX depth synchronizer reconstructs books and rejects corrupted frames", () => {
  const sync = new OKXDepthSynchronizer("BTC-USDT");

  const snapshotBids: [string, string][] = [["65000", "2"], ["64900", "1"]];
  const snapshotAsks: [string, string][] = [["65100", "3"], ["65200", "5"]];
  const str = buildOkxChecksumString(snapshotBids, snapshotAsks);
  const validChecksum = crc32Signed(str);

  const snapshotPayload: OKXBookPayload = {
    action: "snapshot",
    arg: { channel: "books", instId: "BTC-USDT" },
    data: [{
      bids: snapshotBids,
      asks: snapshotAsks,
      ts: "1700000000000",
      seqId: 100,
      checksum: validChecksum,
    }],
  };

  assert.equal(sync.handleMessage(snapshotPayload), true);
  assert.equal(sync.status, "LIVE");
  assert.equal(sync.book.bestBid()?.price, 65000);
  assert.equal(sync.book.bestAsk()?.price, 65100);

  // Delta update with valid checksum
  const updatedBids: [string, string][] = [["65000", "5"], ["64900", "1"]];
  const updatedAsks: [string, string][] = [["65100", "3"], ["65200", "5"]];
  const updateStr = buildOkxChecksumString(updatedBids, updatedAsks);
  const updateChecksum = crc32Signed(updateStr);

  const updatePayload: OKXBookPayload = {
    action: "update",
    arg: { channel: "books", instId: "BTC-USDT" },
    data: [{
      bids: [["65000", "5"]],
      asks: [],
      ts: "1700000001000",
      seqId: 101,
      prevSeqId: 100,
      checksum: updateChecksum,
    }],
  };

  assert.equal(sync.handleMessage(updatePayload), true);
  assert.equal(sync.book.bestBid()?.size, 5);

  // Corrupted update: wrong checksum
  const corruptedPayload: OKXBookPayload = {
    action: "update",
    arg: { channel: "books", instId: "BTC-USDT" },
    data: [{
      bids: [["65000", "10"]],
      asks: [],
      ts: "1700000002000",
      seqId: 102,
      prevSeqId: 101,
      checksum: 9999999, // Intentional mismatch
    }],
  };

  assert.equal(sync.handleMessage(corruptedPayload), false);
  assert.equal(sync.status, "ERROR");
  assert.equal(sync.health, "DEGRADED");
  assert.equal(sync.book.bestBid(), undefined);
});

test("Coinbase Advanced Trade synchronizer handles snapshot, deltas, and sequence gaps", () => {
  const sync = new CoinbaseDepthSynchronizer("BTC-USD");

  const snapshotMsg: CoinbaseL2Message = {
    channel: "l2_data",
    sequence_num: 1,
    events: [{
      type: "snapshot",
      product_id: "BTC-USD",
      updates: [
        { side: "bid", price_level: "65000", new_quantity: "2.5" },
        { side: "offer", price_level: "65050", new_quantity: "1.8" },
      ],
    }],
  };

  assert.equal(sync.handleMessage(snapshotMsg), true);
  assert.equal(sync.status, "LIVE");
  assert.equal(sync.book.bestBid()?.price, 65000);
  assert.equal(sync.book.bestAsk()?.price, 65050);

  // Delta update: prune a level (size 0)
  const deltaMsg: CoinbaseL2Message = {
    channel: "l2_data",
    sequence_num: 2,
    events: [{
      type: "update",
      product_id: "BTC-USD",
      updates: [
        { side: "bid", price_level: "65000", new_quantity: "0" },
      ],
    }],
  };

  assert.equal(sync.handleMessage(deltaMsg), true);
  assert.equal(sync.book.bestBid(), undefined);

  // Sequence gap: skips from sequence 2 to sequence 5
  const gapMsg: CoinbaseL2Message = {
    channel: "l2_data",
    sequence_num: 5,
    events: [{
      type: "update",
      product_id: "BTC-USD",
      updates: [
        { side: "bid", price_level: "64900", new_quantity: "3.0" },
      ],
    }],
  };

  assert.equal(sync.handleMessage(gapMsg), false);
  assert.equal(sync.status, "ERROR");
  assert.equal(sync.health, "DEGRADED");
  assert.equal(sync.book.bestBid(), undefined);
});

test("ThrottledOrderBookBuffer throttles high-frequency push updates and emits trimmed snapshots", (t, done) => {
  const throttler = new ThrottledOrderBookBuffer(60, 5); // 60 FPS, depth 5

  const testSnapshot: L2OrderBookSnapshot = {
    exchange: "binance",
    symbol: "BTCUSDT",
    sequence: 12345,
    timestamp: Date.now(),
    health: "LIVE",
    bids: [[65000, 1], [64990, 2], [64980, 3], [64970, 4], [64960, 5], [64950, 6]],
    asks: [[65010, 1], [65020, 2], [65030, 3], [65040, 4], [65050, 5], [65060, 6]],
  };

  let received = 0;
  const unsubscribe = throttler.subscribe(snap => {
    received++;
    assert.equal(snap.symbol, "BTCUSDT");
    // Assert trimmed depth
    assert.equal(snap.bids.length, 5);
    assert.equal(snap.asks.length, 5);
  });

  // Push 100 rapid snapshots
  for (let i = 0; i < 100; i++) {
    throttler.push({
      ...testSnapshot,
      sequence: 12345 + i,
    });
  }

  // Allow one throttle cycle to flush
  setTimeout(() => {
    unsubscribe();
    throttler.destroy();
    assert.ok(received >= 1 && received <= 5, `Expected 1-5 throttled frames, got ${received}`);
    done();
  }, 50);
});
