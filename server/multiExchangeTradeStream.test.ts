import { EventEmitter } from "node:events";
import type WebSocket from "ws";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MultiExchangeTradeStreamManager } from "./multiExchangeTradeStream";

class FakeSocket extends EventEmitter {
  readyState = 0;
  sent: string[] = [];
  closed = false;
  send(payload: string) { this.sent.push(payload); }
  close() { if (this.closed) return; this.closed = true; this.readyState = 3; this.emit("close"); }
}

function asWebSocket(socket: FakeSocket) { return socket as unknown as WebSocket; }
afterEach(() => vi.useRealTimers());

describe("MultiExchangeTradeStreamManager", () => {
  it("normalizes Binance public aggregate trades with exchange-reported taker semantics", () => {
    const socket = new FakeSocket();
    const manager = new MultiExchangeTradeStreamManager(address => {
      expect(address).toBe("wss://fstream.binance.com/ws/btcusdt@aggTrade");
      return asWebSocket(socket);
    });
    expect(manager.getSnapshot("binance_usdm", "BTC_USDT", 1_000)).toMatchObject({ state: "CONNECTING", dataStatus: "DEGRADED" });
    socket.readyState = 1;
    socket.emit("open");
    socket.emit("message", JSON.stringify({ e: "aggTrade", a: 9, s: "BTCUSDT", p: "60000", q: "0.2", T: 1_000, m: true }));
    expect(manager.getSnapshot("binance_usdm", "BTC_USDT", 1_500)).toMatchObject({ state: "LIVE", dataStatus: "LIVE", trades: [{ provider: "binance_usdm", signedSize: -0.2 }] });
    manager.clear();
  });

  it("subscribes to Bybit public trades and preserves its reported taker side", () => {
    const socket = new FakeSocket();
    const manager = new MultiExchangeTradeStreamManager(address => {
      expect(address).toBe("wss://stream.bybit.com/v5/public/linear");
      return asWebSocket(socket);
    });
    manager.getSnapshot("bybit_linear", "BTC_USDT", 1_000);
    socket.readyState = 1;
    socket.emit("open");
    expect(socket.sent[0]).toContain("publicTrade.BTCUSDT");
    socket.emit("message", JSON.stringify({ topic: "publicTrade.BTCUSDT", data: [{ T: 1_000, s: "BTCUSDT", S: "Buy", v: "0.3", p: "60001", i: "bybit-1" }] }));
    expect(manager.getSnapshot("bybit_linear", "BTC_USDT", 1_500)).toMatchObject({ state: "LIVE", trades: [{ provider: "bybit_linear", signedSize: 0.3 }] });
    manager.clear();
  });

  it("marks a live tape stale and withholds its live status after the configured current-data window", () => {
    const socket = new FakeSocket();
    const manager = new MultiExchangeTradeStreamManager(() => asWebSocket(socket));
    manager.getSnapshot("binance_usdm", "BTC_USDT", 1_000);
    socket.readyState = 1;
    socket.emit("open");
    socket.emit("message", JSON.stringify({ e: "aggTrade", a: 9, s: "BTCUSDT", p: "60000", q: "0.2", T: 1_000, m: false }));
    expect(manager.getSnapshot("binance_usdm", "BTC_USDT", 16_001)).toMatchObject({ state: "STALE", dataStatus: "STALE", reason: expect.stringContaining("withheld") });
    manager.clear();
  });

  it("rejects unsupported symbols without creating a public stream", () => {
    const factory = vi.fn();
    const manager = new MultiExchangeTradeStreamManager(factory);
    expect(manager.getSnapshot("bybit_linear", "BTCUSD", 1_000)).toMatchObject({ state: "UNAVAILABLE", trades: [] });
    expect(factory).not.toHaveBeenCalled();
  });
});
