import { EventEmitter } from "node:events";
import type WebSocket from "ws";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GateioTradeStreamManager } from "./gateioTradeStream";

class FakeSocket extends EventEmitter {
  readyState = 0;
  sent: string[] = [];
  closed = false;

  send(payload: string) {
    this.sent.push(payload);
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    this.readyState = 3;
    this.emit("close");
  }
}

function asWebSocket(socket: FakeSocket) {
  return socket as unknown as WebSocket;
}

afterEach(() => {
  vi.useRealTimers();
});

describe("GateioTradeStreamManager", () => {
  it("subscribes with decimal-preserving configuration and exposes normalized live public trades", () => {
    const socket = new FakeSocket();
    const manager = new GateioTradeStreamManager((address, options) => {
      expect(address).toBe("wss://fx-ws.gateio.ws/v4/ws/usdt");
      expect(options.headers).toMatchObject({ "X-Gate-Size-Decimal": "1" });
      return asWebSocket(socket);
    });

    expect(manager.getSnapshot("BTC_USDT", 1_000)).toMatchObject({ state: "CONNECTING", dataStatus: "DEGRADED" });
    socket.readyState = 1;
    socket.emit("open");
    expect(socket.sent.some(payload => payload.includes("futures.trades"))).toBe(true);
    socket.emit("message", JSON.stringify({
      channel: "futures.trades",
      event: "update",
      result: [
        { id: 2, contract: "BTC_USDT", price: "100", size: "-2", create_time_ms: 2_000 },
        { id: 1, contract: "BTC_USDT", price: "99", size: "3", create_time_ms: 1_000 },
      ],
    }));

    expect(manager.getSnapshot("BTC_USDT", 2_500)).toMatchObject({
      state: "LIVE",
      dataStatus: "LIVE",
      trades: [
        { id: "1", signedSize: 3 },
        { id: "2", signedSize: -2 },
      ],
    });
    manager.clear();
  });

  it("marks a once-live stream stale when no current public trade arrives within the bounded window", () => {
    const socket = new FakeSocket();
    const manager = new GateioTradeStreamManager(() => asWebSocket(socket));
    manager.getSnapshot("BTC_USDT", 1_000);
    socket.readyState = 1;
    socket.emit("open");
    socket.emit("message", JSON.stringify({
      channel: "futures.trades",
      event: "update",
      result: [{ id: 1, contract: "BTC_USDT", price: "99", size: "3", create_time_ms: 1_000 }],
    }));

    expect(manager.getSnapshot("BTC_USDT", 31_001)).toMatchObject({
      state: "STALE",
      dataStatus: "STALE",
      reason: expect.stringContaining("No recent public trade event"),
    });
    manager.clear();
  });

  it("uses bounded exponential reconnect attempts after an active public stream closes", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(1_000));
    const first = new FakeSocket();
    const second = new FakeSocket();
    const factory = vi.fn()
      .mockReturnValueOnce(asWebSocket(first))
      .mockReturnValueOnce(asWebSocket(second));
    const manager = new GateioTradeStreamManager(factory);

    manager.getSnapshot("BTC_USDT", Date.now());
    first.readyState = 1;
    first.emit("open");
    first.emit("close");
    expect(manager.getSnapshot("BTC_USDT", Date.now())).toMatchObject({ state: "DEGRADED" });

    vi.advanceTimersByTime(1_000);
    expect(factory).toHaveBeenCalledTimes(2);
    manager.clear();
  });

  it("closes an idle stream after the bounded chart-consumer window", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(1_000));
    const first = new FakeSocket();
    const second = new FakeSocket();
    const factory = vi.fn()
      .mockReturnValueOnce(asWebSocket(first))
      .mockReturnValueOnce(asWebSocket(second));
    const manager = new GateioTradeStreamManager(factory);

    manager.getSnapshot("BTC_USDT", Date.now());
    first.readyState = 1;
    first.emit("open");
    vi.advanceTimersByTime(90_025);
    expect(first.closed).toBe(true);

    manager.getSnapshot("BTC_USDT", Date.now());
    expect(factory).toHaveBeenCalledTimes(2);
    manager.clear();
  });

  it("rejects unsupported symbols without starting a public stream", () => {
    const factory = vi.fn();
    const manager = new GateioTradeStreamManager(factory);
    expect(manager.getSnapshot("NOT_A_SYMBOL", 1_000)).toMatchObject({
      state: "UNAVAILABLE",
      dataStatus: "UNAVAILABLE",
      trades: [],
    });
    expect(factory).not.toHaveBeenCalled();
  });
});
