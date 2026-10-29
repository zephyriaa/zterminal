import assert from "node:assert/strict";
import test from "node:test";
import { PublicMarketDataProvider, type StreamEvent, type StreamState } from "../src/lib/market/public-stream";
import { OrderFlowSession } from "../src/lib/market/order-flow-session";
import { DEFAULT_ORDER_FLOW_SETTINGS } from "../src/lib/market/order-flow-context";
import type { FeedHealth, TradeEvent } from "../src/lib/market/types";

const trade: TradeEvent = { type: "trade", provider: "gateio", exchange: "GATEIO", environment: "live", symbol: "BTC_USDT", timestamp: 0, sequence: 1, price: 100, quantity: 2, side: "buy", quantityUnit: "contracts" };

test("small device clock drift feeds observed trade and book indicators; large future offsets remain rejected", () => {
  const provider = new PublicMarketDataProvider("gateio");
  const session = new OrderFlowSession("gateio", "BTC_USDT", "live");
  const states: StreamState[] = [];
  provider.onState(state => states.push(state));
  const internal = provider as unknown as { listeners: Map<string, Set<(event: StreamEvent | FeedHealth) => void>>; emit(symbol: string, event: StreamEvent): void };
  internal.listeners.set("BTC_USDT", new Set([event => {
    if (!("type" in event)) session.updateHealth(event);
    else if (event.type === "trade") session.pushTrade(event);
    else if (event.type === "depth") session.pushDepth(event);
  }]));
  const now = Date.now();
  internal.emit("BTC_USDT", { ...trade, timestamp: now + 1500 });
  internal.emit("BTC_USDT", { type: "depth", provider: "gateio", exchange: "GATEIO", environment: "live", symbol: "BTC_USDT", timestamp: now + 1500, sequence: 10, levels: [{ side: "buy", price: 99, size: 3 }, { side: "sell", price: 101, size: 1 }] });
  const model = session.context({ ...DEFAULT_ORDER_FLOW_SETTINGS, layers: ["cvd", "footprint", "microprice", "imbalance"] }, 1, true, true, session.now);
  assert.equal(model.tradeCount, 1);
  assert.equal(model.cvd[0].value, 2);
  assert.equal(model.footprint.length, 1);
  assert.equal(model.microprice?.value, 100.5);
  assert.equal(model.imbalance?.value, 0.5);
  assert.equal(session.trades[0].timestamp, now + 1500, "preserve exchange timestamps");
  session.updateHealth(provider.health("BTC_USDT"));
  assert.ok(session.now >= now + 1500, "health polling must not rewind the source window");
  internal.emit("BTC_USDT", { ...trade, sequence: 2, timestamp: now + 60000 });
  assert.equal(session.trades.length, 1);
  assert.match(states.at(-1)?.reason ?? "", /ahead.*Synchronize Windows/);
  assert.equal(states.at(-1)?.dataStatus, "UNAVAILABLE");
  session.dispose();
});

test("manual reconnect resets an open socket while background reconnect preserves it", () => {
  const provider = new PublicMarketDataProvider("gateio");
  const internal = provider as unknown as { socket: { readyState: number }; cleanupSocket(): void; connect(): void };
  const original = globalThis.WebSocket;
  globalThis.WebSocket = { OPEN: 1 } as typeof WebSocket;
  let cleanups = 0, connections = 0;
  internal.socket = { readyState: 1 };
  internal.cleanupSocket = () => { cleanups++; };
  internal.connect = () => { connections++; };
  try {
    provider.reconnect();
    assert.equal(cleanups, 0);
    provider.reconnect(true);
    assert.equal(cleanups, 1);
    assert.equal(connections, 1);
  } finally { globalThis.WebSocket = original; }
});
