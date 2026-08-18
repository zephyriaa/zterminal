import { describe, expect, it } from "vitest";
import { runBacktest, runSignalBacktest, type StrategyDefinition } from "./engine";

function makeBars() {
  const closes = [...Array.from({ length: 30 }, (_, index) => 130 - index), ...Array.from({ length: 40 }, (_, index) => 101 + index * 1.8)];
  return closes.map((close, index) => ({ t: 1_700_000_000_000 + index * 60_000, o: close - 0.2, h: close + 1, l: close - 1, c: close, v: 100 + (index % 5) * 20 }));
}

const verifiedContext = {
  sourceFingerprint: "fnv1a-protocol-source",
  parameters: { Length: 20, Enabled: true },
  protocol: { kind: "BASELINE" as const, baselineFingerprint: "fnv1a-baseline-1234" },
  data: { provider: "gateio", symbol: "QQQX_USDT", interval: "1m", requestedFrom: 1_700_000_000_000, requestedTo: 1_700_004_740_000, sourceTimestamp: 1_700_004_740_000, fetchedAt: 1_700_004_800_000, coverageComplete: true, dataStatus: "HISTORICAL" as const },
};

describe("deterministic research backtest", () => {
  it("is deterministic and fills every trade strictly after the signal bar with explicit commission, spread, and slippage accounting", () => {
    const bars = makeBars();
    const config = { commissionPerUnit: 0.25, spreadTicks: 2, slippageTicks: 2, tickSize: 0.1 };
    const first = runBacktest("ema20_50_vwap_long", bars, config, verifiedContext);
    const second = runBacktest("ema20_50_vwap_long", bars, config, verifiedContext);
    expect(first.status).toBe("COMPLETED");
    expect(first.hash).toBe(second.hash);
    expect(first.trades).toEqual(second.trades);
    expect(first.trades.length).toBeGreaterThan(0);
    for (const trade of first.trades) {
      expect(trade.entryTime).toBeGreaterThan(trade.signalTime);
      expect(trade.commissionCosts).toBe(0.5);
      expect(trade.spreadCosts).toBe(0.2);
      expect(trade.slippageCosts).toBe(0.4);
      expect(trade.costs).toBe(1.1);
    }
  });

  it("retains complete verified data provenance, immutable baseline classification, monthly outcomes, drawdown, and marker times", () => {
    const result = runBacktest("ema20_50_vwap_long", makeBars(), {}, verifiedContext);
    expect(result.classification).toEqual({ kind: "BASELINE", label: "BASELINE · NO OPTIMIZATION", baselineFingerprint: "fnv1a-baseline-1234", incrementField: null });
    expect(result.provenance).toMatchObject({ provider: "gateio", symbol: "QQQX_USDT", interval: "1m", coverageComplete: true, dataStatus: "HISTORICAL", suppliedBars: 70, normalizedBars: 70, rejectedBars: 0, duplicateBars: 0 });
    expect(result.equity).toHaveLength(70);
    expect(result.drawdown).toHaveLength(70);
    expect(result.monthlyOutcomes.length).toBeGreaterThan(0);
    expect(result.markers).toHaveLength(result.trades.length * 2);
    for (const trade of result.trades) {
      expect(result.markers.some(marker => marker.time === trade.entryTime && marker.shape === "arrowUp")).toBe(true);
      expect(result.markers.some(marker => marker.time === trade.exitTime && marker.shape === "arrowDown")).toBe(true);
    }
  });

  it("does not claim results where the EMA 50 warm-up and next-bar model cannot be evaluated", () => {
    const result = runBacktest("ema20_50_vwap_long", makeBars().slice(0, 51), {}, verifiedContext);
    expect(result.status).toBe("INSUFFICIENT_DATA");
    expect(result.metrics).toBeNull();
    expect(result.trades).toEqual([]);
  });

  it("changes run identity when source, parameter, protocol classification, or a cost assumption changes", () => {
    const bars = makeBars();
    const baseline = runBacktest("ema20_50_vwap_long", bars, { commissionPerUnit: 0 }, verifiedContext);
    const costed = runBacktest("ema20_50_vwap_long", bars, { commissionPerUnit: 2 }, verifiedContext);
    const changedParameter = runBacktest("ema20_50_vwap_long", bars, { commissionPerUnit: 0 }, { ...verifiedContext, parameters: { Length: 21, Enabled: true } });
    const incremental = runBacktest("ema20_50_vwap_long", bars, { commissionPerUnit: 0 }, { ...verifiedContext, protocol: { kind: "INCREMENTAL", baselineFingerprint: "fnv1a-baseline-1234", incrementField: "sizing" } });
    expect(baseline.hash).not.toBe(costed.hash);
    expect(costed.metrics?.netPnl).toBeLessThan(baseline.metrics?.netPnl ?? Infinity);
    expect(changedParameter.hash).not.toBe(baseline.hash);
    expect(incremental.hash).not.toBe(baseline.hash);
    expect(incremental.classification.label).toBe("INCREMENTAL · ONE VARIABLE");
  });

  it("evaluates prevalidated closed-runtime signals with next-open fills rather than silently substituting the fixed template", () => {
    const bars = makeBars().slice(0, 6);
    const strategy: StrategyDefinition = { id: "zs-closed-fixture", version: "zs-historical-runtime-v1", label: "Closed fixture", description: "Fixture only", signalTiming: "bar_close", entryRule: "Declared entry", exitRule: "Declared close", limitations: ["Closed runtime fixture."] };
    const signals = [
      { kind: "entry" as const, time: bars[1]!.t, barIndex: 1, id: "long", quantity: 2.5 },
      { kind: "exit" as const, time: bars[3]!.t, barIndex: 3, id: "long" },
    ];
    const first = runSignalBacktest(strategy, signals, bars, { tickSize: 0.1 }, verifiedContext);
    const second = runSignalBacktest(strategy, signals, bars, { tickSize: 0.1 }, verifiedContext);
    expect(first.status).toBe("COMPLETED");
    expect(first.hash).toBe(second.hash);
    expect(first.strategy.id).toBe("zs-closed-fixture");
    expect(first.trades).toHaveLength(1);
    expect(first.trades[0]).toMatchObject({ signalTime: bars[1]!.t, entryTime: bars[2]!.t, exitTime: bars[4]!.t, quantity: 2.5, reason: "signal_exit" });
    expect(first.limitations.some(item => item.includes("closed historical runtime"))).toBe(true);
    const invalid = runSignalBacktest(strategy, [{ kind: "entry", time: 123, barIndex: 1, id: "long", quantity: 1 }], bars, {}, verifiedContext);
    expect(invalid.status).toBe("INVALID_INPUT");
    expect(invalid.trades).toEqual([]);
  });

  it("normalizes duplicates, rejects malformed bars, and distinguishes terminal marks from next-bar market fills", () => {
    const bars = makeBars();
    const malformed = { ...bars[3], t: Number.NaN };
    const withDuplicateAndMalformed = [...bars, bars[4], malformed];
    const result = runBacktest("ema20_50_vwap_long", withDuplicateAndMalformed, {}, verifiedContext);
    expect(result.provenance).toMatchObject({ suppliedBars: 72, normalizedBars: 70, duplicateBars: 1, rejectedBars: 1 });
    expect(result.trades.every(trade => trade.reason === "signal_exit" || trade.reason === "end_of_data_mark")).toBe(true);
    expect(result.limitations.some(item => item.includes("final close"))).toBe(true);
  });
});
