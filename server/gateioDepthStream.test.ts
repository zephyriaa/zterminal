import { EventEmitter } from "node:events";
import type WebSocket from "ws";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GateioDepthStreamManager } from "./gateioDepthStream";

class FakeSocket extends EventEmitter {
  readyState = 0;
  sent: string[] = [];
  closed = false;

  send(payload: string) { this.sent.push(payload); }
  close() {
    if (this.closed) return;
    this.closed = true;
    this.readyState = 3;
    this.emit("close");
  }
}

function asWebSocket(socket: FakeSocket) { return socket as unknown as WebSocket; }
async function settle() { await Promise.resolve(); await Promise.resolve(); }

afterEach(() => vi.useRealTimers());

describe("GateioDepthStreamManager", () => {
  it("reconciles a REST snapshot with buffered sequenced public deltas before exposing a live book", async () => {
    const socket = new FakeSocket();
    const fetcher = vi.fn().mockResolvedValue({
      provider: "gateio", symbol: "BTC_USDT", id: 100, timestamp: 1_000,
      bids: [{ price: 99, size: 4 }], asks: [{ price: 101, size: 3 }],
    });
    const manager = new GateioDepthStreamManager(() => asWebSocket(socket), fetcher);

    expect(manager.getSnapshot("BTC_USDT", 1_000)).toMatchObject({ state: "CONNECTING", bids: [], asks: [] });
    socket.readyState = 1;
    socket.emit("open");
    expect(socket.sent.some(payload => payload.includes("futures.order_book_update"))).toBe(true);
    socket.emit("message", JSON.stringify({
      channel: "futures.order_book_update", event: "update",
      result: { s: "BTC_USDT", U: 99, u: 101, t: 1_100, b: [{ p: "99", s: "0" }, { p: "98", s: "6" }], a: [{ p: "101", s: "5" }] },
    }));
    await settle();

    expect(manager.getSnapshot("BTC_USDT", 1_200)).toMatchObject({
      state: "LIVE", dataStatus: "LIVE", lastUpdateId: 101,
      bids: [{ price: 98, size: 6 }], asks: [{ price: 101, size: 5 }],
    });
    manager.clear();
  });

  it("does not expose a local book when the public update sequence has a gap", async () => {
    const socket = new FakeSocket();
    const manager = new GateioDepthStreamManager(
      () => asWebSocket(socket),
      async () => ({ provider: "gateio", symbol: "BTC_USDT", id: 100, timestamp: 1_000, bids: [], asks: [] }),
    );
    manager.getSnapshot("BTC_USDT", 1_000);
    socket.readyState = 1;
    socket.emit("open");
    socket.emit("message", JSON.stringify({
      channel: "futures.order_book_update", event: "update",
      result: { s: "BTC_USDT", U: 103, u: 104, t: 1_100, b: [], a: [] },
    }));
    await settle();

    expect(manager.getSnapshot("BTC_USDT", 1_200)).toMatchObject({
      state: "DEGRADED", dataStatus: "DEGRADED", bids: [], asks: [],
      reason: expect.stringContaining("Awaiting a public depth update"),
    });
    manager.clear();
  });

  it("marks a live reconciled book stale without fabricating a refresh", async () => {
    const socket = new FakeSocket();
    const manager = new GateioDepthStreamManager(
      () => asWebSocket(socket),
      async () => ({ provider: "gateio", symbol: "BTC_USDT", id: 100, timestamp: 1_000, bids: [], asks: [] }),
    );
    manager.getSnapshot("BTC_USDT", 1_000);
    socket.readyState = 1;
    socket.emit("open");
    socket.emit("message", JSON.stringify({
      channel: "futures.order_book_update", event: "update",
      result: { s: "BTC_USDT", U: 100, u: 101, t: 1_000, b: [], a: [] },
    }));
    await settle();

    expect(manager.getSnapshot("BTC_USDT", 31_001)).toMatchObject({
      state: "STALE", dataStatus: "STALE", reason: expect.stringContaining("No reconciled public depth update"),
    });
    manager.clear();
  });

  it("rejects unsupported symbols without opening a public depth connection", () => {
    const factory = vi.fn();
    const manager = new GateioDepthStreamManager(factory);
    expect(manager.getSnapshot("NOT_A_SYMBOL", 1_000)).toMatchObject({ state: "UNAVAILABLE", bids: [], asks: [] });
    expect(factory).not.toHaveBeenCalled();
  });
});
