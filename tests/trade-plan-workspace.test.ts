import test from "node:test";
import assert from "node:assert/strict";
import {
  TradePlanWorkspaceManager,
} from "../src/domain/trade-plan/workspace";

test("TradePlanWorkspaceManager compiles multi-scenario plan with R-multiples and EV", () => {
  const manager = new TradePlanWorkspaceManager();

  const plan = manager.createPlan({
    id: "PLAN-BTC-01",
    symbol: "BTCUSDT",
    direction: "long",
    entryPrice: 60_000,
    stopPrice: 58_000, // risk = 2,000 per unit
    quantity: 2, // capital at risk = 4,000
    brackets: [
      { targetPrice: 64_000, percentageQuantity: 50 }, // +4,000 dist = 2R, 1 BTC = +4,000 profit
      { targetPrice: 66_000, percentageQuantity: 50 }, // +6,000 dist = 3R, 1 BTC = +6,000 profit
    ],
  });

  assert.equal(plan.initialRiskPerUnit, 2000);
  assert.equal(plan.capitalAtRisk, 4000);
  assert.equal(plan.brackets.length, 2);
  assert.equal(plan.brackets[0].rMultiple, 2.0);
  assert.equal(plan.brackets[0].projectedProfit, 4000);
  assert.equal(plan.brackets[1].rMultiple, 3.0);
  assert.equal(plan.brackets[1].projectedProfit, 6000);

  // Breakeven win rate for 2R = 1 / (1 + 2) = 33.3%
  assert.equal(plan.breakevenWinRatePct, 33.3);

  // Scenarios
  assert.equal(plan.scenarios.length, 3);
  const base = plan.scenarios.find((s) => s.name === "BASE");
  assert.equal(base?.rMultiple, 2.0);
  assert.ok(base && base.expectedValue > 0);
});

test("TradePlanWorkspaceManager enforces state machine lifecycle", () => {
  const manager = new TradePlanWorkspaceManager();

  const plan = manager.createPlan({
    symbol: "ETHUSDT",
    direction: "short",
    entryPrice: 3000,
    stopPrice: 3100,
    quantity: 5,
  });

  assert.equal(plan.status, "DRAFT");

  // Legal transitions
  manager.transitionStatus(plan.id, "EVALUATED");
  assert.equal(manager.getPlan(plan.id)?.status, "EVALUATED");

  manager.transitionStatus(plan.id, "STAGED");
  assert.equal(manager.getPlan(plan.id)?.status, "STAGED");

  manager.transitionStatus(plan.id, "ACTIVE");
  assert.equal(manager.getPlan(plan.id)?.status, "ACTIVE");

  manager.transitionStatus(plan.id, "COMPLETED");
  assert.equal(manager.getPlan(plan.id)?.status, "COMPLETED");

  // Illegal transition from terminal state COMPLETED -> DRAFT
  assert.throws(() => {
    manager.transitionStatus(plan.id, "DRAFT");
  }, /Illegal state transition/);
});
