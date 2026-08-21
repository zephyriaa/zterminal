import { describe, expect, it } from "vitest";
import { calculateIntrabarDelta, hasCompleteIntrabarSequence, requiredIntervalBars, selectIntrabarInterval } from "./intrabarDelta";

const base = 1_700_000_100_000;
const oneMinuteBars = [
  { t: base, o: 100, h: 102, l: 99, c: 101, v: 10 },
  { t: base + 60_000, o: 101, h: 102, l: 99, c: 100, v: 5 },
  { t: base + 120_000, o: 100, h: 101, l: 99, c: 100, v: 7 },
  { t: base + 180_000, o: 100, h: 103, l: 100, c: 102, v: 8 },
  { t: base + 240_000, o: 102, h: 104, l: 101, c: 103, v: 4 },
];

describe("intrabar directional-volume estimates", () => {
  it("selects a strictly lower interval when one is supported", () => {
    expect(selectIntrabarInterval("5m")).toBe("1m");
    expect(selectIntrabarInterval("1h")).toBe("5m");
    expect(selectIntrabarInterval("1m")).toBeNull();
  });

  it("requires a contiguous, complete lower-timeframe sequence", () => {
    expect(requiredIntervalBars(base, base + 240_000, "1m")).toBe(5);
    expect(hasCompleteIntrabarSequence(oneMinuteBars, base, base + 240_000, "1m")).toBe(true);
    expect(hasCompleteIntrabarSequence(oneMinuteBars.slice(1), base, base + 240_000, "1m")).toBe(false);
  });

  it("aggregates direction-estimated volume with flat intrabars contributing zero", () => {
    const points = calculateIntrabarDelta({ bars: oneMinuteBars, chartInterval: "5m", from: base, to: base + 240_000 });
    expect(points).toEqual([{ t: base, delta: 17, cumulativeDelta: 17, intrabarCount: 5 }]);
  });
});
