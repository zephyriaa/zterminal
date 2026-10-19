import assert from "node:assert/strict";
import test from "node:test";
import { buildFootprint, buildTradeTape, calculateCVD, calculateDeltaBuckets, calculateBookImbalance, calculateMicroprice } from "../src/lib/market/order-flow";
import type { TradeEvent } from "../src/lib/market/types";
import { aggregateBigTrades } from "../src/lib/chart/overlays/big-trades";
import { DEFAULT_BIG_TRADES_SETTINGS } from "../src/lib/chart/overlays/contracts";
import { BinanceFuturesProvider } from "../mini-services/market-data/binance-provider";
import { GateioFuturesProvider } from "../mini-services/market-data/gateio-provider";
import { MockLiveMarket } from "../src/lib/market/mock-provider";
const trade: TradeEvent = { type: "trade", provider: "binance", environment: "live", exchange: "BINANCE", symbol: "BTCUSDT", timestamp: 100, sequence: 1, price: 100, quantity: 2, side: "buy" };
test("invalid prints cannot become zero-volume observations or fabricated footprint prices", () => {
  for (const patch of [{ quantity: NaN }, { quantity: 0 }, { price: Infinity }, { price: -1 }, { timestamp: NaN }, { side: "unknown" }]) {
    const input = [{ ...trade, ...patch }] as TradeEvent[];
    for (const calculate of [buildTradeTape, calculateDeltaBuckets, calculateCVD, (trades: TradeEvent[]) => buildFootprint(trades, .5)]) assert.throws(() => calculate(input), /trade/i);
  }
  assert.deepEqual(calculateCVD([]), []); assert.deepEqual(buildFootprint([], .5), []);
});
test("book metrics keep one-sided or crossed input unavailable and reject non-finite levels", () => {
  assert.equal(calculateBookImbalance([{ side: "buy", price: 100, size: 3 }]).value, null);
  const crossed = [{ side: "buy" as const, price: 102, size: 3 }, { side: "sell" as const, price: 101, size: 1 }];
  assert.equal(calculateMicroprice(crossed).value, null); assert.equal(calculateBookImbalance(crossed).value, null);
  const invalid = [{ side: "buy" as const, price: NaN, size: 3 }, { side: "sell" as const, price: 101, size: Infinity }];
  assert.throws(() => calculateMicroprice(invalid)); assert.throws(() => calculateBookImbalance(invalid));
});
test("Gate contract quantities preserve their unit and use the multiplier for quote notional", () => {
  const gate = { ...trade, provider: "gateio", exchange: "GATEIO", symbol: "BTC_USDT", price: 80000, quantity: 25, quantityUnit: "contracts", contractMultiplier: .0001 } as TradeEvent;
  assert.equal(buildTradeTape([gate])[0].quantity, 25);
  assert.equal(buildTradeTape([gate])[0].notional, 200);
  assert.equal(aggregateBigTrades([gate], .1, { ...DEFAULT_BIG_TRADES_SETTINGS, minimumNotional: 1000 }).clusters.length, 0);
  const unknown = { ...gate, contractMultiplier: undefined };
  assert.throws(() => buildTradeTape([unknown]), /notional|unit|multiplier/i);
  assert.equal(aggregateBigTrades([unknown], .1, { ...DEFAULT_BIG_TRADES_SETTINGS, minimumNotional: 0 }).clusters.length, 0);
});
test("provider ingestion excludes zero executions without poisoning the next valid trade", () => {
  const binance = new BinanceFuturesProvider();
  const internal = binance as unknown as { symbols: Set<string>; handleMessage(message: unknown): void };
  internal.symbols.add("BTCUSDT");
  const received: TradeEvent[] = []; binance.on(event => { if (event.type === "trade") received.push(event.data); });
  const payload = { e: "trade", s: "BTCUSDT", t: 1, T: 1000, p: "0", q: "0", m: false };
  internal.handleMessage(payload); internal.handleMessage({ ...payload, p: "80000", q: "2" });
  assert.equal(received.length, 1); assert.equal(received[0].price, 80000); assert.equal(received[0].quantity, 2);
  const gate = new GateioFuturesProvider() as unknown as { normalizeTrade(value: unknown): TradeEvent | null; contractsBySymbol: Map<string, unknown> };
  gate.contractsBySymbol.set("BTC_USDT", { verified: true, multiplier: .0001 });
  assert.equal(gate.normalizeTrade({ id: 1, contract: "BTC_USDT", create_time: 1, price: "80000", size: 0 }), null);
  const valid = gate.normalizeTrade({ id: 2, contract: "BTC_USDT", create_time: 1, price: "80000", size: -25 })!;
  assert.equal(valid.quantity, 25); assert.equal(valid.side, "sell"); assert.equal(valid.contractMultiplier, .0001);
});
test("simulated quotes preserve declared futures multipliers without becoming live observations", () => {
  const market = new MockLiveMarket("ES"); const { trade } = market.tick(Date.UTC(2025, 0, 6, 15));
  const print = buildTradeTape([trade])[0];
  assert.equal(trade.environment, "simulation"); assert.equal(trade.quantityUnit, "contracts");
  assert.equal(print.notional, trade.price * trade.quantity * market.contract.multiplier);
});
