import test from "node:test";
import assert from "node:assert/strict";
import {
  ContextAlertManager,
  type ContextRichAlertRule,
  type MarketConfluenceSnapshot,
} from "../src/domain/alerts/context-evaluator";

test("ContextAlertManager triggers only when all confluence conditions are met", () => {
  const manager = new ContextAlertManager();

  const rule: ContextRichAlertRule = {
    id: "RULE_BTC_BREAKOUT",
    symbol: "BTCUSDT",
    name: "High Volume VWAP Reclaim",
    severity: "CRITICAL",
    cooldownMs: 60_000,
    vwapCross: { direction: "ABOVE" },
    minRvol: 1.5,
    deltaFilter: "POSITIVE",
  };

  manager.registerRule(rule);

  // Case 1: Crosses VWAP, but RVOL is low (1.1x) -> Should NOT trigger
  let alerts = manager.evaluate({
    symbol: "BTCUSDT",
    price: 65100,
    previousPrice: 64900,
    vwap: 65000,
    rvol: 1.1,
    delta: 500,
    timestamp: 1_000_000,
  });
  assert.equal(alerts.length, 0);

  // Case 2: Crosses VWAP, RVOL high (2.0x), but Delta is negative (-200) -> Should NOT trigger
  alerts = manager.evaluate({
    symbol: "BTCUSDT",
    price: 65100,
    previousPrice: 64900,
    vwap: 65000,
    rvol: 2.0,
    delta: -200,
    timestamp: 1_000_000,
  });
  assert.equal(alerts.length, 0);

  // Case 3: All confluence met: VWAP crossed, RVOL 2.2x, Delta +750 -> Triggers!
  alerts = manager.evaluate({
    symbol: "BTCUSDT",
    price: 65100,
    previousPrice: 64900,
    vwap: 65000,
    rvol: 2.2,
    delta: 750,
    session: "NEW_YORK",
    timestamp: 1_000_000,
  });
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].severity, "CRITICAL");
  assert.equal(alerts[0].soundCue, "ALARM");
  assert.match(alerts[0].headline, /High Volume VWAP Reclaim/);
  assert.match(alerts[0].contextSummary, /RVOL: 2\.2x/);
  assert.match(alerts[0].contextSummary, /Delta: \+750/);
  assert.match(alerts[0].contextSummary, /Session: NEW_YORK/);
});

test("ContextAlertManager enforces cooldown periods and allows re-trigger after expiry", () => {
  const manager = new ContextAlertManager();

  const rule: ContextRichAlertRule = {
    id: "RULE_ETH_LEVEL",
    symbol: "ETHUSDT",
    name: "Key Resistance Break",
    severity: "WARNING",
    cooldownMs: 30_000,
    priceLevel: { level: 3500, direction: "ABOVE" },
  };

  manager.registerRule(rule);

  const baseSnapshot: MarketConfluenceSnapshot = {
    symbol: "ETHUSDT",
    price: 3505,
    previousPrice: 3495,
    timestamp: 100_000,
  };

  // First trigger
  let alerts = manager.evaluate(baseSnapshot);
  assert.equal(alerts.length, 1);

  // Immediate second evaluation at t + 10s (within 30s cooldown) -> Suppressed!
  alerts = manager.evaluate({ ...baseSnapshot, timestamp: 110_000 });
  assert.equal(alerts.length, 0);

  // Third evaluation at t + 35s (past 30s cooldown) -> Triggers again!
  alerts = manager.evaluate({ ...baseSnapshot, timestamp: 135_000 });
  assert.equal(alerts.length, 1);
});
