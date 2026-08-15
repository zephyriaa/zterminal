import { describe, expect, it } from "vitest";
import { finiteNumber, normalizePublicBars } from "./marketData";

describe("public market-data normalization", () => {
  it("accepts finite numeric wire values and rejects malformed values", () => {
    expect(finiteNumber("731.31")).toBe(731.31);
    expect(finiteNumber(14)).toBe(14);
    expect(finiteNumber("not-a-number")).toBeNull();
    expect(finiteNumber(Infinity)).toBeNull();
  });

  it("normalizes valid Gate-style candles, filters invalid records, and sorts timestamps", () => {
    const bars = normalizePublicBars([
      { t: "20", o: "10", h: "14", l: "8", c: "11", v: "3" },
      { t: "10", o: "9", h: "10", l: "8", c: "9.5", v: 4 },
      { t: "30", o: "10", h: "9", l: "8", c: "11", v: "2" },
      { t: "40", o: "10", h: "12", l: "8", c: "11", v: "bad" },
    ]);

    expect(bars).toEqual([
      { t: 10_000, o: 9, h: 10, l: 8, c: 9.5, v: 4 },
      { t: 20_000, o: 10, h: 14, l: 8, c: 11, v: 3 },
    ]);
  });
});
