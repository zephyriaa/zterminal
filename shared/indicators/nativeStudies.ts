export type NativeStudyCategory = "Trend" | "Momentum" | "Volatility" | "Volume" | "Price / Range" | "Order Flow";
export type NativeStudyId =
  | "sma" | "ema" | "wma" | "vwap" | "rolling_channel"
  | "rsi" | "macd" | "stochastic" | "roc"
  | "atr" | "bollinger" | "stddev"
  | "volume" | "volume_ma" | "session_range"
  | "volume_delta" | "cumulative_volume_delta";

export type NativeStudyDataContract = "LOADED_VERIFIED_OHLCV" | "LIVE_VENUE_TAPE" | "VERIFIED_INTRABAR";
export type NativeStudyPane = "overlay" | "pane" | "volume";
export type NativeStudySeriesKind = "line" | "histogram";

export type StudyBar = { t: number; o: number; h: number; l: number; c: number; v: number };
export type NativeStudyConfig = { id: NativeStudyId; inputs?: Record<string, number> };
export type NativeStudyDescriptor = {
  id: NativeStudyId;
  label: string;
  shortLabel: string;
  category: NativeStudyCategory;
  description: string;
  pane: NativeStudyPane;
  dataContract: NativeStudyDataContract;
  warmup: string;
  defaultInputs: Record<string, number>;
  dataGate?: string;
};
export type NativeStudyPoint = { t: number; value: number; color?: string };
export type NativeStudySeries = { id: string; label: string; pane: NativeStudyPane; kind: NativeStudySeriesKind; color: string; points: NativeStudyPoint[] };
export type NativeStudyEvaluation =
  | { status: "COMPLETED"; study: NativeStudyDescriptor; series: NativeStudySeries[]; evidence: { inputContract: "LOADED_VERIFIED_OHLCV"; lookahead: "NOT_PERMITTED"; barCount: number } }
  | { status: "UNAVAILABLE"; study: NativeStudyDescriptor; reason: string; series: [] };

const COLORS = { teal: "#22c7c3", violet: "#9f7aea", blue: "#5d8cff", amber: "#f3b35c", rose: "#ef6c92", up: "#26a69a", down: "#ef5350", slate: "#98a2bd" } as const;

export const NATIVE_STUDY_CATALOG: readonly NativeStudyDescriptor[] = [
  { id: "sma", label: "Moving Average Simple", shortLabel: "SMA", category: "Trend", description: "Rolling arithmetic average of close.", pane: "overlay", dataContract: "LOADED_VERIFIED_OHLCV", warmup: "Selected length", defaultInputs: { length: 20 } },
  { id: "ema", label: "Moving Average Exponential", shortLabel: "EMA", category: "Trend", description: "Exponentially weighted close average from the loaded window.", pane: "overlay", dataContract: "LOADED_VERIFIED_OHLCV", warmup: "Recursive from loaded-window start", defaultInputs: { length: 20 } },
  { id: "wma", label: "Moving Average Weighted", shortLabel: "WMA", category: "Trend", description: "Linearly weighted rolling close average.", pane: "overlay", dataContract: "LOADED_VERIFIED_OHLCV", warmup: "Selected length", defaultInputs: { length: 20 } },
  { id: "vwap", label: "Volume Weighted Average Price", shortLabel: "VWAP", category: "Trend", description: "Loaded-window VWAP using verified candle volume.", pane: "overlay", dataContract: "LOADED_VERIFIED_OHLCV", warmup: "Loaded-window cumulative", defaultInputs: {} },
  { id: "rolling_channel", label: "Rolling High-Low Channel", shortLabel: "Channel", category: "Trend", description: "Highest high and lowest low across a bounded rolling lookback.", pane: "overlay", dataContract: "LOADED_VERIFIED_OHLCV", warmup: "Selected length", defaultInputs: { length: 20 } },
  { id: "rsi", label: "Relative Strength Index", shortLabel: "RSI", category: "Momentum", description: "Loaded-window close-to-close gain/loss oscillator.", pane: "pane", dataContract: "LOADED_VERIFIED_OHLCV", warmup: "At least two bars", defaultInputs: { length: 14 } },
  { id: "macd", label: "MACD", shortLabel: "MACD", category: "Momentum", description: "MACD line, signal line, and histogram from the verified close series.", pane: "pane", dataContract: "LOADED_VERIFIED_OHLCV", warmup: "Slow length plus signal length", defaultInputs: { fast: 12, slow: 26, signal: 9 } },
  { id: "stochastic", label: "Stochastic", shortLabel: "Stoch", category: "Momentum", description: "Close position within a rolling high-low range, with %K and %D.", pane: "pane", dataContract: "LOADED_VERIFIED_OHLCV", warmup: "Selected length", defaultInputs: { length: 14, smooth: 3 } },
  { id: "roc", label: "Rate of Change", shortLabel: "ROC", category: "Momentum", description: "Percentage change from the earliest loaded close in the selected rolling lookback.", pane: "pane", dataContract: "LOADED_VERIFIED_OHLCV", warmup: "Selected length", defaultInputs: { length: 12 } },
  { id: "atr", label: "Average True Range", shortLabel: "ATR", category: "Volatility", description: "Rolling average true range calculated from verified candles.", pane: "pane", dataContract: "LOADED_VERIFIED_OHLCV", warmup: "Selected length", defaultInputs: { length: 14 } },
  { id: "bollinger", label: "Bollinger Bands", shortLabel: "BB", category: "Volatility", description: "Basis plus and minus a bounded multiple of loaded-window standard deviation.", pane: "overlay", dataContract: "LOADED_VERIFIED_OHLCV", warmup: "Selected length", defaultInputs: { length: 20, mult: 2 } },
  { id: "stddev", label: "Standard Deviation", shortLabel: "StdDev", category: "Volatility", description: "Population standard deviation of the verified close series.", pane: "pane", dataContract: "LOADED_VERIFIED_OHLCV", warmup: "Selected length", defaultInputs: { length: 20 } },
  { id: "volume", label: "Volume", shortLabel: "Volume", category: "Volume", description: "Reported candle volume, colored by candle direction only.", pane: "volume", dataContract: "LOADED_VERIFIED_OHLCV", warmup: "None", defaultInputs: {} },
  { id: "volume_ma", label: "Volume Moving Average", shortLabel: "Vol MA", category: "Volume", description: "Rolling average of reported candle volume.", pane: "volume", dataContract: "LOADED_VERIFIED_OHLCV", warmup: "Selected length", defaultInputs: { length: 20 } },
  { id: "session_range", label: "Session Range", shortLabel: "Session", category: "Price / Range", description: "Loaded-window high, low, and midpoint price markers.", pane: "overlay", dataContract: "LOADED_VERIFIED_OHLCV", warmup: "Loaded window", defaultInputs: {} },
  { id: "volume_delta", label: "Volume Delta", shortLabel: "Vol Delta", category: "Order Flow", description: "Requires complete lower-timeframe intrabar data for every effective chart bar.", pane: "pane", dataContract: "VERIFIED_INTRABAR", warmup: "Complete requested coverage", defaultInputs: {}, dataGate: "Unavailable for this range — verified intrabar coverage required." },
  { id: "cumulative_volume_delta", label: "Cumulative Volume Delta", shortLabel: "CVD", category: "Order Flow", description: "Requires complete venue-labelled intrabar or live public-tape delta input.", pane: "pane", dataContract: "VERIFIED_INTRABAR", warmup: "Complete requested coverage", defaultInputs: {}, dataGate: "Historical CVD is withheld until complete verified intrabar coverage is available." },
] as const;

export const NATIVE_STUDY_CATEGORIES: readonly NativeStudyCategory[] = ["Trend", "Momentum", "Volatility", "Volume", "Price / Range", "Order Flow"] as const;
export const NATIVE_STUDY_IDS = NATIVE_STUDY_CATALOG.map((study) => study.id) as readonly NativeStudyId[];

export function getNativeStudy(id: NativeStudyId) {
  return NATIVE_STUDY_CATALOG.find((study) => study.id === id) ?? null;
}

function positiveInteger(value: number | undefined, fallback: number, maximum = 500) {
  const normalized = Math.floor(value ?? fallback);
  return Number.isFinite(normalized) ? Math.min(maximum, Math.max(1, normalized)) : fallback;
}

function boundedNumber(value: number | undefined, fallback: number, minimum: number, maximum: number) {
  const normalized = value ?? fallback;
  return Number.isFinite(normalized) ? Math.min(maximum, Math.max(minimum, normalized)) : fallback;
}

function sma(values: number[], length: number) {
  return values.map((_, index) => {
    const window = values.slice(Math.max(0, index - length + 1), index + 1);
    return window.reduce((total, value) => total + value, 0) / window.length;
  });
}

function ema(values: number[], length: number) {
  const multiplier = 2 / (length + 1);
  let previous = values[0] ?? 0;
  return values.map((value, index) => {
    previous = index === 0 ? value : (value - previous) * multiplier + previous;
    return previous;
  });
}

function wma(values: number[], length: number) {
  return values.map((_, index) => {
    const window = values.slice(Math.max(0, index - length + 1), index + 1);
    const denominator = (window.length * (window.length + 1)) / 2;
    return window.reduce((total, value, current) => total + value * (current + 1), 0) / denominator;
  });
}

function standardDeviation(values: number[], length: number) {
  return values.map((_, index) => {
    const window = values.slice(Math.max(0, index - length + 1), index + 1);
    const average = window.reduce((total, value) => total + value, 0) / window.length;
    return Math.sqrt(window.reduce((total, value) => total + (value - average) ** 2, 0) / window.length);
  });
}

function toPoints(bars: StudyBar[], values: number[], color?: string): NativeStudyPoint[] {
  return bars.flatMap((bar, index) => Number.isFinite(values[index]) ? [{ t: bar.t, value: values[index]!, ...(color ? { color } : {}) }] : []);
}

function line(id: string, label: string, pane: NativeStudyPane, color: string, bars: StudyBar[], values: number[]): NativeStudySeries {
  return { id, label, pane, kind: "line", color, points: toPoints(bars, values) };
}

function histogram(id: string, label: string, pane: NativeStudyPane, color: string, bars: StudyBar[], values: number[], colors?: string[]): NativeStudySeries {
  return { id, label, pane, kind: "histogram", color, points: bars.flatMap((bar, index) => Number.isFinite(values[index]) ? [{ t: bar.t, value: values[index]!, color: colors?.[index] ?? color }] : []) };
}

function evaluateCandleStudy(study: NativeStudyDescriptor, bars: StudyBar[], inputs: Record<string, number>): NativeStudySeries[] {
  const close = bars.map((bar) => bar.c);
  const high = bars.map((bar) => bar.h);
  const low = bars.map((bar) => bar.l);
  const volume = bars.map((bar) => bar.v);
  const length = positiveInteger(inputs.length, study.defaultInputs.length ?? 14);

  switch (study.id) {
    case "sma": return [line("sma", "SMA", "overlay", COLORS.teal, bars, sma(close, length))];
    case "ema": return [line("ema", "EMA", "overlay", COLORS.violet, bars, ema(close, length))];
    case "wma": return [line("wma", "WMA", "overlay", COLORS.blue, bars, wma(close, length))];
    case "vwap": {
      let numerator = 0; let denominator = 0;
      const values = bars.map((bar) => { numerator += ((bar.h + bar.l + bar.c) / 3) * bar.v; denominator += bar.v; return denominator ? numerator / denominator : bar.c; });
      return [line("vwap", "VWAP", "overlay", COLORS.teal, bars, values)];
    }
    case "rolling_channel": {
      const upper = high.map((_, index) => Math.max(...high.slice(Math.max(0, index - length + 1), index + 1)));
      const lower = low.map((_, index) => Math.min(...low.slice(Math.max(0, index - length + 1), index + 1)));
      return [line("channel-high", "Channel high", "overlay", COLORS.blue, bars, upper), line("channel-low", "Channel low", "overlay", COLORS.violet, bars, lower)];
    }
    case "rsi": {
      const values = close.map((_, index) => {
        const start = Math.max(1, index - length + 1); let gains = 0; let losses = 0;
        for (let cursor = start; cursor <= index; cursor += 1) { const change = close[cursor]! - close[cursor - 1]!; if (change >= 0) gains += change; else losses += Math.abs(change); }
        if (index === 0) return 50; if (losses === 0) return 100; return 100 - 100 / (1 + gains / losses);
      });
      return [line("rsi", "RSI", "pane", COLORS.violet, bars, values)];
    }
    case "macd": {
      const fast = positiveInteger(inputs.fast, study.defaultInputs.fast); const slow = positiveInteger(inputs.slow, study.defaultInputs.slow); const signalLength = positiveInteger(inputs.signal, study.defaultInputs.signal);
      const macd = ema(close, fast).map((value, index) => value - ema(close, slow)[index]!);
      const signal = ema(macd, signalLength); const histogramValues = macd.map((value, index) => value - signal[index]!);
      return [line("macd", "MACD", "pane", COLORS.teal, bars, macd), line("macd-signal", "Signal", "pane", COLORS.amber, bars, signal), histogram("macd-histogram", "Histogram", "pane", COLORS.slate, bars, histogramValues, histogramValues.map(value => value >= 0 ? "rgba(38,166,154,.68)" : "rgba(239,83,80,.68)"))];
    }
    case "stochastic": {
      const k = close.map((value, index) => { const start = Math.max(0, index - length + 1); const hi = Math.max(...high.slice(start, index + 1)); const lo = Math.min(...low.slice(start, index + 1)); return hi === lo ? 50 : ((value - lo) / (hi - lo)) * 100; });
      const d = sma(k, positiveInteger(inputs.smooth, study.defaultInputs.smooth));
      return [line("stoch-k", "%K", "pane", COLORS.blue, bars, k), line("stoch-d", "%D", "pane", COLORS.amber, bars, d)];
    }
    case "roc": return [line("roc", "ROC", "pane", COLORS.teal, bars, close.map((value, index) => { const base = close[Math.max(0, index - length + 1)]!; return base === 0 ? 0 : ((value - base) / Math.abs(base)) * 100; }))];
    case "atr": return [line("atr", "ATR", "pane", COLORS.amber, bars, bars.map((bar, index) => { const values = bars.slice(Math.max(0, index - length + 1), index + 1).map((current, offset, window) => { const absoluteIndex = Math.max(0, index - length + 1) + offset; const previous = absoluteIndex ? bars[absoluteIndex - 1] : null; return previous ? Math.max(current.h - current.l, Math.abs(current.h - previous.c), Math.abs(current.l - previous.c)) : current.h - current.l; }); return values.reduce((total, value) => total + value, 0) / values.length; }))];
    case "bollinger": {
      const basis = sma(close, length); const deviation = standardDeviation(close, length); const multiplier = boundedNumber(inputs.mult, study.defaultInputs.mult, 0.1, 5);
      return [line("bb-basis", "BB basis", "overlay", COLORS.slate, bars, basis), line("bb-upper", "BB upper", "overlay", COLORS.rose, bars, basis.map((value, index) => value + multiplier * deviation[index]!)), line("bb-lower", "BB lower", "overlay", COLORS.teal, bars, basis.map((value, index) => value - multiplier * deviation[index]!))];
    }
    case "stddev": return [line("stddev", "StdDev", "pane", COLORS.rose, bars, standardDeviation(close, length))];
    case "volume": return [histogram("volume", "Volume", "volume", COLORS.slate, bars, volume, bars.map((bar) => bar.c >= bar.o ? "rgba(38,166,154,.62)" : "rgba(239,83,80,.62)"))];
    case "volume_ma": return [line("volume-ma", "Volume MA", "volume", COLORS.amber, bars, sma(volume, length))];
    case "session_range": {
      const highest = Math.max(...high); const lowest = Math.min(...low); const midpoint = (highest + lowest) / 2;
      return [line("session-high", "Window high", "overlay", COLORS.teal, bars, bars.map(() => highest)), line("session-mid", "Window midpoint", "overlay", COLORS.violet, bars, bars.map(() => midpoint)), line("session-low", "Window low", "overlay", COLORS.rose, bars, bars.map(() => lowest))];
    }
    default: return [];
  }
}

/** Evaluates only deterministic, loaded-window OHLCV studies. Intrabar-dependent studies are intentionally withheld. */
export function evaluateNativeStudy(config: NativeStudyConfig, inputBars: StudyBar[]): NativeStudyEvaluation {
  const study = getNativeStudy(config.id);
  if (!study) throw new Error(`Unknown native study '${config.id}'.`);
  const bars = inputBars.filter((bar) => Number.isFinite(bar.t) && [bar.o, bar.h, bar.l, bar.c, bar.v].every(Number.isFinite) && bar.h >= Math.max(bar.o, bar.c) && bar.l <= Math.min(bar.o, bar.c) && bar.v >= 0).sort((left, right) => left.t - right.t);
  if (study.dataContract !== "LOADED_VERIFIED_OHLCV") return { status: "UNAVAILABLE", study, reason: study.dataGate ?? "This study requires a separately verified order-flow data contract.", series: [] };
  if (!bars.length) return { status: "UNAVAILABLE", study, reason: "This study requires a loaded verified OHLCV chart window.", series: [] };
  return { status: "COMPLETED", study, series: evaluateCandleStudy(study, bars, { ...study.defaultInputs, ...config.inputs }), evidence: { inputContract: "LOADED_VERIFIED_OHLCV", lookahead: "NOT_PERMITTED", barCount: bars.length } };
}
