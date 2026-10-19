import assert from "node:assert/strict";
import test from "node:test";
import { BigTradesPrimitive } from "../src/lib/chart/overlays/big-trades-primitive";
import { aggregateBigTrades } from "../src/lib/chart/overlays/big-trades";
import { DEFAULT_BIG_TRADES_SETTINGS } from "../src/lib/chart/overlays/contracts";

test("sub-candle executions project to their candle while preserving actual event time", () => {
  const settings = { ...DEFAULT_BIG_TRADES_SETTINGS, minimumNotional: 0 };
  const snapshot = aggregateBigTrades([{ type: "trade", provider: "binance", exchange: "BINANCE", environment: "live", symbol: "BTCUSDT", timestamp: 650500, sequence: 1, price: 100, quantity: 2, side: "buy", quantityUnit: "base" }], 1, settings);
  const primitive = new BigTradesPrimitive();
  primitive.attached({ chart: { timeScale: () => ({ timeToCoordinate: (time: number) => time === 600 ? 20 : null }) }, series: { priceToCoordinate: () => 30 }, requestUpdate() {} } as unknown as Parameters<BigTradesPrimitive["attached"]>[0]);
  primitive.setClusters(snapshot.clusters, settings, "5m");
  assert.equal(primitive.hitTest(20, 30)?.externalId, snapshot.clusters[0].id);
  assert.equal(snapshot.clusters[0].firstTimestamp, 650500);
  primitive.setClusters([], null, "5m");
  assert.equal(primitive.hitTest(20, 30), null);
});
