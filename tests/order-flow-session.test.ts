import assert from "node:assert/strict";
import test from "node:test";
import { acquireOrderFlowSession } from "../src/lib/market/order-flow-session";
import { DEFAULT_ORDER_FLOW_SETTINGS } from "../src/lib/market/order-flow-context";
import type { TradeEvent } from "../src/lib/market/types";

const trade: TradeEvent = { type: "trade", provider: "binance", exchange: "BINANCE", environment: "live", symbol: "BTCUSDT", timestamp: 1000, sequence: 1, price: 100, quantity: 2, side: "buy", quantityUnit: "base" };
const settings = { ...DEFAULT_ORDER_FLOW_SETTINGS, layers: ["cvd", "trade-profile"] as ("cvd" | "trade-profile")[] };

test("consumers share one observed window and calculation snapshot while configurations stay isolated", () => {
  const first = acquireOrderFlowSession("binance", "BTCUSDT", "live"), second = acquireOrderFlowSession("binance", "BTCUSDT", "live");
  assert.equal(first.session, second.session);
  first.session.pushTrade(trade);
  second.session.pushTrade(trade); // a second subscriber must not duplicate ingestion
  first.session.pushTrade({ ...trade, sequence: 2, timestamp: 1500, quantity: 1, side: "sell" });
  const a = first.session.context(settings, 1, true, false, 2000);
  assert.equal(a, second.session.context(settings, 1, true, false, 2000));
  assert.equal(a.cvd.at(-1)?.value, 1);
  assert.equal(a.tradeCount, 2);
  assert.ok(Object.isFrozen(a)); assert.ok(Object.isFrozen(a.cvd)); assert.ok(Object.isFrozen(a.cvd[0]));
  const different = second.session.context({ ...settings, windowSeconds: 1 }, 1, true, false, 2500);
  assert.equal(different.cvd.at(-1)?.value, -1);
  assert.equal(a.cvd.at(-1)?.value, 1);
  first.release();
  assert.equal(second.session.trades.length, 2);
  second.release(); second.release();
  const replacement = acquireOrderFlowSession("binance", "BTCUSDT", "live");
  assert.notEqual(replacement.session, first.session); assert.equal(replacement.session.trades.length, 0); replacement.release();
});

test("depth-only loss preserves trade aggregates; generation reset and last release discard all observations", () => {
  const owner = acquireOrderFlowSession("binance", "BTCUSDT", "live");
  owner.session.pushTrade(trade);
  const prefix = owner.session.getSnapshot();
  owner.session.pushTrade({ ...trade, sequence: 2, quantity: 7 });
  assert.equal(owner.session.context(settings, 1, true, false, 2000, prefix).cvd.at(-1)?.value, 2, "a render revision cannot consume later trades");
  owner.session.pushDepth({ type: "depth", provider: "binance", environment: "live", exchange: "BINANCE", symbol: "BTCUSDT", timestamp: 1100, sequence: 10, levels: [{ side: "buy", price: 99, size: 3 }, { side: "sell", price: 101, size: 1 }] });
  owner.session.clearDepth();
  assert.equal(owner.session.context(settings, 1, true, false, 2000).cvd.at(-1)?.value, 9);
  assert.equal(owner.session.frames.length, 0);
  assert.throws(() => owner.session.pushTrade({ ...trade, symbol: "ETHUSDT", sequence: 2 }), /identity/i);
  owner.session.reset(); assert.equal(owner.session.trades.length, 0); assert.equal(owner.session.frames.length, 0);
  owner.release();
});

test("out-of-order health responses cannot clear a newer recovered book or trade window", () => {
  const owner = acquireOrderFlowSession("binance", "BTCUSDT", "live", "health-race");
  const now = Date.now();
  owner.session.updateHealth({ provider: "binance", symbol: "BTCUSDT", state: "LIVE", updatedAt: now, streams: { trades: { state: "LIVE", lastMessageAt: now }, depth: { state: "LIVE", lastMessageAt: now } } });
  owner.session.pushTrade(trade);
  owner.session.updateHealth({ provider: "binance", symbol: "BTCUSDT", state: "GAP_DETECTED", updatedAt: now - 1 });
  assert.equal(owner.session.health?.state, "LIVE"); assert.equal(owner.session.trades.length, 1);
  assert.equal(owner.session.getSnapshot().health, owner.session.health);
  const otherWorkspace = acquireOrderFlowSession("binance", "BTCUSDT", "live", "other-workspace");
  assert.equal(otherWorkspace.session.trades.length, 0); otherWorkspace.release(); owner.release();
});

test("retention is bounded and snapshots cannot mutate the shared observations", () => {
  const owner = acquireOrderFlowSession("binance", "BTCUSDT", "live");
  for (let i = 1; i <= 2100; i++) owner.session.pushTrade({ ...trade, sequence: i, timestamp: i });
  assert.equal(owner.session.trades.length, 2000);
  assert.equal(owner.session.trades[0].sequence, 101);
  assert.ok(Object.isFrozen(owner.session.trades)); assert.ok(Object.isFrozen(owner.session.trades[0]));
  owner.release();
});

test("one hundred acquire/release cycles cancel publication and cannot revive disposed state", async () => {
  let notifications = 0;
  for (let i = 0; i < 100; i++) {
    const owner = acquireOrderFlowSession("binance", "BTCUSDT", "live", "cleanup");
    assert.equal(owner.session.trades.length, 0);
    owner.session.subscribe(() => { notifications++; });
    owner.session.pushTrade(trade);
    owner.release();
  }
  await new Promise(resolve => setTimeout(resolve, 80));
  assert.equal(notifications, 0);
});
