import { evaluateFeatures } from "@shared/features/registry";

export type Timeframe = "1m" | "3m" | "5m" | "15m" | "30m" | "1h" | "4h" | "D";
export type ProviderInterval = "1m" | "5m" | "15m" | "30m" | "1h" | "4h" | "1d";
export type TerminalBar = { t: number; o: number; h: number; l: number; c: number; v: number };
export type ResearchLayerId = "vwap" | "ema" | "profile" | "sessions" | "structure" | "cvd" | "dom" | "tape" | "footprint" | "flowPulse" | "gex";
export type ResearchLayerCapability = {
  id: ResearchLayerId;
  label: string;
  category: "study" | "context" | "flow" | "positioning";
  availability: "available" | "unavailable";
  source: string;
  detail: string;
};

export const RESEARCH_LAYER_CAPABILITIES: ResearchLayerCapability[] = [
  { id: "vwap", label: "VWAP", category: "study", availability: "available", source: "Loaded Gate.io public candles", detail: "Volume-weighted typical price across the loaded verified candle window." },
  { id: "ema", label: "EMA 20 / 50", category: "study", availability: "available", source: "Loaded Gate.io public candles", detail: "Exponential moving averages calculated from the loaded verified candle closes." },
  { id: "profile", label: "Volume profile", category: "context", availability: "available", source: "Loaded Gate.io public candles", detail: "Volume distribution grouped from the loaded verified candle window; not tick-level volume-at-price." },
  { id: "sessions", label: "Sessions", category: "context", availability: "available", source: "Loaded Gate.io public candle timestamps", detail: "Subtle UTC session regions inferred from verified candle timestamps." },
  { id: "structure", label: "Structure", category: "context", availability: "available", source: "Loaded Gate.io public candles", detail: "Loaded-window high, low, and midpoint context; not a predictive signal." },
  { id: "cvd", label: "CVD", category: "flow", availability: "available", source: "Gate.io public taker-signed trade tape", detail: "Cumulative signed size from the current bounded public trade-stream window. Positive size is exchange-reported taker buy; negative size is exchange-reported taker sell. It is not derived from candle bars or a historical tick archive." },
  { id: "dom", label: "Live DOM", category: "flow", availability: "available", source: "Gate.io public depth snapshot + sequenced deltas", detail: "Top-of-book depth reconciled from a REST snapshot and ordered public deltas. It is live-only, hides on stale or degraded transport, and does not represent historical depth." },
  { id: "tape", label: "Time & Sales", category: "flow", availability: "available", source: "Gate.io public taker-signed trade tape", detail: "A bounded ordered list of exchange-reported public trades. Buy or sell is shown only from Gate.io’s signed taker size; it is live-only and not a historical tick archive." },
  { id: "footprint", label: "Live footprint", category: "flow", availability: "available", source: "Selected public taker-signed trade tape", detail: "Exact-price buy, sell, and delta aggregation across the current bounded public tape. It is not derived from candle volume and is not historical footprint data." },
  { id: "flowPulse", label: "Flow pulse", category: "flow", availability: "available", source: "Live public tape + Gate.io reconciled depth when available", detail: "Current 30-second tape delta and top-level depth imbalance evidence. Labels describe observed current data only; no automated alert, prediction, or execution action is generated." },
  { id: "gex", label: "GEX", category: "positioning", availability: "unavailable", source: "Options-feed required (Deribit/CME/OPRA)", detail: "Gamma exposure is not estimated from public candle or perpetual trade data." },
];

export function getResearchLayerCapability(id: ResearchLayerId) {
  return RESEARCH_LAYER_CAPABILITIES.find((layer) => layer.id === id) ?? null;
}

export function toProviderInterval(timeframe: Timeframe): ProviderInterval {
  if (timeframe === "3m") return "1m";
  if (timeframe === "D") return "1d";
  return timeframe;
}

export function rangeToTimeframe(range: string): Timeframe {
  if (range === "1D") return "15m";
  if (range === "5D") return "1h";
  if (range === "1M" || range === "3M") return "4h";
  return "D";
}

export function deriveChartMetrics(bars: TerminalBar[]) {
  const features = evaluateFeatures(bars);
  return {
    windowVwap: features.vwap,
    ema20: features.ema20,
    ema50: features.ema50,
    range: features.high === null || features.low === null ? null : { high: features.high, low: features.low },
  };
}

export function summarizeDataset(bars: TerminalBar[]) {
  if (bars.length < 2) return { barCount: bars.length, changePercent: null, high: null, low: null };
  const first = bars[0].c;
  const last = bars.at(-1)?.c ?? first;
  return {
    barCount: bars.length,
    changePercent: first !== 0 ? ((last - first) / first) * 100 : null,
    high: Math.max(...bars.map((bar) => bar.h)),
    low: Math.min(...bars.map((bar) => bar.l)),
  };
}
