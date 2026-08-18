import { describe, expect, it } from "vitest";
import { normalizeBinanceUsdmAggregateTrade, normalizeBybitLinearPublicTrade, normalizeBybitLinearPublicTrades, normalizeUsdtPerpetualSymbol } from "./multiExchangeContracts";

describe("multi-exchange public trade contracts", () => {
  it("normalizes linear symbols without accepting non-USDT contracts", () => {
    expect(normalizeUsdtPerpetualSymbol("BTCUSDT")).toBe("BTC_USDT");
    expect(normalizeUsdtPerpetualSymbol("ETHUSDT")).toBe("ETH_USDT");
    expect(normalizeUsdtPerpetualSymbol("BTCUSD_PERP")).toBeNull();
  });

  it("preserves Binance aggregate-trade maker semantics as the opposite taker side", () => {
    const buy = normalizeBinanceUsdmAggregateTrade({ e: "aggTrade", a: 1, s: "BTCUSDT", p: "62000.5", q: "0.25", T: 1_700_000_000_000, m: false });
    const sell = normalizeBinanceUsdmAggregateTrade({ e: "aggTrade", a: 2, s: "BTCUSDT", p: "62000.5", q: "0.25", T: 1_700_000_000_001, m: true });
    expect(buy).toMatchObject({ provider: "binance_usdm", symbol: "BTC_USDT", signedSize: 0.25 });
    expect(sell).toMatchObject({ provider: "binance_usdm", symbol: "BTC_USDT", signedSize: -0.25 });
    expect(normalizeBinanceUsdmAggregateTrade({ s: "BTCUSDT", p: "1", q: "1", T: 1, a: 1 })).toBeNull();
  });

  it("uses Bybit’s reported taker side and supports bounded multi-trade messages", () => {
    const message = { topic: "publicTrade.BTCUSDT", data: [
      { T: 1_700_000_000_000, s: "BTCUSDT", S: "Buy", v: "0.1", p: "62000", i: "bybit-1" },
      { T: 1_700_000_000_001, s: "BTCUSDT", S: "Sell", v: "0.2", p: "62001", i: "bybit-2" },
    ] };
    expect(normalizeBybitLinearPublicTrade(message.data[0])).toMatchObject({ provider: "bybit_linear", signedSize: 0.1 });
    expect(normalizeBybitLinearPublicTrades(message).map(item => item.signedSize)).toEqual([0.1, -0.2]);
  });
});
