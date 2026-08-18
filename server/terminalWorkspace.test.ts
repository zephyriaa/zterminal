import { describe, expect, it } from "vitest";
import { deriveChartMetrics, getResearchLayerCapability, rangeToTimeframe, summarizeDataset, toProviderInterval, type TerminalBar } from "../client/src/lib/terminalWorkspace";

const bars: TerminalBar[] = [
  { t: 1, o: 100, h: 104, l: 98, c: 102, v: 10 },
  { t: 2, o: 102, h: 108, l: 101, c: 106, v: 20 },
  { t: 3, o: 106, h: 110, l: 105, c: 108, v: 30 },
];

describe("terminal workspace helpers", () => {
  it("maps user controls to public Gate.io intervals", () => {
    expect(toProviderInterval("3m")).toBe("1m");
    expect(toProviderInterval("D")).toBe("1d");
    expect(rangeToTimeframe("5D")).toBe("1h");
    expect(rangeToTimeframe("All")).toBe("D");
  });

  it("derives transparent dataset measures from verified bars", () => {
    const metrics = deriveChartMetrics(bars);
    const summary = summarizeDataset(bars);
    expect(metrics.range).toEqual({ high: 110, low: 98 });
    expect(metrics.windowVwap).not.toBeNull();
    expect(summary).toEqual({ barCount: 3, changePercent: 5.88235294117647, high: 110, low: 98 });
  });

  it("exposes CVD only through its verified public tape source while retaining the options-data gate for GEX", () => {
    expect(getResearchLayerCapability("vwap")).toMatchObject({ availability: "available", source: "Loaded Gate.io public candles" });
    expect(getResearchLayerCapability("cvd")).toMatchObject({ availability: "available", source: "Gate.io public taker-signed trade tape" });
    expect(getResearchLayerCapability("gex")).toMatchObject({ availability: "unavailable", source: "Options-feed required (Deribit/CME/OPRA)" });
  });
});
