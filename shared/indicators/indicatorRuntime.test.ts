import { describe, expect, it } from "vitest";
import { compileIndicator, evaluateIndicator } from "./indicatorRuntime";

const bars = [
  { t: 1_000, o: 10, h: 11, l: 9, c: 10, v: 100 },
  { t: 2_000, o: 11, h: 12, l: 10, c: 11, v: 120 },
  { t: 3_000, o: 12, h: 13, l: 11, c: 12, v: 140 },
  { t: 4_000, o: 13, h: 14, l: 12, c: 13, v: 160 },
];

describe("closed Indicator Lab runtime", () => {
  it("compiles an explicit candle-only overlay and evaluates each bar without future data", () => {
    const compiled = compileIndicator({
      name: "Close plus spread",
      expression: "close + (high - low)",
      output: { pane: "overlay", color: "#70e7d7", lineWidth: 2 },
      inputs: [],
    });
    expect(compiled.status).toBe("VALID");
    if (compiled.status !== "VALID") throw new Error("expected a valid definition");

    const result = evaluateIndicator(compiled, bars);
    expect(result.status).toBe("COMPLETED");
    expect(result.points.map(point => point.value)).toEqual([12, 13, 14, 15]);
    expect(result.evidence.inputContract).toBe("LOADED_VERIFIED_OHLCV_ONLY");
    expect(result.evidence.lookahead).toBe("NOT_PERMITTED");
  });

  it("uses validated bounded numeric inputs and deterministic SMA output", () => {
    const compiled = compileIndicator({
      name: "Fast average",
      expression: "sma(close, length)",
      output: { pane: "overlay", color: "#a984ff", lineWidth: 1 },
      inputs: [{ id: "length", label: "Length", defaultValue: 2, min: 1, max: 10, step: 1 }],
    });
    expect(compiled.status).toBe("VALID");
    if (compiled.status !== "VALID") throw new Error("expected a valid definition");

    const result = evaluateIndicator(compiled, bars, { length: 2 });
    expect(result.status).toBe("COMPLETED");
    expect(result.points.map(point => point.value)).toEqual([10, 10.5, 11.5, 12.5]);
  });

  it("rejects escape hatches and unsupported market-data identifiers instead of executing them", () => {
    expect(compileIndicator({ name: "Unsafe", expression: "fetch('https://example.com')", output: { pane: "overlay", color: "#ffffff", lineWidth: 1 }, inputs: [] })).toMatchObject({ status: "INVALID", diagnostic: expect.stringMatching(/not allowed|unknown/i) });
    expect(compileIndicator({ name: "No tape", expression: "cvd + close", output: { pane: "overlay", color: "#ffffff", lineWidth: 1 }, inputs: [] })).toMatchObject({ status: "INVALID", diagnostic: expect.stringMatching(/unknown identifier/i) });
    expect(compileIndicator({ name: "No future", expression: "close[1]", output: { pane: "overlay", color: "#ffffff", lineWidth: 1 }, inputs: [] })).toMatchObject({ status: "INVALID", diagnostic: expect.stringMatching(/not allowed|unexpected/i) });
  });

  it("fails closed when an input value is outside the declared bounds", () => {
    const compiled = compileIndicator({
      name: "Bounded average",
      expression: "ema(close, length)",
      output: { pane: "overlay", color: "#ffffff", lineWidth: 1 },
      inputs: [{ id: "length", label: "Length", defaultValue: 3, min: 1, max: 5, step: 1 }],
    });
    expect(compiled.status).toBe("VALID");
    if (compiled.status !== "VALID") throw new Error("expected a valid definition");

    expect(evaluateIndicator(compiled, bars, { length: 6 })).toMatchObject({ status: "UNAVAILABLE", reason: expect.stringMatching(/outside/i) });
  });
});
