import { describe, expect, it } from "vitest";
import { calculateEma, calculateVolumeProfile, calculateVwap, evaluateFeatures, featureFingerprint } from "./registry";

const bars = [
  { t: 1_000, o: 10, h: 12, l: 9, c: 11, v: 2 },
  { t: 2_000, o: 11, h: 15, l: 10, c: 14, v: 3 },
  { t: 3_000, o: 14, h: 16, l: 12, c: 13, v: 5 },
];

describe("shared feature registry", () => {
  it("calculates deterministic candle-based VWAP and EMA values", () => {
    expect(calculateVwap(bars)).toBeCloseTo(12.8666666667, 8);
    expect(calculateEma(bars, 2)).toBeCloseTo(13, 8);
    expect(calculateEma([], 20)).toBeNull();
  });

  it("computes profile POC and value-area boundaries from the same verified bar inputs", () => {
    const profile = calculateVolumeProfile(bars, 2);
    expect(profile).not.toBeNull();
    expect(profile?.pointOfControl).toBeCloseTo(14.25, 8);
    expect(profile?.valueAreaLow).toBeCloseTo(12.5, 8);
    expect(profile?.valueAreaHigh).toBeCloseTo(16, 8);
  });

  it("creates stable fingerprints and a complete shared feature evaluation", () => {
    expect(featureFingerprint(bars)).toBe(featureFingerprint([...bars]));
    expect(featureFingerprint(bars)).not.toBe(featureFingerprint([...bars, { t: 4_000, o: 13, h: 14, l: 12, c: 12, v: 1 }]));
    expect(evaluateFeatures(bars)).toMatchObject({ high: 16, low: 9, midpoint: 12.5, fingerprint: expect.stringMatching(/^fnv1a-/) });
  });
});
