import type { Bar } from "@/lib/market/types";

export const RESEARCH_PROTOCOL = 1;
export const HELPER_URL = "http://127.0.0.1:47321";
export type ResearchProvider = "gateio" | "binance";
export type ResearchStage = "validating" | "loading_data" | "running_strategy" | "calculating_report" | "saving_result" | "complete" | "failed" | "cancelled";
export interface Diagnostic { message: string; line?: number; column?: number; detail?: string; }
export interface ResearchConfig {
  provider: ResearchProvider; symbol: string; timeframe: string;
  from: number; to: number; initialCapital: number;
  feeBps: number; slippageBps: number; allocation: number;
  direction: "long" | "both"; multiplier: number; quantityStep: number;
}
export interface Dataset {
  version: 1; provider: ResearchProvider; product: "perpetual";
  symbol: string; timeframe: string; from: number; to: number;
  bars: Bar[]; hash: string;
}
export interface ScriptRecord {
  id: string; name: string; source: string; savedSource: string;
  updatedAt: number; revision: number;
}
export interface ResearchTrade {
  id: string; side: "long" | "short"; entryTime: number; exitTime: number | null;
  entryPrice: number; exitPrice: number; quantity: number; pnl: number;
  return: number; accountReturn: number | null; fees: number; status: "closed" | "open";
}
export interface EquityPoint { time: number; equity: number; drawdown: number; benchmark: number; }
export interface Metric { value: number | null; reason?: string; }
export interface MonteCarloResult {
  method: "iid_closed_trade_account_returns"; seed: number; simulations: number; observations: number;
  bands: { step: number; lower: number; median: number; upper: number }[];
  samplePaths: number[][]; endingEquity: number[]; maxDrawdowns: number[];
  probabilityOfLoss: number; initialCapital: number;
}
export interface ResearchResult {
  version: 1; id: string; createdAt: number; name: string; source: string;
  sourceHash: string; inputHash: string; resultHash: string;
  engine: { engine?: string; python: string; vectorbt: string; sdk: string; analytics: string };
  config: ResearchConfig; params: Record<string, number | string | boolean>; dataset: Dataset; assumptions: string[];
  metrics: Record<string, Metric>; equity: EquityPoint[]; trades: ResearchTrade[];
  plots: Record<string, { time: number; value: number }[]>;
  monthly: { period: string; return: number | null }[];
  drawdowns: { start: number; trough: number; recovery: number | null; depth: number; durationMs: number }[];
  observations: string[]; logs: string[]; monteCarlo?: MonteCarloResult;
}
export interface ResearchJob {
  id: string; stage: ResearchStage; diagnostic?: Diagnostic; resultId?: string;
}
export interface RunRequest { name: string; source: string; config: ResearchConfig; dataset: Dataset; params: Record<string, number | string | boolean>; }

export function defaultResearchConfig(now = Date.now()): ResearchConfig {
  const to = Math.floor(now / 3_600_000) * 3_600_000;
  return { provider: "gateio", symbol: "BTC_USDT", timeframe: "1h", from: to - 90 * 86_400_000, to,
    initialCapital: 10_000, feeBps: 10, slippageBps: 5, allocation: 0.1, direction: "long", multiplier: 1, quantityStep: 0.000001 };
}
