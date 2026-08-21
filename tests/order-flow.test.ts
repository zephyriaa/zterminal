import assert from "node:assert/strict";
import test from "node:test";
import {
  buildFootprint,
  buildTradeTape,
  calculateBookImbalance,
  calculateCVD,
  calculateMicroprice,
  calculateOpenInterestChange,
  detectResearchEvents,
  ORDER_FLOW_CALCULATION_VERSION,
} from "../src/lib/market/order-flow";
import type { DerivativesEvent, TradeEvent } from "../src/lib/market/types";

function trade(timestamp: number, sequence: number, side: "buy" | "sell", price: number, quantity: number): TradeEvent {
  return { type: "trade", provider: "binance", environment: "live", symbol: "BTCUSDT", exchange: "BINANCE", timestamp, sequence, side, price, quantity };
}

const observedTrades = [
  trade(100, 1, "buy", 100, 2),
  trade(900, 2, "sell", 100, 0.5),
  trade(1_100, 3, "sell", 99.5, 3),
  trade(1_500, 4, "buy", 100.5, 1),
];

test("calculates CVD from exchange-reported aggressive sides with deterministic buckets", () => {
  assert.deepEqual(calculateCVD(observedTrades, 1_000).map(({ timestamp, buyVolume, sellVolume, delta, value }) => ({ timestamp, buyVolume, sellVolume, delta, value })), [
    { timestamp: 0, buyVolume: 2, sellVolume: 0.5, delta: 1.5, value: 1.5 },
    { timestamp: 1_000, buyVolume: 1, sellVolume: 3, delta: -2, value: -0.5 },
  ]);
});

test("filters and aggregates Time & Sales without altering its observed side or price", () => {
  assert.deepEqual(buildTradeTape(observedTrades, { side: "buy", minimumQuantity: 1, aggregationWindowMs: 1_000 }), [
    { timestamp: 0, side: "buy", price: 100, quantity: 2, notional: 200, count: 1, firstSequence: 1, lastSequence: 1 },
    { timestamp: 1_000, side: "buy", price: 100.5, quantity: 1, notional: 100.5, count: 1, firstSequence: 4, lastSequence: 4 },
  ]);
});

test("builds a footprint with price-level buy/sell volume and delta", () => {
  const footprint = buildFootprint(observedTrades, 0.5, 1_000);
  assert.deepEqual(footprint[0], {
    timestamp: 0,
    endTimestamp: 1_000,
    buyVolume: 2,
    sellVolume: 0.5,
    delta: 1.5,
    tradeCount: 2,
    levels: [{ price: 100, buyVolume: 2, sellVolume: 0.5, delta: 1.5, totalVolume: 2.5, tradeCount: 2 }],
  });
  assert.deepEqual(footprint[1]?.levels, [
    { price: 100.5, buyVolume: 1, sellVolume: 0, delta: 1, totalVolume: 1, tradeCount: 1 },
    { price: 99.5, buyVolume: 0, sellVolume: 3, delta: -3, totalVolume: 3, tradeCount: 1 },
  ]);
});

test("calculates top-N book imbalance and microprice from verified L2 levels", () => {
  const depth = [
    { side: "buy" as const, price: 100, size: 3 },
    { side: "buy" as const, price: 99.5, size: 2 },
    { side: "sell" as const, price: 101, size: 1 },
    { side: "sell" as const, price: 101.5, size: 4 },
  ];
  assert.deepEqual(calculateBookImbalance(depth, 2), { value: 0, bidDepth: 5, askDepth: 5, window: 2 });
  assert.deepEqual(calculateMicroprice(depth), {
    value: 100.75,
    bestBid: { price: 100, size: 3 },
    bestAsk: { price: 101, size: 1 },
  });
});

test("reports unavailable open interest rather than manufacturing OI delta", () => {
  const live = (openInterest: number): DerivativesEvent => ({ type: "derivatives", provider: "binance", environment: "live", symbol: "BTCUSDT", exchange: "BINANCE", timestamp: 1, openInterest, openInterestStatus: "live" });
  assert.deepEqual(calculateOpenInterestChange(live(110), live(100)), { value: 10, percent: 0.1, current: 110, baseline: 100, status: "live" });
  assert.deepEqual(calculateOpenInterestChange({ ...live(110), openInterestStatus: "unavailable" }, live(100)), { value: null, percent: null, current: 110, baseline: 100, status: "unavailable" });
});

test("emits only inspectable order-flow candidates with their exact rolling window and thresholds", () => {
  const events = detectResearchEvents([
    trade(9_000, 1, "buy", 100, 3),
    trade(9_250, 2, "buy", 100.5, 3),
    trade(9_500, 3, "buy", 101, 3),
  ], { now: 10_000, tickSize: 0.5, minimumVolume: 6, dominance: 0.8, minimumLevels: 3, maxAbsorptionRangeTicks: 3 });
  assert.equal(events.length, 2);
  assert.equal(events[0]?.kind, "sweep-candidate");
  assert.equal(events[0]?.calculationVersion, ORDER_FLOW_CALCULATION_VERSION);
  assert.deepEqual(events[0]?.source.rollingWindow, { from: 7_000, to: 10_000, milliseconds: 3_000 });
  assert.deepEqual(events[0]?.source.providerSequences, [1, 2, 3]);
});
