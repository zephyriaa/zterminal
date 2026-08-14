import assert from "node:assert/strict";
import test from "node:test";
import { evaluateAlertRule } from "../src/domain/alerts/evaluator";
import { buildVolumeProfile, classifyRegime, computeOpeningRange, computeSessionVwap } from "../src/domain/analytics/market";
import { compareExecution } from "../src/domain/journal/performance";
import type { DataProvenance, Instrument, RiskPlan, TradePlan } from "../src/domain/models";
import { evaluateTradePlan } from "../src/domain/risk/engine";
import { calculateFixedRiskSizing } from "../src/domain/risk/sizing";
import { validateStrategyDefinition } from "../src/domain/strategy/schema";
import { resolveGatewayOrigins, validateSubscriptionRequest } from "../src/lib/market/gateway-policy";
import { bootstrapMean, createWalkForwardWindows, simulateTradeSequence } from "../src/domain/validation/resampling";
import type { Bar } from "../src/lib/market/types";

const provenance: DataProvenance = {
  provider: "mock",
  environment: "simulation",
  status: "SIMULATED",
  observedAt: 1,
  receivedAt: 1,
  exchangeTimezone: "UTC",
};

const instrument: Instrument = {
  canonicalSymbol: "TEST",
  providerSymbol: "TEST",
  metadata: {
    root: "TEST",
    symbol: "TEST",
    description: "Test instrument",
    exchange: "GATEIO",
    product: "perpetual",
    tickSize: 0.25,
    tickValue: 2.5,
    multiplier: 10,
    currency: "USDT",
    session: "crypto",
    supportsDepth: true,
    supportsMBO: false,
  },
};

function bar(t: number, o: number, h: number, l: number, c: number, v: number): Bar {
  return { t, o, h, l, c, v };
}

test("risk evaluation reduces a manual plan to its configured risk budget and remains review-only", () => {
  const plan: TradePlan = {
    id: "plan-1",
    workspaceId: "workspace-1",
    instrument: "TEST",
    direction: "long",
    entryPrice: 100,
    stopPrice: 98,
    targetPrice: 104,
    requestedQuantity: 7,
    createdAt: 1,
    executionPermission: "review_only",
  };
  const riskPlan: RiskPlan = {
    id: "risk-1",
    workspaceId: "workspace-1",
    accountEquity: 10_000,
    currency: "USDT",
    maxRiskPerTrade: 100,
    maxDailyLoss: 500,
    maxWeeklyLoss: 1_000,
    maxGrossExposure: 10_000,
    createdAt: 1,
    updatedAt: 1,
  };
  const result = evaluateTradePlan(plan, { instrument, riskPlan, existingPositions: [], realizedDailyLoss: 0, realizedWeeklyLoss: 0 });
  assert.equal(result.decision, "needs_review");
  assert.equal(result.approvedQuantity, 5);
  assert.equal(result.perUnitRisk, 20);
  assert.equal(result.estimatedLoss, 100);
  assert.equal(result.estimatedProfit, 200);
  assert.equal(result.rewardToRisk, 2);
  assert.match(result.reasons.join(" "), /review-only/);
});

test("risk evaluation rejects a directionally invalid stop", () => {
  const plan: TradePlan = {
    id: "plan-2", workspaceId: "workspace-1", instrument: "TEST", direction: "short",
    entryPrice: 100, stopPrice: 98, requestedQuantity: 1, createdAt: 1, executionPermission: "review_only",
  };
  const riskPlan: RiskPlan = { id: "risk-2", workspaceId: "workspace-1", accountEquity: 10_000, currency: "USDT", maxRiskPerTrade: 100, maxDailyLoss: 500, maxWeeklyLoss: 1_000, maxGrossExposure: 10_000, createdAt: 1, updatedAt: 1 };
  assert.equal(evaluateTradePlan(plan, { instrument, riskPlan, existingPositions: [], realizedDailyLoss: 0, realizedWeeklyLoss: 0 }).decision, "rejected");
});

test("fixed-risk sizing returns only whole units within the selected risk budget", () => {
  assert.deepEqual(calculateFixedRiskSizing({ accountEquity: 10_000, riskPercent: 1, stopDistance: 2, tickSize: 0.25, multiplier: 10 }), {
    valid: true,
    riskAmount: 100,
    stopTicks: 8,
    perUnitRisk: 20,
    maxQuantity: 5,
  });
});

test("session VWAP resets only under the caller-provided session policy", () => {
  const bars = [bar(1, 10, 10, 10, 10, 2), bar(2, 20, 20, 20, 20, 2), bar(3, 30, 30, 30, 30, 1)];
  const values = computeSessionVwap(bars, (value) => value.t < 3 ? "session-a" : "session-b");
  assert.deepEqual(values.map((value) => value.vwap), [10, 15, 30]);
  const openingRange = computeOpeningRange(bars, 1, 3);
  assert.equal(openingRange.high, 20);
  assert.equal(openingRange.low, 10);
  assert.equal(openingRange.complete, true);
});

test("volume profile and regime outputs are deterministic for the same bars", () => {
  const bars = [
    bar(1, 100, 101, 99, 101, 10), bar(2, 101, 103, 100, 103, 20),
    bar(3, 103, 105, 102, 105, 20), bar(4, 105, 107, 104, 107, 20),
  ];
  const profile = buildVolumeProfile(bars, 1);
  assert.equal(profile.pointOfControl, 102);
  const regime = classifyRegime(bars, { lookback: 4, trendThreshold: 0.02, compressionThreshold: 0.001 });
  assert.equal(regime.kind, "trend");
});

test("structured strategies reject missing entry rules and invalid fixed sizing", () => {
  const issues = validateStrategyDefinition({
    id: "strategy-1", versionId: "strategy-1-v1", version: 1, name: "", instruments: [], timeframe: "5m", sessionId: "crypto",
    parameters: [], entry: {}, exit: [], filters: [], risk: { sizing: "fixed_quantity" }, createdAt: 1,
  });
  assert.ok(issues.length >= 4);
});

test("resampling utilities are deterministic and keep walk-forward periods purged", () => {
  const firstBootstrap = bootstrapMean([1, -2, 3, 4], { samples: 100, confidenceLevel: 0.9, seed: 7 });
  const secondBootstrap = bootstrapMean([1, -2, 3, 4], { samples: 100, confidenceLevel: 0.9, seed: 7 });
  assert.deepEqual(firstBootstrap, secondBootstrap);
  const simulation = simulateTradeSequence([1, -2, 3, 4], { paths: 100, initialEquity: 100, seed: 7 });
  assert.deepEqual(simulation.terminalEquity, { lower: 106, median: 106, upper: 106 });
  assert.deepEqual(createWalkForwardWindows(30, { inSample: 10, outOfSample: 5, step: 5, purge: 2 })[0], {
    index: 0,
    inSample: { from: 0, to: 10 },
    outOfSample: { from: 12, to: 17 },
  });
});

test("gateway policy requires explicit production origins and bounds subscription requests", () => {
  assert.deepEqual(resolveGatewayOrigins("production", undefined), []);
  assert.deepEqual(resolveGatewayOrigins("production", "https://terminal.example.com"), ["https://terminal.example.com"]);
  assert.equal(validateSubscriptionRequest({ types: ["trade", "invalid"] }, { activeSubscriptionCount: 0, maximumSubscriptions: 2 }).ok, false);
  assert.equal(validateSubscriptionRequest({ types: ["trade"] }, { activeSubscriptionCount: 2, maximumSubscriptions: 2 }).ok, false);
  assert.deepEqual(validateSubscriptionRequest({ types: ["quote"] }, { activeSubscriptionCount: 0, maximumSubscriptions: 2 }), { ok: true, types: new Set(["quote"]) });
});

test("alert evaluation returns contextual observations rather than trade instructions", () => {
  const result = evaluateAlertRule(
    { type: "PRICE_LEVEL_REACHED", direction: "above", level: 100 },
    { observedAt: 2, instrument: "TEST", previousPrice: 99, price: 100, context: { provenance, values: { venue: "test" } } },
  );
  assert.equal(result.triggered, true);
  assert.match(result.reason, /crossed above/);
  assert.equal(result.context.values.venue, "test");
});

test("journal performance separates actual execution from theoretical outcomes", () => {
  const comparison = compareExecution(
    [{ id: "theory-1", instrument: "TEST", direction: "long", entryTime: 100, entryPrice: 10, exitTime: 200, exitPrice: 12, quantity: 1, pnl: 20 }],
    [{ id: "actual-1", theoreticalTradeId: "theory-1", instrument: "TEST", direction: "long", entryTime: 110, entryPrice: 10.5, exitTime: 200, exitPrice: 12, quantity: 1, pnl: 15 }],
  );
  assert.equal(comparison.matchedTrades, 1);
  assert.equal(comparison.averageEntryDelayMs, 10);
  assert.equal(comparison.averageEntrySlippage, 0.5);
  assert.equal(comparison.executionDeltaPnl, -5);
});
