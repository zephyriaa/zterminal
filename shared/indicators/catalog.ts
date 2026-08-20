import type { IndicatorDraft, IndicatorInput } from "./indicatorRuntime";

export type NativeIndicatorCategory = "Trend" | "Momentum" | "Volatility" | "Price context";

export type NativeIndicatorPreset = {
  id: string;
  category: NativeIndicatorCategory;
  label: string;
  shortLabel: string;
  description: string;
  warmup: string;
  source: "ZTerminal native formula";
  attribution: string;
  draft: IndicatorDraft;
};

const length = (defaultValue: number, label = "Length"): IndicatorInput => ({ id: "length", label, defaultValue, min: 1, max: 500, step: 1 });
const color = { teal: "#4be0ce", violet: "#a984ff", blue: "#4d95ff", amber: "#f3b35c", rose: "#df7aa9", slate: "#98a2bd" } as const;

function preset(id: string, category: NativeIndicatorCategory, label: string, shortLabel: string, description: string, warmup: string, draft: IndicatorDraft): NativeIndicatorPreset {
  return { id, category, label, shortLabel, description, warmup, source: "ZTerminal native formula", attribution: "Independently authored declarative formula over loaded verified OHLCV candles.", draft };
}

export const NATIVE_INDICATOR_PRESETS: readonly NativeIndicatorPreset[] = [
  preset("sma", "Trend", "Simple Moving Average", "SMA", "Arithmetic rolling average of close.", "Up to the selected length", { name: "SMA", expression: "sma(close, length)", inputs: [length(20)], output: { pane: "overlay", color: color.teal, lineWidth: 2 } }),
  preset("ema", "Trend", "Exponential Moving Average", "EMA", "Exponentially weighted average of close.", "Recursive from the loaded window start", { name: "EMA", expression: "ema(close, length)", inputs: [length(20)], output: { pane: "overlay", color: color.violet, lineWidth: 2 } }),
  preset("wma", "Trend", "Weighted Moving Average", "WMA", "Linearly weighted rolling average of close.", "Up to the selected length", { name: "WMA", expression: "wma(close, length)", inputs: [length(20)], output: { pane: "overlay", color: color.blue, lineWidth: 2 } }),
  preset("rsi", "Momentum", "Relative Strength Index", "RSI", "Loaded-window close-to-close gain/loss oscillator.", "At least two bars; selected period uses available prior bars", { name: "RSI", expression: "rsi(close, length)", inputs: [length(14)], output: { pane: "pane", color: color.violet, lineWidth: 2 } }),
  preset("roc", "Momentum", "Rate of Change", "ROC", "Percentage change from the earliest close in the rolling lookback.", "Up to the selected length", { name: "ROC", expression: "roc(close, length)", inputs: [length(12)], output: { pane: "pane", color: color.teal, lineWidth: 2 } }),
  preset("macd", "Momentum", "MACD Line", "MACD", "Fast EMA minus slow EMA; signal and histogram remain separate native presets for a later release.", "Recursive from the loaded window start", { name: "MACD line", expression: "ema(close, fast) - ema(close, slow)", inputs: [{ id: "fast", label: "Fast length", defaultValue: 12, min: 1, max: 250, step: 1 }, { id: "slow", label: "Slow length", defaultValue: 26, min: 2, max: 500, step: 1 }], output: { pane: "pane", color: color.amber, lineWidth: 2 } }),
  preset("stochastic", "Momentum", "Stochastic %K", "Stoch %K", "Close position within the loaded rolling high-low range.", "Up to the selected length", { name: "Stochastic %K", expression: "100 * (close - lowest(low, length)) / (highest(high, length) - lowest(low, length))", inputs: [length(14)], output: { pane: "pane", color: color.blue, lineWidth: 2 } }),
  preset("atr", "Volatility", "Average True Range", "ATR", "Rolling average of true range using high, low, and previous close from loaded candles.", "Up to the selected length", { name: "ATR", expression: "atr(length)", inputs: [length(14)], output: { pane: "pane", color: color.amber, lineWidth: 2 } }),
  preset("rolling-volatility", "Volatility", "Close Standard Deviation", "StdDev", "Population standard deviation of loaded close values over the lookback.", "Up to the selected length", { name: "Close standard deviation", expression: "stdev(close, length)", inputs: [length(20)], output: { pane: "pane", color: color.rose, lineWidth: 2 } }),
  preset("bollinger-basis", "Volatility", "Bollinger Basis", "BB basis", "Simple moving-average center line used with the separately available bands.", "Up to the selected length", { name: "Bollinger basis", expression: "sma(close, length)", inputs: [length(20)], output: { pane: "overlay", color: color.slate, lineWidth: 1 } }),
  preset("bollinger-upper", "Volatility", "Bollinger Upper Band", "BB upper", "Basis plus a bounded multiple of standard deviation.", "Up to the selected length", { name: "Bollinger upper", expression: "sma(close, length) + mult * stdev(close, length)", inputs: [length(20), { id: "mult", label: "Deviation multiplier", defaultValue: 2, min: 0.1, max: 5, step: 0.1 }], output: { pane: "overlay", color: color.rose, lineWidth: 1 } }),
  preset("bollinger-lower", "Volatility", "Bollinger Lower Band", "BB lower", "Basis minus a bounded multiple of standard deviation.", "Up to the selected length", { name: "Bollinger lower", expression: "sma(close, length) - mult * stdev(close, length)", inputs: [length(20), { id: "mult", label: "Deviation multiplier", defaultValue: 2, min: 0.1, max: 5, step: 0.1 }], output: { pane: "overlay", color: color.teal, lineWidth: 1 } }),
  preset("donchian-high", "Price context", "Donchian High", "Donchian high", "Highest high in the loaded rolling range.", "Up to the selected length", { name: "Donchian high", expression: "highest(high, length)", inputs: [length(20)], output: { pane: "overlay", color: color.blue, lineWidth: 1 } }),
  preset("donchian-low", "Price context", "Donchian Low", "Donchian low", "Lowest low in the loaded rolling range.", "Up to the selected length", { name: "Donchian low", expression: "lowest(low, length)", inputs: [length(20)], output: { pane: "overlay", color: color.violet, lineWidth: 1 } }),
] as const;

export const NATIVE_INDICATOR_CATEGORIES: readonly NativeIndicatorCategory[] = ["Trend", "Momentum", "Volatility", "Price context"] as const;

export function clonePresetDraft(preset: NativeIndicatorPreset): IndicatorDraft {
  return { ...preset.draft, inputs: preset.draft.inputs.map(input => ({ ...input })), output: { ...preset.draft.output } };
}
