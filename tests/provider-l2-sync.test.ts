import assert from "node:assert/strict";
import test from "node:test";
import { PublicMarketDataProvider } from "../src/lib/market/public-stream";

function harness(provider: "bybit" | "coinbase", symbol: string) {
  const instance: any = new PublicMarketDataProvider(provider);
  const events: any[] = [];
  instance.listeners.set(symbol, new Set([(event: any) => events.push(event)]));
  return { instance, events };
}

test("Bybit L2 snapshot, delta, duplicate and gap handling", () => {
  const { instance, events } = harness("bybit", "BTCUSDT");
  instance.handleBybitMessage({ topic: "orderbook.50.BTCUSDT", type: "snapshot", data: { s: "BTCUSDT", u: 10, b: [["100", "2"]], a: [["101", "3"]] } });
  instance.handleBybitMessage({ topic: "orderbook.50.BTCUSDT", type: "delta", data: { s: "BTCUSDT", u: 11, b: [["100", "1"]], a: [] } });
  instance.handleBybitMessage({ topic: "orderbook.50.BTCUSDT", type: "delta", data: { s: "BTCUSDT", u: 11, b: [["100", "9"]], a: [] } });
  assert.equal(events.at(-1).levels.find((l: any) => l.price === 100).size, 1);
  instance.handleBybitMessage({ topic: "orderbook.50.BTCUSDT", type: "delta", data: { s: "BTCUSDT", u: 13, b: [], a: [] } });
  assert.equal(events.length, 2);
  assert.equal(instance.bybitBooks.get("BTCUSDT").valid, false);
});

test("Coinbase level2 snapshot, delta, duplicate and gap handling", () => {
  const { instance, events } = harness("coinbase", "BTC-USD");
  instance.handleCoinbaseMessage({ channel: "l2_data", sequence_num: 0, events: [{ type: "snapshot", product_id: "BTC-USD", updates: [{ side: "bid", price_level: "100", new_quantity: "2" }, { side: "offer", price_level: "101", new_quantity: "3" }] }] });
  instance.handleCoinbaseMessage({ channel: "l2_data", sequence_num: 1, events: [{ type: "update", product_id: "BTC-USD", updates: [{ side: "bid", price_level: "100", new_quantity: "1" }] }] });
  instance.handleCoinbaseMessage({ channel: "l2_data", sequence_num: 1, events: [{ type: "update", product_id: "BTC-USD", updates: [{ side: "bid", price_level: "100", new_quantity: "9" }] }] });
  assert.equal(events.at(-1).levels.find((l: any) => l.price === 100).size, 1);
  instance.handleCoinbaseMessage({ channel: "l2_data", sequence_num: 3, events: [{ type: "update", product_id: "BTC-USD", updates: [] }] });
  assert.equal(events.length, 2);
  assert.equal(instance.coinbaseBooks.get("BTC-USD").valid, false);
});
