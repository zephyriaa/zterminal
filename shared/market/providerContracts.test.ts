import { describe, expect, it } from "vitest";
import { PROVIDER_CATALOG, gateContractToMarketMetadata, getProviderCatalogEntry, providerCapability } from "./providerContracts";

describe("provider contracts", () => {
  it("lists released bounded public trade tapes separately from unreleased provider capabilities", () => {
    const gateio = getProviderCatalogEntry("gateio");
    const binance = getProviderCatalogEntry("binance_usdm");
    const bybit = getProviderCatalogEntry("bybit_linear");
    expect(gateio?.lifecycle).toBe("ACTIVE");
    expect(providerCapability(gateio!, "HISTORICAL_CANDLES")).toMatchObject({ state: "AVAILABLE" });
    expect(providerCapability(gateio!, "PUBLIC_TRADES")).toMatchObject({ state: "AVAILABLE" });
    expect(providerCapability(gateio!, "ORDER_BOOK_DEPTH")).toMatchObject({ state: "AVAILABLE" });
    expect(binance?.lifecycle).toBe("ACTIVE");
    expect(providerCapability(binance!, "PUBLIC_TRADES")).toMatchObject({ state: "VERIFYING" });
    expect(providerCapability(binance!, "ORDER_BOOK_DEPTH")).toMatchObject({ state: "VERIFYING" });
    expect(bybit?.lifecycle).toBe("ACTIVE");
    expect(providerCapability(bybit!, "PUBLIC_TRADES")).toMatchObject({ state: "AVAILABLE" });
    expect(providerCapability(gateio!, "OPTIONS_CHAIN")).toMatchObject({ state: "UNAVAILABLE" });
    expect(PROVIDER_CATALOG.some(provider => provider.id === "deribit_options" && provider.lifecycle === "CATALOGUED")).toBe(true);
  });

  it("normalizes only explicit Gate USDT perpetual contract metadata", () => {
    const metadata = gateContractToMarketMetadata({
      name: "btc_usdt",
      order_price_round: "0.1",
      quanto_multiplier: "0.0001",
      in_delisting: false,
    }, 1_700_000_000_000);

    expect(metadata).toEqual({
      provider: "gateio",
      nativeSymbol: "BTC_USDT",
      displaySymbol: "BTC/USDT",
      product: "PERPETUAL",
      settlementAsset: "USDT",
      tickSize: 0.1,
      multiplier: 0.0001,
      inDelisting: false,
      source: "gateio-futures-contracts",
      fetchedAt: 1_700_000_000_000,
    });
    expect(gateContractToMarketMetadata({ name: "BTC_USD" }, Date.now())).toBeNull();
    expect(gateContractToMarketMetadata({ name: "BTC_USDT", order_price_round: "NaN" }, Date.now())?.tickSize).toBeNull();
  });
});
