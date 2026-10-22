import assert from "node:assert/strict";
import test from "node:test";
import { BinanceDepthSynchronizer } from "../src/lib/market/public-stream/binance-depth";
import { PublicMarketDataProvider } from "../src/lib/market/public-stream";

test("opening a public socket is not evidence of live instrument data", () => {
  const previous = globalThis.WebSocket, fetchBefore = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ id: 10, current: 1, update: 1, bids: [], asks: [] }));
  class Socket {
    static OPEN = 1; static CONNECTING = 0;
    readyState = 0;
    onopen?: () => void;
    onclose?: () => void;
    send() {}
    close() { this.readyState = 3; }
  }
  globalThis.WebSocket = Socket as unknown as typeof WebSocket;
  const provider = new PublicMarketDataProvider("gateio");
  const states: string[] = [];
  const stop = provider.onState(state => states.push(state.dataStatus));
  const remove = provider.subscribe("BTCUSDT", () => {});
  try {
    const socket = (provider as unknown as { socket: Socket }).socket;
    socket.readyState = 1; socket.onopen?.();
    assert.ok(!states.includes("LIVE"));
  } finally { remove(); stop(); globalThis.WebSocket = previous; globalThis.fetch = fetchBefore; }
});

test("Gate depth gaps invalidate the book instead of publishing disconnected levels", () => {
  const provider = new PublicMarketDataProvider("gateio");
  const target = provider as unknown as { listeners: Map<string, Set<(event: any) => void>>; handleGateioDepth(raw: unknown): void };
  const events: any[] = [];
  target.listeners.set("BTC_USDT", new Set([event => events.push(event)]));
  target.handleGateioDepth({ s: "BTC_USDT", full: true, u: 10, t: Date.now(), b: [{ p: "100", s: "2" }], a: [{ p: "101", s: "3" }] });
  target.handleGateioDepth({ s: "BTC_USDT", U: 13, u: 14, t: Date.now(), b: [{ p: "100", s: "9" }], a: [] });
  assert.equal(events.filter(event => event.type === "depth").length, 1);
  const health = events.filter(event => event.streams).at(-1);
  assert.equal(health?.streams.depth.state, "GAP_DETECTED");
  assert.equal(health?.depthReady, false);
});

test("malformed Binance depth frames immediately revoke a previously ready book", () => {
  const provider = new PublicMarketDataProvider("binance");
  const target = provider as any;
  const events: any[] = [];
  target.listeners.set("BTCUSDT", new Set([(event: any) => events.push(event)]));
  const sync = new BinanceDepthSynchronizer();
  sync.push({ U: 10, u: 10, b: [], a: [] });
  sync.bridge({ lastUpdateId: 10, bids: [["100", "2"]], asks: [["101", "3"]] });
  target.binanceSyncs.set("BTCUSDT", sync);
  target.emitBinanceDepth("BTCUSDT", sync);
  try {
    target.handleMessage({ e: "depthUpdate", s: "BTCUSDT", U: "invalid", u: 11, pu: 10, b: [], a: [] });
    assert.equal(events.filter(event => event.type === "depth").length, 1);
    assert.equal(provider.health("BTCUSDT").depthReady, false);
    assert.equal(provider.health("BTCUSDT").streams?.depth.state, "GAP_DETECTED");
  } finally { provider.disconnect(); }
});

test("disconnect revokes in-flight Binance snapshots so reconnect can request a fresh book", async () => {
  const before = globalThis.fetch;
  let finish!: (response: Response) => void;
  globalThis.fetch = () => new Promise<Response>(resolve => { finish = resolve; });
  const provider = new PublicMarketDataProvider("binance"), target = provider as any;
  target.listeners.set("BTCUSDT", new Set([() => {}]));
  (PublicMarketDataProvider as any).binanceGlobalNextAllowedAt = 0;
  const request = target.fetchBinanceSnapshot("BTCUSDT");
  try {
    assert.equal(target.fetchingSnapshots.size, 1);
    provider.disconnect();
    assert.equal(target.fetchingSnapshots.size, 0);
  } finally {
    finish(Response.json({ lastUpdateId: 10, bids: [["100", "2"]], asks: [["101", "3"]] }));
    await request;
    assert.equal(target.binanceSyncs.size, 0);
    assert.equal(provider.health("BTCUSDT").depthReady, false);
    globalThis.fetch = before;
  }
});
