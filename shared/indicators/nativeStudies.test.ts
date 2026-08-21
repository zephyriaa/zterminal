import { describe, expect, it } from "vitest";
import { evaluateNativeStudy, getNativeStudy } from "./nativeStudies";

const bars = Array.from({ length: 40 }, (_, index) => {
  const close = 100 + index + (index % 3 === 0 ? 2 : -1);
  return { t: 1_700_000_000_000 + index * 60_000, o: close - 1, h: close + 2, l: close - 3, c: close, v: 10 + index };
});

describe("native studies", () => {
  it("evaluates a complete multi-series MACD without future values", () => {
    const result = evaluateNativeStudy({ id: "macd" }, bars);
    expect(result.status).toBe("COMPLETED");
    if (result.status !== "COMPLETED") return;
    expect(result.series.map((series) => series.id)).toEqual(["macd", "macd-signal", "macd-histogram"]);
    expect(result.series.every((series) => series.points.length === bars.length)).toBe(true);
    expect(result.evidence).toEqual({ inputContract: "LOADED_VERIFIED_OHLCV", lookahead: "NOT_PERMITTED", barCount: bars.length });
  });

  it("produces complete Bollinger and Stochastic study lines from verified OHLCV", () => {
    const bollinger = evaluateNativeStudy({ id: "bollinger", inputs: { length: 10, mult: 2 } }, bars);
    const stochastic = evaluateNativeStudy({ id: "stochastic", inputs: { length: 10, smooth: 3 } }, bars);
    expect(bollinger.status).toBe("COMPLETED");
    expect(stochastic.status).toBe("COMPLETED");
    if (bollinger.status === "COMPLETED") expect(bollinger.series).toHaveLength(3);
    if (stochastic.status === "COMPLETED") expect(stochastic.series).toHaveLength(2);
  });

  it("keeps Volume Delta unavailable without a verified intrabar contract", () => {
    const result = evaluateNativeStudy({ id: "volume_delta" }, bars);
    expect(result.status).toBe("UNAVAILABLE");
    if (result.status === "UNAVAILABLE") expect(result.reason).toContain("verified intrabar coverage");
  });

  it("exposes complete catalog metadata for the indicator browser", () => {
    expect(getNativeStudy("volume_ma")?.category).toBe("Volume");
    expect(getNativeStudy("cumulative_volume_delta")?.dataContract).toBe("VERIFIED_INTRABAR");
  });
});
