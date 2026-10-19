import assert from "node:assert/strict";
import test from "node:test";
import { BinanceFuturesProvider } from "../mini-services/market-data/binance-provider";
import { GateioFuturesProvider } from "../mini-services/market-data/gateio-provider";
import { freshFeedHealth } from "../src/lib/market/provenance";
import type { FeedHealth } from "../src/lib/market/types";
import { GateOrderBook } from "../mini-services/market-data/order-book";

test("healthy public trades remain independently ready while either venue book synchronizes", () => {
  for (const provider of [new BinanceFuturesProvider(), new GateioFuturesProvider()]) {
    const symbol = provider.id === "binance" ? "BTCUSDT" : "BTC_USDT";
    const internal = provider as unknown as { ws: { readyState: number } | null; symbols: Set<string>; handleMessage(message: unknown): void };
    internal.ws = { readyState: 1 }; internal.symbols.add(symbol);
    const now = Date.now();
    internal.handleMessage(provider.id === "binance"
      ? { e: "trade", s: symbol, t: 1, T: now, p: "60000", q: "2", m: false }
      : { channel: "futures.trades", event: "update", result: [{ id: 1, contract: symbol, create_time_ms: now, price: "60000", size: "2" }] });
    const health = provider.health(symbol);
    assert.equal(health.streams?.trades.state, "LIVE", provider.id);
    assert.notEqual(health.streams?.depth.state, "LIVE", provider.id);
    assert.notEqual(health.state, "LIVE", "summary must not certify the book");
    const expired = freshFeedHealth(health, now + 20000);
    assert.equal(expired?.streams?.trades.state, "STALE");
    internal.ws = null; provider.close();
  }
});

test("a fresh summary cannot revive independently stale or gapped inputs", () => {
  const now = Date.now();
  const health = { provider: "binance", symbol: "BTCUSDT", state: "LIVE", updatedAt: now, lastMessageAt: now, depthReady: true, lastDepthAt: now,
    streams: { trades: { state: "LIVE", lastMessageAt: now - 20000 }, depth: { state: "GAP_DETECTED", lastMessageAt: now } } } as FeedHealth;
  const fresh = freshFeedHealth(health, now)!;
  assert.equal(fresh.streams!.trades.state, "STALE");
  assert.equal(fresh.streams!.depth.state, "GAP_DETECTED");
  assert.notEqual(fresh.state, "LIVE");
});

test("Gate malformed, negative or crossed messages atomically clear old levels", () => {
  for (const mutation of ["malformed", "negative", "crossed", "snapshot"] as const) {
    const book = new GateOrderBook();
    book.buffer({ U: 11, u: 11, t: 1, b: [], a: [] });
    book.bootstrap({ id: 10, current: 1, update: 1, bids: [["99", "2"]], asks: [["101", "1"]] });
    assert.throws(() => mutation === "snapshot"
      ? book.bootstrap({ id: 12, current: 1, update: 1, bids: [["99", "2"], ["98", "bad"]], asks: [["101", "1"]] })
      : book.apply({ U: 12, u: 12, t: 2, b: mutation === "crossed" ? [{ p: "102", s: "1" }] : [{ p: "99", s: "3" }, { p: "98", s: mutation === "negative" ? "-2" : "bad" }], a: [] }));
    assert.equal(book.isReady(), false, mutation); assert.deepEqual(book.levels(), []); assert.equal(book.bestQuote(), null);
  }
});

test("Binance missing aggressor metadata cannot become a buy or consume the valid trade ID", () => {
  const provider = new BinanceFuturesProvider();
  const internal = provider as unknown as { symbols: Set<string>; handleMessage(message: unknown): void };
  internal.symbols.add("BTCUSDT");
  let received = 0;
  provider.on(event => { if (event.type === "trade") { received++; assert.equal(event.data.side, "sell"); } });
  const message = { e: "trade", s: "BTCUSDT", t: 1, T: Date.now(), p: "60000", q: "2" };
  assert.throws(() => internal.handleMessage(message), /aggressor/i);
  internal.handleMessage({ ...message, m: true });
  assert.equal(received, 1); provider.close();
});

test("book bootstrap overflow fails closed instead of silently dropping required events", () => {
  const book = new GateOrderBook();
  assert.throws(() => { for (let i = 1; i <= 2001; i++) book.buffer({ U: i, u: i, t: i, b: [], a: [] }); }, /overflow/i);
  assert.equal(book.isReady(), false); assert.deepEqual(book.levels(), []);
});
