import { describe, expect, it } from "vitest";
import { runBacktest } from "./engine";

function makeBars() {
  const closes = [...Array.from({ length: 30 }, (_, index) => 130 - index), ...Array.from({ length: 40 }, (_, index) => 101 + index * 1.8)];
  return closes.map((close, index) => ({ t: 1_700_000_000_000 + index * 60_000, o: close - 0.2, h: close + 1, l: close - 1, c: close, v: 100 + (index % 5) * 20 }));
}

describe("deterministic research backtest", () => {
  it("is deterministic and fills every trade strictly after the signal bar", () => {
    const bars = makeBars();
    const first = runBacktest("ema20_50_vwap_long", bars, { commissionPerUnit: 0.25, slippageTicks: 2, tickSize: 0.1 });
    const second = runBacktest("ema20_50_vwap_long", bars, { commissionPerUnit: 0.25, slippageTicks: 2, tickSize: 0.1 });
    expect(first.status).toBe("COMPLETED");
    expect(first.hash).toBe(second.hash);
    expect(first.trades).toEqual(second.trades);
    expect(first.trades.length).toBeGreaterThan(0);
    for (const trade of first.trades) {
      expect(trade.entryTime).toBeGreaterThan(trade.signalTime);
      expect(trade.costs).toBe(0.5);
    }
  });

  it("does not claim results where the EMA 50 warm-up and next-bar model cannot be evaluated", () => {
    const result = runBacktest("ema20_50_vwap_long", makeBars().slice(0, 51));
    expect(result.status).toBe("INSUFFICIENT_DATA");
    expect(result.metrics).toBeNull();
    expect(result.trades).toEqual([]);
  });

  it("changes the run identity when an explicit cost assumption changes", () => {
    const bars = makeBars();
    const zeroCost = runBacktest("ema20_50_vwap_long", bars, { commissionPerUnit: 0 });
    const costed = runBacktest("ema20_50_vwap_long", bars, { commissionPerUnit: 2 });
    expect(zeroCost.hash).not.toBe(costed.hash);
    expect(costed.metrics?.netPnl).toBeLessThan(zeroCost.metrics?.netPnl ?? Infinity);
  });
});
