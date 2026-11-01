import test from "node:test";
import assert from "node:assert/strict";
import { BybitFuturesProvider } from "../mini-services/market-data/bybit-provider";
import { OrderFlowSession } from "../src/lib/market/order-flow-session";
import { buildFootprint, calculateCVD } from "../src/lib/market/order-flow";

test("replaying the same synthetic Bybit events yields identical books, trades, footprint and delta", () => {
  const timestamp = Date.now() - 1000;
  const run = () => {
    const provider = new BybitFuturesProvider();
    const session = new OrderFlowSession("bybit", "BTCUSDT", "live");
    const ingest = provider as unknown as { receiveTrades(symbol: string, data: unknown): void; receiveBook(symbol: string, message: unknown): void };
    provider.on(event => {
      if (event.type === "trade") session.pushTrade(event.data);
      if (event.type === "depth") session.pushDepth(event.data);
    });
    try {
      const snapshot = { topic: "orderbook.50.BTCUSDT", type: "snapshot", ts: timestamp, data: { s: "BTCUSDT", u: 20, seq: 100, b: [["99", "2"]], a: [["101", "3"]] } };
      const delta = { ...snapshot, type: "delta", ts: timestamp + 1, data: { ...snapshot.data, u: 25, seq: 110, b: [["99", "0"], ["100", "4"]], a: [] } };
      ingest.receiveBook("BTCUSDT", snapshot);
      ingest.receiveBook("BTCUSDT", delta);
      ingest.receiveBook("BTCUSDT", delta); // exact duplicate produces no new frame
      ingest.receiveBook("BTCUSDT", { ...delta, data: { ...delta.data, u: 24, seq: 109 } }); // older delta
      const trades = ["one", "two"].map((i, index) => ({ s: "BTCUSDT", i, seq: 120, T: timestamp + index, S: index ? "Sell" : "Buy", p: "100", v: "1" }));
      ingest.receiveTrades("BTCUSDT", trades);
      ingest.receiveTrades("BTCUSDT", trades);
      assert.equal(session.frames.length, 2);
      assert.equal(session.trades.length, 2);
      assert.deepEqual(session.depth?.levels, [{ price: 100, size: 4, side: "buy" }, { price: 101, size: 3, side: "sell" }]);
      return { depth: session.depth, trades: session.trades, footprint: buildFootprint([...session.trades], 0.1, 1000), cvd: calculateCVD([...session.trades], 1000) };
    } finally { provider.close(); session.dispose(); }
  };
  assert.deepEqual(run(), run());
});
