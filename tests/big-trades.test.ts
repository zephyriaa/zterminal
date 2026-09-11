import assert from "node:assert/strict";
import test from "node:test";
import { aggregateBigTrades, BigTradesBuffer } from "../src/lib/chart/overlays/big-trades";
import { DEFAULT_BIG_TRADES_SETTINGS } from "../src/lib/chart/overlays/contracts";
import type { TradeEvent } from "../src/lib/market/types";

const base: TradeEvent = { type: "trade", provider: "binance", environment: "live", symbol: "BTCUSDT", exchange: "BINANCE", timestamp: 1_000, sequence: 1, price: 100_000, quantity: 5, side: "buy" };

test("Big Trades buckets observed prints by time, aligned price, and aggressor side", () => {
  const result = aggregateBigTrades([{ ...base, price: 100_000.2 }, { ...base, sequence: 2, timestamp: 1_100, price: 100_000.4 }, { ...base, sequence: 3, timestamp: 1_100, side: "sell" }], 1, DEFAULT_BIG_TRADES_SETTINGS);
  assert.equal(result.clusters.length, 2);
  assert.equal(result.clusters[0].count, 2);
  assert.equal(result.clusters[0].price, 100_000);
  assert.equal(result.clusters[0].granularity, "aggregate");
  assert.equal(result.clusters[1].side, "sell");
});

test("Big Trades applies its notional filter after the configured aggregation window", () => {
  const settings = { ...DEFAULT_BIG_TRADES_SETTINGS, minimumNotional: 500_000 };
  const result = aggregateBigTrades([{ ...base, quantity: 3 }, { ...base, sequence: 2, timestamp: 1_100, quantity: 3 }], 1, settings);
  assert.equal(result.clusters.length, 1);
  assert.equal(result.clusters[0].notional, 600_000);
});

test("Big Trades keeps a bounded mutable trade buffer", () => {
  const buffer = new BigTradesBuffer(2);
  buffer.push(base);
  buffer.push({ ...base, sequence: 2, timestamp: 1_250 });
  buffer.push({ ...base, sequence: 3, timestamp: 1_500 });
  assert.equal(buffer.snapshot(1, DEFAULT_BIG_TRADES_SETTINGS).clusters.length, 2);
});
