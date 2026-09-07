import type { ChartStudy } from "@/components/terminal/terminal-chart";
export type StudyKind = ChartStudy["kind"] | "volume" | "profile";
export type IndicatorInstance = Omit<ChartStudy, "kind"> & { kind: StudyKind; presetId: string };
export type IndicatorDefinition = { id: string; name: string; aliases: string; kind: StudyKind; category: "Trend" | "Volatility" | "Volume"; description: string; display: "Overlay" | "Pane"; period?: number; multiplier?: number; color: string };
export const INDICATOR_LIBRARY: IndicatorDefinition[] = [
  { id: "vwap", name: "Session VWAP", aliases: "volume weighted average price", kind: "vwap", category: "Trend", description: "Cumulative price weighted by observed volume; resets by the chart session policy.", display: "Overlay", color: "#e5ad57" },
  { id: "ema20", name: "EMA 20", aliases: "exponential moving average", kind: "ema", category: "Trend", description: "An exponential average of closing prices, weighted toward recent bars.", display: "Overlay", period: 20, color: "#8fa5df" },
  { id: "ema50", name: "EMA 50", aliases: "exponential moving average", kind: "ema", category: "Trend", description: "A longer exponential average for observing price structure.", display: "Overlay", period: 50, color: "#b39ce4" },
  { id: "sma20", name: "Simple moving average", aliases: "sma ma", kind: "sma", category: "Trend", description: "The arithmetic mean of closing prices over a rolling window.", display: "Overlay", period: 20, color: "#c89c77" },
  { id: "wma20", name: "Weighted moving average", aliases: "wma linear", kind: "wma", category: "Trend", description: "A rolling average with linearly increasing weights on recent closes.", display: "Overlay", period: 20, color: "#82bcc7" },
  { id: "vwma20", name: "Volume-weighted moving average", aliases: "vwma rolling", kind: "vwma", category: "Trend", description: "Closing prices weighted by bar volume over a rolling window.", display: "Overlay", period: 20, color: "#c891b0" },
  { id: "bollinger20", name: "Bollinger Bands", aliases: "bb standard deviation bands", kind: "bollinger", category: "Volatility", description: "A simple moving average with bands defined by rolling standard deviation.", display: "Overlay", period: 20, multiplier: 2, color: "#bba6df" },
  { id: "donchian20", name: "Donchian Channels", aliases: "breakout highest lowest channel", kind: "donchian", category: "Volatility", description: "The highest high and lowest low over a rolling window.", display: "Overlay", period: 20, color: "#85bbbc" },
  { id: "volume", name: "Volume", aliases: "vol histogram", kind: "volume", category: "Volume", description: "Observed exchange-reported volume for each bar.", display: "Pane", color: "#98a4ba" },
  { id: "profile", name: "Volume Profile", aliases: "vp poc value area", kind: "profile", category: "Volume", description: "OHLCV-based price distribution estimate; not exchange trade-level volume at price.", display: "Overlay", color: "#b599d4" },
];
function distance(a: string, b: string) {
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 0; i < a.length; i++) { const next = [i + 1]; for (let j = 0; j < b.length; j++) next[j + 1] = Math.min(next[j] + 1, row[j + 1] + 1, row[j] + (a[i] === b[j] ? 0 : 1)); row = next; }
  return row[b.length];
}
export function searchIndicators(query: string): IndicatorDefinition[] {
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean).slice(0, 12);
  return INDICATOR_LIBRARY.map(item => {
    const text = `${item.name} ${item.aliases} ${item.category}`.toLowerCase();
    const tokens = text.split(/[^a-z0-9]+/);
    const scores = words.map(word => text.includes(word) ? 0 : word.length > 3 && tokens.some(token => distance(word.slice(0, 60), token) <= 2) ? 1 : 100);
    return { item, score: scores.reduce<number>((a, b) => a + b, 0) };
  }).filter(entry => entry.score < 100).sort((a, b) => a.score - b.score).map(entry => entry.item);
}
export function validateStudy(study: IndicatorInstance) {
  if (!INDICATOR_LIBRARY.some(p => p.kind === study.kind)) throw new Error("Unsupported indicator calculation.");
  if (!["vwap", "volume", "profile"].includes(study.kind) && (!Number.isInteger(study.period) || study.period! < 1 || study.period! > 1000)) throw new Error("Length must be a whole number from 1 to 1,000.");
  if (study.kind === "bollinger" && (!Number.isFinite(study.multiplier) || study.multiplier! < .1 || study.multiplier! > 10)) throw new Error("Standard deviations must be between 0.1 and 10.");
  if (!/^#[0-9a-f]{6}$/i.test(study.color) || !study.name.trim() || study.name.length > 80) throw new Error("Use a name up to 80 characters and a valid color.");
}
export function createStudy(presetId: string, id: string = crypto.randomUUID()): IndicatorInstance {
  const preset = INDICATOR_LIBRARY.find(p => p.id === presetId);
  if (!preset) throw new Error("Unsupported indicator.");
  return { id, presetId, name: preset.name, kind: preset.kind, period: preset.period, multiplier: preset.multiplier, color: preset.color, visible: true, source: "native" };
}
