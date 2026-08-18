export type MarketBar = { t: number; o: number; h: number; l: number; c: number; v: number };

export type FeatureId = "vwap" | "ema20" | "ema50" | "volumeProfile" | "structure";
export type FeatureAvailability = "AVAILABLE" | "UNAVAILABLE";

export type FeatureDefinition = {
  id: FeatureId;
  version: string;
  label: string;
  requiredInput: "OHLCV";
  timeframePolicy: "loaded-window";
  missingDataPolicy: "unavailable";
  sourceNote: string;
};

export const FEATURE_REGISTRY: Record<FeatureId, FeatureDefinition> = {
  vwap: { id: "vwap", version: "1.0.0", label: "VWAP", requiredInput: "OHLCV", timeframePolicy: "loaded-window", missingDataPolicy: "unavailable", sourceNote: "Candle-volume weighted typical price across the loaded verified window." },
  ema20: { id: "ema20", version: "1.0.0", label: "EMA 20", requiredInput: "OHLCV", timeframePolicy: "loaded-window", missingDataPolicy: "unavailable", sourceNote: "Exponential moving average of verified candle closes over the loaded window." },
  ema50: { id: "ema50", version: "1.0.0", label: "EMA 50", requiredInput: "OHLCV", timeframePolicy: "loaded-window", missingDataPolicy: "unavailable", sourceNote: "Exponential moving average of verified candle closes over the loaded window." },
  volumeProfile: { id: "volumeProfile", version: "1.0.0", label: "Volume profile", requiredInput: "OHLCV", timeframePolicy: "loaded-window", missingDataPolicy: "unavailable", sourceNote: "Candle-volume distribution by closing-price bin; not tick-level volume-at-price." },
  structure: { id: "structure", version: "1.0.0", label: "Loaded-window structure", requiredInput: "OHLCV", timeframePolicy: "loaded-window", missingDataPolicy: "unavailable", sourceNote: "High, low, and midpoint of the loaded verified candle window; not predictive." },
};

export type VolumeProfileBin = { low: number; high: number; midpoint: number; volume: number };
export type VolumeProfile = { bins: VolumeProfileBin[]; pointOfControl: number | null; valueAreaHigh: number | null; valueAreaLow: number | null; valueAreaVolumePct: number };
export type EvaluatedFeatures = {
  vwap: number | null;
  ema20: number | null;
  ema50: number | null;
  high: number | null;
  low: number | null;
  midpoint: number | null;
  volumeProfile: VolumeProfile | null;
  fingerprint: string | null;
};

function validBars(bars: MarketBar[]) {
  return bars.filter((bar) => Number.isFinite(bar.t) && [bar.o, bar.h, bar.l, bar.c, bar.v].every(Number.isFinite) && bar.h >= Math.max(bar.o, bar.c) && bar.l <= Math.min(bar.o, bar.c) && bar.v >= 0);
}

export function calculateEmaSeries(bars: MarketBar[], period: number): number[] {
  const values = validBars(bars);
  if (!values.length || !Number.isInteger(period) || period < 1) return [];
  const multiplier = 2 / (period + 1);
  return values.reduce<number[]>((series, bar, index) => {
    series.push(index === 0 ? bar.c : (bar.c - series[index - 1]) * multiplier + series[index - 1]);
    return series;
  }, []);
}

export function calculateEma(bars: MarketBar[], period: number): number | null {
  return calculateEmaSeries(bars, period).at(-1) ?? null;
}

export function calculateVwapSeries(bars: MarketBar[]): number[] {
  const values = validBars(bars);
  let priceVolume = 0;
  let volume = 0;
  return values.map((bar) => {
    priceVolume += ((bar.h + bar.l + bar.c) / 3) * bar.v;
    volume += bar.v;
    return volume > 0 ? priceVolume / volume : bar.c;
  });
}

export function calculateVwap(bars: MarketBar[]): number | null {
  return calculateVwapSeries(bars).at(-1) ?? null;
}

export function calculateVolumeProfile(bars: MarketBar[], binCount = 24, valueAreaVolumePct = 0.7): VolumeProfile | null {
  const values = validBars(bars);
  if (!values.length || !Number.isInteger(binCount) || binCount < 2 || valueAreaVolumePct <= 0 || valueAreaVolumePct > 1) return null;
  const high = Math.max(...values.map((bar) => bar.h));
  const low = Math.min(...values.map((bar) => bar.l));
  const range = high - low;
  if (range <= 0) return null;
  const width = range / binCount;
  const bins = Array.from({ length: binCount }, (_, index) => ({ low: low + index * width, high: low + (index + 1) * width, midpoint: low + (index + 0.5) * width, volume: 0 }));
  for (const bar of values) {
    const index = Math.max(0, Math.min(binCount - 1, Math.floor((bar.c - low) / width)));
    bins[index].volume += bar.v;
  }
  const totalVolume = bins.reduce((total, bin) => total + bin.volume, 0);
  if (totalVolume <= 0) return { bins, pointOfControl: null, valueAreaHigh: null, valueAreaLow: null, valueAreaVolumePct };
  const pointOfControlBin = bins.reduce((best, bin) => bin.volume > best.volume ? bin : best, bins[0]);
  let accepted = 0;
  const selected = [...bins].sort((a, b) => b.volume - a.volume || a.midpoint - b.midpoint).filter((bin) => {
    if (accepted >= totalVolume * valueAreaVolumePct) return false;
    accepted += bin.volume;
    return true;
  });
  return {
    bins,
    pointOfControl: pointOfControlBin.midpoint,
    valueAreaHigh: Math.max(...selected.map((bin) => bin.high)),
    valueAreaLow: Math.min(...selected.map((bin) => bin.low)),
    valueAreaVolumePct,
  };
}

export function featureFingerprint(bars: MarketBar[]) {
  const values = validBars(bars);
  if (!values.length) return null;
  const payload = values.map((bar) => `${bar.t}:${bar.o}:${bar.h}:${bar.l}:${bar.c}:${bar.v}`).join("|");
  let hash = 2_166_136_261;
  for (let index = 0; index < payload.length; index += 1) {
    hash ^= payload.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function evaluateFeatures(bars: MarketBar[]): EvaluatedFeatures {
  const values = validBars(bars);
  if (!values.length) return { vwap: null, ema20: null, ema50: null, high: null, low: null, midpoint: null, volumeProfile: null, fingerprint: null };
  const high = Math.max(...values.map((bar) => bar.h));
  const low = Math.min(...values.map((bar) => bar.l));
  return {
    vwap: calculateVwap(values),
    ema20: calculateEma(values, 20),
    ema50: calculateEma(values, 50),
    high,
    low,
    midpoint: (high + low) / 2,
    volumeProfile: calculateVolumeProfile(values),
    fingerprint: featureFingerprint(values),
  };
}
