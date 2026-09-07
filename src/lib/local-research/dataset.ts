import type { Bar } from "@/lib/market/types";
import { TIMEFRAME_SECONDS } from "@/lib/market/types";
import type { ResearchConfig } from "./contracts";

export function intervalMs(timeframe: string): number {
  const seconds = TIMEFRAME_SECONDS[timeframe as keyof typeof TIMEFRAME_SECONDS];
  if (!seconds) throw new Error("Unsupported timeframe.");
  return seconds * 1000;
}

/** Range is [from, to): every candle must be closed and present exactly once. */
export function validateDataset(bars: Bar[], config: Pick<ResearchConfig, "from" | "to" | "timeframe">, now = Date.now()): Bar[] {
  const interval = intervalMs(config.timeframe);
  if (!Number.isSafeInteger(config.from) || !Number.isSafeInteger(config.to) || config.from >= config.to || config.from % interval || config.to % interval) {
    throw new Error("Select an ordered date range aligned to the timeframe.");
  }
  if (config.to > Math.floor(now / interval) * interval) throw new Error("The requested range includes an unfinished candle.");
  const expected = (config.to - config.from) / interval;
  if (expected > 100_000) throw new Error("Limit the request to 100,000 candles or use a larger timeframe.");
  const sorted = [...bars].sort((a, b) => a.t - b.t);
  if (sorted.length !== expected) throw new Error(`Incomplete history: received ${sorted.length.toLocaleString()} of ${expected.toLocaleString()} candles. Adjust the range explicitly.`);
  for (let i = 0; i < sorted.length; i++) {
    const bar = sorted[i];
    if (bar.t !== config.from + i * interval) throw new Error(`History contains a gap or duplicate near ${new Date(config.from + i * interval).toISOString()}.`);
    if (![bar.o, bar.h, bar.l, bar.c, bar.v].every(Number.isFinite) || Math.min(bar.o, bar.h, bar.l, bar.c) <= 0 || bar.v < 0 || bar.h < Math.max(bar.o, bar.c) || bar.l > Math.min(bar.o, bar.c) || bar.h < bar.l) {
      throw new Error(`Invalid OHLCV candle at ${new Date(bar.t).toISOString()}.`);
    }
  }
  return sorted;
}

export function validateConfig(config: ResearchConfig) {
  if (![config.initialCapital, config.feeBps, config.slippageBps, config.allocation, config.multiplier, config.quantityStep].every(Number.isFinite)) throw new Error("Configuration values must be finite numbers.");
  if (config.initialCapital <= 0 || config.initialCapital > 1e12) throw new Error("Starting capital must be between zero and one trillion.");
  if (config.feeBps < 0 || config.feeBps > 1000 || config.slippageBps < 0 || config.slippageBps > 1000) throw new Error("Fees and slippage must be between 0 and 1,000 basis points.");
  if (config.allocation <= 0 || config.allocation > 1 || config.multiplier <= 0 || config.quantityStep <= 0) throw new Error("Sizing must be positive and allocation cannot exceed 100%.");
  if (!["gateio", "binance"].includes(config.provider) || !["long", "both"].includes(config.direction)) throw new Error("Unsupported provider or direction.");
  intervalMs(config.timeframe);
}

export async function sha256(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, "0")).join("");
}
