export type Timeframe = "1m" | "3m" | "5m" | "15m" | "30m" | "1h" | "4h" | "D";
export type ProviderInterval = "1m" | "5m" | "15m" | "30m" | "1h" | "4h" | "1d";
export type TerminalBar = { t: number; o: number; h: number; l: number; c: number; v: number };
export type ResearchLayerId = "vwap" | "ema" | "profile" | "sessions" | "structure" | "cvd" | "gex";
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
  { id: "cvd", label: "CVD", category: "flow", availability: "unavailable", source: "Verified public trade tape required", detail: "Cumulative volume delta is not calculated from candle bars." },
  { id: "gex", label: "GEX", category: "positioning", availability: "unavailable", source: "Verified options-chain and Greek data required", detail: "Gamma exposure is not estimated from public candle data." },
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

function calculateEma(bars: TerminalBar[], period: number): number | null {
  if (!bars.length) return null;
  const multiplier = 2 / (period + 1);
  return bars.reduce((ema, bar, index) => index === 0 ? bar.c : (bar.c - ema) * multiplier + ema, bars[0].c);
}

export function deriveChartMetrics(bars: TerminalBar[]) {
  if (!bars.length) return { windowVwap: null, ema20: null, ema50: null, range: null };
  const cumulative = bars.reduce(
    (accumulator, bar) => {
      const typicalPrice = (bar.h + bar.l + bar.c) / 3;
      return {
        priceVolume: accumulator.priceVolume + typicalPrice * bar.v,
        volume: accumulator.volume + bar.v,
      };
    },
    { priceVolume: 0, volume: 0 },
  );
  return {
    windowVwap: cumulative.volume > 0 ? cumulative.priceVolume / cumulative.volume : null,
    ema20: calculateEma(bars, 20),
    ema50: calculateEma(bars, 50),
    range: { high: Math.max(...bars.map((bar) => bar.h)), low: Math.min(...bars.map((bar) => bar.l)) },
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
