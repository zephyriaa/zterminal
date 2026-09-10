import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateVaR,
  calculateExcursion,
  AdvancedRiskEngine,
} from "../src/domain/risk/advanced-engine";

test("calculateVaR computes parametric VaR, historical VaR, and CVaR accurately", () => {
  // 10 daily returns
  const dailyReturns = [
    -0.05, -0.04, -0.02, -0.01, 0.0, 0.01, 0.02, 0.02, 0.03, 0.04
  ];
  const portfolio = 100_000;

  const var95 = calculateVaR(dailyReturns, portfolio, 0.95, 1);
  assert.equal(var95.confidence, 0.95);
  assert.ok(var95.parametricVaR > 0, "Parametric VaR must be positive");
  assert.ok(var95.historicalVaR > 0, "Historical VaR must be positive");
  assert.ok(
    var95.expectedShortfallCVaR >= var95.historicalVaR,
    "Expected Shortfall CVaR must be >= Historical VaR",
  );
});

test("calculateExcursion computes MAE and MFE for Long and Short trades", () => {
  // Long trade entered at 100, exited at 105
  // Intra-trade went down to 97, and up to 108
  const longExcursion = calculateExcursion(
    "T-1",
    "BTCUSDT",
    "long",
    100,
    105,
    [102, 108, 105],
    [97, 100, 103],
  );

  assert.equal(longExcursion.pnl, 5);
  assert.equal(longExcursion.mae, 3); // 100 - 97 = 3
  assert.equal(longExcursion.mfe, 8); // 108 - 100 = 8

  // Short trade entered at 100, exited at 95
  // Intra-trade went up to 103, and down to 92
  const shortExcursion = calculateExcursion(
    "T-2",
    "BTCUSDT",
    "short",
    100,
    95,
    [103, 101, 98],
    [98, 92, 94],
  );

  assert.equal(shortExcursion.pnl, 5);
  assert.equal(shortExcursion.mae, 3); // 103 - 100 = 3
  assert.equal(shortExcursion.mfe, 8); // 100 - 92 = 8
});

test("AdvancedRiskEngine trips circuit-breakers on drawdown and consecutive losses", () => {
  const engine = new AdvancedRiskEngine(100_000, {
    maxDrawdownPct: 0.05, // 5% max drawdown
    maxConsecutiveLosses: 3,
    coolDownDurationMs: 60_000,
    dailyLossLimit: 5000,
  });

  const now = 1_000_000;

  // 1. Check healthy state
  let status = engine.updateEquity(98_000, now);
  assert.equal(status.isTripped, false);
  assert.equal(status.currentDrawdownPct, 0.02);

  // 2. Drawdown exceeds 5% (drop to 94,000)
  status = engine.updateEquity(94_000, now);
  assert.equal(status.isTripped, true);
  assert.match(status.reason ?? "", /drawdown/i);
  assert.equal(status.coolDownUntil, now + 60_000);

  // 3. Reset and test consecutive losses
  engine.resetCircuitBreaker();
  status = engine.getCircuitBreakerStatus(now);
  assert.equal(status.isTripped, false);

  engine.recordTradeOutcome(-500, now);
  engine.recordTradeOutcome(-300, now);
  status = engine.getCircuitBreakerStatus(now);
  assert.equal(status.isTripped, false);
  assert.equal(status.consecutiveLosses, 2);

  // Third consecutive loss trips breaker
  status = engine.recordTradeOutcome(-200, now);
  assert.equal(status.isTripped, true);
  assert.match(status.reason ?? "", /consecutive loss/i);

  // Profitable trade resets consecutive losses count
  engine.resetCircuitBreaker();
  engine.recordTradeOutcome(1000, now);
  status = engine.getCircuitBreakerStatus(now);
  assert.equal(status.consecutiveLosses, 0);
});
