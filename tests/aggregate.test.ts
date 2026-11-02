import test from "node:test";
import assert from "node:assert/strict";
import { mergeVenueBars } from "../src/lib/market/aggregate";
import type { BarsResult, ContractMetadata } from "../src/lib/market/types";

function mockContract(exchange: string, multiplier = 1): ContractMetadata {
  return {
    root: "BTC",
    symbol: "BTCUSDT",
    description: "BTC perpetual",
    exchange: exchange as any,
    product: "perpetual",
    tickSize: 0.1,
    tickValue: 0.1,
    multiplier,
    currency: "USDT",
    session: "crypto",
    supportsDepth: true,
    supportsMBO: false,
    verified: true,
  };
}

function mockResult(provider: string, volumeUnit: "base" | "contracts", multiplier: number, bars: { t: number; o: number; h: number; l: number; c: number; v: number }[]): BarsResult {
  return {
    symbol: "BTCUSDT",
    canonicalSymbol: "BTCUSDT",
    nativeSymbol: "BTCUSDT",
    timeframe: "1m",
    selectedProvider: provider,
    effectiveProvider: provider,
    environment: "live",
    dataStatus: "HISTORICAL",
    contract: mockContract(provider.toUpperCase(), multiplier),
    retrievedAt: 1700000000000,
    sourceTimestamp: bars.at(-1)?.t ?? null,
    timestampUnit: "ms",
    integrity: "provider-ohlcv",
    cache: "network",
    requestedFrom: 1700000000000,
    requestedTo: 1700000060000,
    requestedCount: bars.length,
    gapCount: 0,
    hasOpenCandle: false,
    volumeUnit,
    bars,
  };
}

test("mergeVenueBars correctly volume-weights OHLC and sums volume", () => {
  const t = 1700000000000;
  const resA = mockResult("binance", "base", 1, [
    { t, o: 100, h: 105, l: 95, c: 100, v: 10 },
  ]);
  const resB = mockResult("bybit", "base", 1, [
    { t, o: 110, h: 115, l: 105, c: 110, v: 30 },
  ]);

  const merged = mergeVenueBars([resA, resB]);
  assert.equal(merged.length, 1);
  const bar = merged[0];
  assert.equal(bar.t, t);
  assert.equal(bar.v, 40); // 10 + 30
  // VWAP open: (100*10 + 110*30) / 40 = 4300 / 40 = 107.5
  assert.equal(bar.o, 107.5);
  // VWAP close: (100*10 + 110*30) / 40 = 107.5
  assert.equal(bar.c, 107.5);
  // VWAP high: (105*10 + 115*30) / 40 = 4500 / 40 = 112.5
  assert.equal(bar.h, 112.5);
  // VWAP low: (95*10 + 105*30) / 40 = 4100 / 40 = 102.5
  assert.equal(bar.l, 102.5);
});

test("mergeVenueBars normalizes contract volume to base units", () => {
  const t = 1700000000000;
  // Gate.io quotes in contracts where 1 contract = 0.0001 BTC
  const resGate = mockResult("gateio", "contracts", 0.0001, [
    { t, o: 100, h: 105, l: 95, c: 100, v: 100_000 }, // 100,000 * 0.0001 = 10 BTC
  ]);
  // Binance quotes in base units (BTC)
  const resBinance = mockResult("binance", "base", 1, [
    { t, o: 100, h: 105, l: 95, c: 100, v: 15 }, // 15 BTC
  ]);

  const merged = mergeVenueBars([resGate, resBinance]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].v, 25); // 10 + 15
});

test("mergeVenueBars rejects outliers exceeding 2% from median close", () => {
  const t = 1700000000000;
  const resA = mockResult("binance", "base", 1, [{ t, o: 100, h: 101, l: 99, c: 100, v: 10 }]);
  const resB = mockResult("bybit", "base", 1, [{ t, o: 100.1, h: 101.1, l: 99.1, c: 100.1, v: 10 }]);
  const resC = mockResult("okx", "base", 1, [{ t, o: 99.9, h: 100.9, l: 98.9, c: 99.9, v: 10 }]);
  // Rogue tick: 8% below median
  const resD = mockResult("gateio", "base", 1, [{ t, o: 92, h: 93, l: 91, c: 92, v: 100 }]);

  const merged = mergeVenueBars([resA, resB, resC, resD]);
  assert.equal(merged.length, 1);
  const bar = merged[0];
  // Rogue venue D must be rejected, total volume must only be 30 from A, B, C
  assert.equal(bar.v, 30);
  assert.ok(bar.c > 99.5 && bar.c < 100.5, `Close ${bar.c} should not be dragged down by 92 outlier`);
});

test("mergeVenueBars handles zero volume gracefully without NaN", () => {
  const t = 1700000000000;
  const resA = mockResult("binance", "base", 1, [{ t, o: 50, h: 55, l: 45, c: 50, v: 0 }]);
  const resB = mockResult("bybit", "base", 1, [{ t, o: 60, h: 65, l: 55, c: 60, v: 0 }]);

  const merged = mergeVenueBars([resA, resB]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].v, 0);
  assert.equal(merged[0].o, 55); // (50 + 60) / 2
  assert.equal(merged[0].c, 55);
  assert.ok(!Number.isNaN(merged[0].o));
});

test("mergeVenueBars handles partial venue availability", () => {
  const t1 = 1700000000000;
  const t2 = 1700000060000;
  // Binance has both candles
  const resA = mockResult("binance", "base", 1, [
    { t: t1, o: 100, h: 102, l: 98, c: 101, v: 10 },
    { t: t2, o: 101, h: 103, l: 99, c: 102, v: 12 },
  ]);
  // Bybit only has the first candle
  const resB = mockResult("bybit", "base", 1, [
    { t: t1, o: 100.5, h: 102.5, l: 98.5, c: 101.5, v: 10 },
  ]);

  const merged = mergeVenueBars([resA, resB]);
  assert.equal(merged.length, 2);
  assert.equal(merged[0].t, t1);
  assert.equal(merged[0].v, 20); // both
  assert.equal(merged[1].t, t2);
  assert.equal(merged[1].v, 12); // Binance alone
});
