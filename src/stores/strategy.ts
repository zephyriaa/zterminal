"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export const DEFAULT_STRATEGY = `from zterminal_research import strategy, inputs, ta

@strategy(name="EMA cross")
def ema_cross(ctx, fast=inputs.int(8, min=1, max=200), slow=inputs.int(21, min=2, max=400)):
    fast_ema = ta.ema(ctx.close, fast)
    slow_ema = ta.ema(ctx.close, slow)
    if ta.crossover(fast_ema, slow_ema)[ctx.index]:
        ctx.enter_long(quantity=1, reason="ema_cross")
    if ta.crossunder(fast_ema, slow_ema)[ctx.index]:
        ctx.close_position(reason="ema_cross_down")
`;

export type ArchivedResearchResult = {
  runId: string;
  hash: string;
  config: { symbol: string; timeframe: string; initialCapital: number; commissionPerContract: number; slippageTicks: number; spreadTicks: number; positionSize: number; from: number; to: number };
  trades: { id: string; side: "long" | "short"; entryTime: number; entryPrice: number; exitTime: number; exitPrice: number; qty: number; pnl: number; bars: number }[];
  barsProcessed: number;
  metrics: { netProfit: number; winRate: number; profitFactor: number; sharpe: number; maxDrawdownPct: number; totalTrades: number };
  dataStatus?: string;
  dataProvenance?: { provider: string; nativeSymbol: string };
};

type ResearchValidation = {
  status: "VALID" | "INVALID" | "UNSUPPORTED";
  diagnostics: { code: string; level: string; message: string; line?: number }[];
  sourceHash?: string;
  artifactId?: string;
} | null;

interface StrategyState {
  source: string;
  setSource: (source: string) => void;
  lastCompile: ResearchValidation;
  setLastCompile: (result: ResearchValidation) => void;
  params: Record<string, number | string | boolean>;
  setParam: (key: string, value: number | string | boolean) => void;
  setParams: (params: Record<string, number | string | boolean>) => void;
  /** Historical display-only result retained for archived runs; new runs use Research V2 records. */
  lastResult: ArchivedResearchResult | null;
  setLastResult: (result: ArchivedResearchResult | null) => void;
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
  setConfig: (config: Partial<StrategyState["config"]>) => void;
}

export const useStrategy = create<StrategyState>()(
  persist(
    (set) => ({
      source: DEFAULT_STRATEGY,
      setSource: (source) => set({ source }),
      lastCompile: null,
      setLastCompile: (lastCompile) => set({ lastCompile }),
      params: {},
      setParam: (key, value) => set((state) => ({ params: { ...state.params, [key]: value } })),
      setParams: (params) => set({ params }),
      lastResult: null,
      setLastResult: (lastResult) => set({ lastResult }),
      config: { symbol: "BTCUSDT", timeframe: "5m", days: 30, initialCapital: 100_000, commissionPerContract: 2.5, slippageTicks: 1, spreadTicks: 1, positionSize: 1 },
      setConfig: (config) => set((state) => ({ config: { ...state.config, ...config } })),
    }),
    {
      name: "zterminal-python-research",
      partialize: (state) => ({ source: state.source, config: state.config, params: state.params }),
    },
  ),
);
