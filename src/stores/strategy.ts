"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { BacktestResult } from "@/lib/strategy/zs-runtime";

export const DEFAULT_STRATEGY = `# ZS — Z Strategy Language
# Custom DSL (Pine-like, NOT Pine-compatible). See STRATEGY_LANGUAGE.md.
strategy("EMA Cross + VWAP Filter", overlay=true)

input.float("Fast", 8, minval=1, maxval=200, step=1)
input.float("Slow", 21, minval=1, maxval=400, step=1)

var fastEma = ema(close, Fast)
var slowEma = ema(close, Slow)

plot(fastEma, "EMA Fast")
plot(slowEma, "EMA Slow")
plot(vwap, "VWAP")

if close > vwap
  if crossover(fastEma, slowEma)
    strategy.entry("long", strategy.long, qty=1)

if crossunder(fastEma, slowEma)
  strategy.close("long")
`;

interface StrategyState {
  source: string;
  setSource: (s: string) => void;
  lastCompile: {
    ok: boolean;
    inputs: { name: string; type: string; default: number | string | boolean; minval?: number; maxval?: number; step?: number }[];
    diagnostics: { line: number; col: number; severity: string; message: string }[];
    name: string;
    compiledAt: number;
  } | null;
  setLastCompile: (c: StrategyState["lastCompile"]) => void;

  params: Record<string, number | string | boolean>;
  setParam: (k: string, v: number | string | boolean) => void;
  setParams: (p: Record<string, number | string | boolean>) => void;

  lastResult: BacktestResult | null;
  setLastResult: (r: BacktestResult | null) => void;

  // backtest config
  config: {
    symbol: string;
    timeframe: string;
    days: number;
    initialCapital: number;
    commissionPerContract: number;
    slippageTicks: number;
    spreadTicks: number;
    positionSize: number;
  };
  setConfig: (c: Partial<StrategyState["config"]>) => void;
}

export const useStrategy = create<StrategyState>()(
  persist(
    (set) => ({
      source: DEFAULT_STRATEGY,
      setSource: (s) => set({ source: s }),
      lastCompile: null,
      setLastCompile: (c) => set({ lastCompile: c }),
      params: {},
      setParam: (k, v) => set((s) => ({ params: { ...s.params, [k]: v } })),
      setParams: (p) => set({ params: p }),
      lastResult: null,
      setLastResult: (r) => set({ lastResult: r }),
      config: {
        symbol: "QQQX_USDT",
        timeframe: "5m",
        days: 30,
        initialCapital: 100_000,
        commissionPerContract: 2.5,
        slippageTicks: 1,
        spreadTicks: 1,
        positionSize: 1,
      },
      setConfig: (c) => set((s) => ({ config: { ...s.config, ...c } })),
    }),
    {
      name: "zterminal-strategy",
      partialize: (s) => ({ source: s.source, config: s.config, params: s.params }),
    }
  )
);
