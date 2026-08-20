import type { ProviderInterval } from "./terminalWorkspace";

export const RANGE_PRESETS = ["1D", "5D", "1M", "3M", "6M", "YTD", "1Y", "MAX"] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number];

const INTERVAL_MS: Record<ProviderInterval, number> = {
  "1m": 60_000,
  "5m": 5 * 60_000,
  "15m": 15 * 60_000,
  "30m": 30 * 60_000,
  "1h": 60 * 60_000,
  "4h": 4 * 60 * 60_000,
  "1d": 24 * 60 * 60_000,
};
const RANGE_MS: Record<Exclude<RangePreset, "YTD" | "MAX">, number> = {
  "1D": 24 * 60 * 60_000,
  "5D": 5 * 24 * 60 * 60_000,
  "1M": 30 * 24 * 60 * 60_000,
  "3M": 90 * 24 * 60 * 60_000,
  "6M": 183 * 24 * 60 * 60_000,
  "1Y": 365 * 24 * 60 * 60_000,
};

export const MAX_VERIFIED_HISTORY_BARS = 2_000;

export type HistoricalWindow = { label: RangePreset; from: number; to: number; requestedBars: number; requiredBars: number; bounded: true };

/** MAX is deliberately bounded by the provider request cap; it is not all-history. */
export function resolveHistoricalWindow(preset: RangePreset, interval: ProviderInterval, now = Date.now(), maxBars = MAX_VERIFIED_HISTORY_BARS): HistoricalWindow {
  const to = Math.floor(now / 1_000) * 1_000;
  const intervalMs = INTERVAL_MS[interval];
  let from: number;
  if (preset === "MAX") from = to - intervalMs * Math.max(1, maxBars - 1);
  else if (preset === "YTD") from = Date.UTC(new Date(to).getUTCFullYear(), 0, 1);
  else from = to - RANGE_MS[preset];
  const alignedFrom = Math.floor(from / intervalMs) * intervalMs;
  const alignedTo = Math.floor(to / intervalMs) * intervalMs;
  const requiredBars = Math.max(2, Math.floor((alignedTo - alignedFrom) / intervalMs) + 1);
  return { label: preset, from: alignedFrom, to: alignedTo, requestedBars: Math.min(maxBars, requiredBars), requiredBars, bounded: true };
}
