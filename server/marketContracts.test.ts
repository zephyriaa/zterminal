import { describe, expect, it } from "vitest";
import { alignRange, classifyProviderFailure, coverageForBars, normalizeGatePerpetualSymbol } from "./marketContracts";

describe("market contract", () => {
  it("normalizes explicit Gate.io perpetual aliases and rejects unsupported syntax", () => {
    expect(normalizeGatePerpetualSymbol("qqqxusdt.p")).toBe("QQQX_USDT");
    expect(normalizeGatePerpetualSymbol("GATEIO:QQQX_USDT.P")).toBe("QQQX_USDT");
    expect(normalizeGatePerpetualSymbol("BTC_USDT")).toBe("BTC_USDT");
    expect(normalizeGatePerpetualSymbol("QQQX/USD")).toBeNull();
    expect(normalizeGatePerpetualSymbol(" ")).toBeNull();
  });

  it("aligns valid ranges to the requested interval and rejects inverted ranges", () => {
    expect(alignRange(121_999, 301_999, "1m")).toEqual({ from: 120_000, to: 300_000 });
    expect(alignRange(300_000, 300_000, "1m")).toBeNull();
  });

  it("discloses requested and effective coverage without claiming a latest-window query is complete", () => {
    const bars = [{ t: 60_000 }, { t: 120_000 }, { t: 180_000 }];
    expect(coverageForBars("1m", bars, { from: null, to: null })).toMatchObject({ effectiveFrom: 60_000, effectiveTo: 180_000, returnedBars: 3, complete: false });
    expect(coverageForBars("1m", bars, { from: 60_000, to: 240_000 })).toMatchObject({ complete: true });
    expect(coverageForBars("1m", bars, { from: 60_000, to: 300_000 })).toMatchObject({ complete: false });
  });

  it("turns provider failures into safe reason categories", () => {
    expect(classifyProviderFailure(new Error("Gate.io returned an invalid historical-candle payload"))).toMatchObject({ reasonCode: "INVALID_PAYLOAD", retryable: false });
    expect(classifyProviderFailure(new Error("Gate.io returned 429"))).toMatchObject({ reasonCode: "RATE_LIMITED", retryable: true });
  });
});
