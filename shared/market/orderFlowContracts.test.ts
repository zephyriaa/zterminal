import { describe, expect, it } from "vitest";
import {
  calculateCvd,
  calculateLiveTapeBuckets,
  calculateLiveTapeFootprint,
  findLargeTapePrints,
  normalizeGateOrderBookSnapshot,
  normalizeGateOrderBookUpdate,
  normalizeGatePublicTrades,
  reconcileGateOrderBook,
  summarizeDepthImbalance,
  toTimeAndSales,
} from "./orderFlowContracts";

describe("Gate.io order-flow contracts", () => {
  it("preserves documented signed taker sizes while deterministically ordering and deduplicating public trades", () => {
    const trades = normalizeGatePublicTrades([
      { id: 2, contract: "BTC_USDT", price: "100", size: "-2.5", create_time_ms: 2_000, is_internal: false },
      { id: 1, contract: "BTC_USDT", price: "99", size: "3", create_time_ms: 1_000, is_internal: false },
      { id: 2, contract: "BTC_USDT", price: "100", size: "-2.5", create_time_ms: 2_000, is_internal: false },
      { id: 3, contract: "BTC_USDT", price: "101", size: "0", create_time_ms: 3_000 },
    ]);

    expect(trades.map(trade => [trade.id, trade.signedSize])).toEqual([["1", 3], ["2", -2.5]]);
    expect(calculateCvd(trades)).toEqual([
      { timestamp: 1_000, value: 3, tradeId: "1" },
      { timestamp: 2_000, value: 0.5, tradeId: "2" },
    ]);
  });

  it("derives bounded Time & Sales and exact-price footprint only from exchange-signed public trades", () => {
    const trades = normalizeGatePublicTrades([
      { id: 3, contract: "BTC_USDT", price: "100", size: "2", create_time_ms: 3_000 },
      { id: 1, contract: "BTC_USDT", price: "100", size: "-1.5", create_time_ms: 1_000 },
      { id: 2, contract: "BTC_USDT", price: "99", size: "4", create_time_ms: 2_000 },
    ]);
    expect(toTimeAndSales(trades)).toEqual([
      { tradeId: "1", timestamp: 1_000, price: 100, size: 1.5, side: "SELL" },
      { tradeId: "2", timestamp: 2_000, price: 99, size: 4, side: "BUY" },
      { tradeId: "3", timestamp: 3_000, price: 100, size: 2, side: "BUY" },
    ]);
    expect(calculateLiveTapeFootprint(trades)).toEqual([
      { price: 100, buySize: 2, sellSize: 1.5, delta: 0.5, tradeCount: 2 },
      { price: 99, buySize: 4, sellSize: 0, delta: 4, tradeCount: 1 },
    ]);
  });

  it("filters large prints only from the selected bounded public tape by a reported-size threshold", () => {
    const trades = normalizeGatePublicTrades([
      { id: 3, contract: "BTC_USDT", price: "102", size: "4", create_time_ms: 3_000 },
      { id: 1, contract: "BTC_USDT", price: "100", size: "-2.5", create_time_ms: 1_000 },
      { id: 2, contract: "BTC_USDT", price: "101", size: "3", create_time_ms: 2_000 },
    ]);
    expect(findLargeTapePrints(trades, 3)).toEqual([
      { provider: "gateio", symbol: "BTC_USDT", tradeId: "2", timestamp: 2_000, price: 101, size: 3, side: "BUY", minimumReportedSize: 3 },
      { provider: "gateio", symbol: "BTC_USDT", tradeId: "3", timestamp: 3_000, price: 102, size: 4, side: "BUY", minimumReportedSize: 3 },
    ]);
    expect(findLargeTapePrints(trades, 0)).toEqual([]);
  });

  it("buckets live signed tape and summarizes depth without manufacturing a directional prediction", () => {
    const trades = normalizeGatePublicTrades([
      { id: 1, contract: "BTC_USDT", price: "100", size: "3", create_time_ms: 31_000 },
      { id: 2, contract: "BTC_USDT", price: "101", size: "-1", create_time_ms: 45_000 },
      { id: 3, contract: "BTC_USDT", price: "102", size: "-2", create_time_ms: 62_000 },
    ]);
    expect(calculateLiveTapeBuckets(trades, 30_000)).toEqual([
      { start: 30_000, end: 60_000, buySize: 3, sellSize: 1, delta: 2, tradeCount: 2 },
      { start: 60_000, end: 90_000, buySize: 0, sellSize: 2, delta: -2, tradeCount: 1 },
    ]);
    expect(summarizeDepthImbalance([{ price: 99, size: 8 }], [{ price: 101, size: 2 }])).toEqual({ bidSize: 8, askSize: 2, net: 6, ratio: 0.6, state: "BID_HEAVY" });
    expect(summarizeDepthImbalance([], [])).toEqual({ bidSize: 0, askSize: 0, net: 0, ratio: null, state: "EMPTY" });
  });

  it("reconciles a snapshot with absolute price-level deltas only when update IDs cover the snapshot successor", () => {
    const snapshot = normalizeGateOrderBookSnapshot({
      id: 100,
      contract: "BTC_USDT",
      t: 1_000,
      bids: [{ p: "99", s: "4" }],
      asks: [{ p: "101", s: "3" }],
    });
    const first = normalizeGateOrderBookUpdate({
      s: "BTC_USDT",
      U: 99,
      u: 101,
      t: 1_100,
      b: [{ p: "99", s: "0" }, { p: "98", s: "6" }],
      a: [{ p: "101", s: "5" }],
    });
    const second = normalizeGateOrderBookUpdate({
      s: "BTC_USDT",
      U: 102,
      u: 103,
      t: 1_200,
      b: [{ p: "98", s: "7" }],
      a: [{ p: "102", s: "1" }],
    });

    expect(snapshot).not.toBeNull();
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(reconcileGateOrderBook(snapshot!, [first!, second!])).toEqual({
      bids: [{ price: 98, size: 7 }],
      asks: [{ price: 101, size: 5 }, { price: 102, size: 1 }],
      lastUpdateId: 103,
    });
  });

  it("rejects an update sequence gap instead of rendering a fabricated local book", () => {
    const snapshot = normalizeGateOrderBookSnapshot({
      id: 100,
      contract: "BTC_USDT",
      bids: [],
      asks: [],
    });
    const gap = normalizeGateOrderBookUpdate({
      s: "BTC_USDT",
      U: 103,
      u: 104,
      b: [],
      a: [],
    });

    expect(reconcileGateOrderBook(snapshot!, [gap!])).toBeNull();
  });

  it("rejects malformed or non-positive market values at the contract boundary", () => {
    expect(normalizeGateOrderBookSnapshot({ id: "bad", contract: "BTC_USDT", bids: [], asks: [] })).toBeNull();
    expect(normalizeGateOrderBookUpdate({ s: "BTC_USDT", U: 2, u: 1, b: [], a: [] })).toBeNull();
    expect(normalizeGatePublicTrades([{ id: 1, contract: "BTC_USDT", price: "0", size: "1", create_time_ms: 1 }])).toEqual([]);
  });
});
