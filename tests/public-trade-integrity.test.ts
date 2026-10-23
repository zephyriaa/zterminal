import assert from "node:assert/strict";
import test from "node:test";
import { PublicMarketDataProvider, type StreamListener } from "../src/lib/market/public-stream";
import { BinanceDepthSynchronizer } from "../src/lib/market/public-stream/binance-depth";
import type { TradeEvent } from "../src/lib/market/types";

test("direct Binance trades require exchange-declared aggressor direction", () => {
  const provider = new PublicMarketDataProvider("binance");
  const internal = provider as unknown as { listeners: Map<string, Set<StreamListener>>; handleMessage(value: unknown): void };
  const trades: TradeEvent[] = [];
  internal.listeners.set("BTCUSDT", new Set([event => { if ("type" in event && event.type === "trade") trades.push(event); }]));
  const message = { e: "aggTrade", s: "BTCUSDT", a: 1, T: Date.now(), p: "80000", q: "2" };
  for (const m of [undefined, null, "false", 0]) internal.handleMessage({ ...message, m });
  assert.equal(trades.length, 0, "missing or malformed maker flags cannot fabricate buy volume");
  internal.handleMessage({ ...message, m: true });
  internal.handleMessage({ ...message, a: 2, m: false });
  assert.deepEqual(trades.map(trade => trade.side), ["sell", "buy"]);
  assert.deepEqual(trades.map(trade => trade.quantityUnit), ["base", "base"]);
});

test("Binance depth rejects negative or imprecise sequence identities before becoming LIVE", () => {
  for (const patch of [{ U: -1, u: 11 }, { U: 10, u: Number.MAX_SAFE_INTEGER + 1 }, { pu: -1 }, { pu: Number.MAX_SAFE_INTEGER + 1 }]) {
    const sync = new BinanceDepthSynchronizer();
    sync.push({ U: 10, u: 11, pu: 9, b: [["99", "2"]], a: [["101", "1"]], ...patch });
    assert.equal(sync.status, "ERROR");
    assert.equal(sync.bridge({ lastUpdateId: 10, bids: [["99", "2"]], asks: [["101", "1"]] }), false);
    assert.deepEqual(sync.book.top("buy"), []);
  }
});

test("future-dated prints disclose the clock problem without changing the source time", () => {
  const provider = new PublicMarketDataProvider("binance");
  const states: string[] = [];
  provider.onState(state => { if (state.reason) states.push(state.reason); });
  const internal = provider as unknown as { handleMessage(value: unknown): void };
  internal.handleMessage({ e: "aggTrade", s: "BTCUSDT", a: 1, T: Date.now() + 10000, p: "80000", q: "2", m: false });
  assert.match(states.at(-1)!, /device clock/);
});
