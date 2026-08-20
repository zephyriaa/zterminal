import { describe, expect, it } from "vitest";
import { NATIVE_INDICATOR_PRESETS } from "./catalog";
import { compileIndicator, evaluateIndicator } from "./indicatorRuntime";

const bars = Array.from({ length: 40 }, (_, index) => {
  const close = 100 + index * 1.5 + (index % 3 === 0 ? -0.4 : 0.3);
  return { t: 1_700_000_000_000 + index * 60_000, o: close - 0.2, h: close + 1.2, l: close - 1, c: close, v: 500 + index * 13 };
});

describe("native indicator catalog", () => {
  it("contains uniquely identified, source-attributed presets that compile and evaluate only from loaded OHLCV bars", () => {
    const ids = new Set<string>();
    for (const preset of NATIVE_INDICATOR_PRESETS) {
      expect(ids.has(preset.id)).toBe(false);
      ids.add(preset.id);
      expect(preset.source).toBe("ZTerminal native formula");
      const compiled = compileIndicator(preset.draft);
      expect(compiled.status, preset.id).toBe("VALID");
      if (compiled.status !== "VALID") continue;
      const evaluation = evaluateIndicator(compiled, bars);
      expect(evaluation.status, preset.id).toBe("COMPLETED");
      if (evaluation.status === "COMPLETED") {
        expect(evaluation.points).toHaveLength(bars.length);
        expect(evaluation.evidence.inputContract).toBe("LOADED_VERIFIED_OHLCV_ONLY");
      }
    }
  });
});
