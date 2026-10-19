import type { Bar } from "@/lib/market/types";
import { TIMEFRAME_SECONDS } from "@/lib/market/types";
import type { Dataset, ResearchConfig } from "./contracts";

export function intervalMs(timeframe: string): number {
  const seconds = TIMEFRAME_SECONDS[timeframe as keyof typeof TIMEFRAME_SECONDS];
  if (!seconds) throw new Error("Unsupported timeframe.");
  return seconds * 1000;
}

/** Range is [from, to): every candle must be closed and present exactly once. */
export function validateDataset(bars: Bar[], config: Pick<ResearchConfig, "from" | "to" | "timeframe">, now = Date.now()): Bar[] {
  const interval = intervalMs(config.timeframe);
  if (!Number.isSafeInteger(config.from) || !Number.isSafeInteger(config.to) || config.from < 0 || config.from >= config.to || config.from % interval || config.to % interval) {
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
  if (config.executionModel === "synthetic_next_open_v2") {
    for (const key of ["tickSize", "minimumQuantity", "minimumNotional", "spreadBps"] as const) {
      const value = config[key];
      if (typeof value !== "number" || !Number.isFinite(value) || value < 0) throw new Error(`Missing or invalid ${key}. Verify instrument metadata.`);
    }
    if (!config.tickSize || !config.minimumQuantity || config.spreadBps! > 1000) throw new Error("Invalid precision, minimum quantity or spread.");
    if (!Number.isInteger(config.warmupBars) || config.warmupBars! < 0 || config.warmupBars! > 10000 || !Number.isInteger(config.executionDelayBars) || config.executionDelayBars! < 1 || config.executionDelayBars! > 100) throw new Error("Warm-up must be 0–10000 bars and execution delay 1–100 bars.");
  }
  if (![config.initialCapital, config.feeBps, config.slippageBps, config.allocation, config.multiplier, config.quantityStep].every(Number.isFinite)) throw new Error("Configuration values must be finite numbers.");
  if (config.initialCapital <= 0 || config.initialCapital > 1e12) throw new Error("Starting capital must be between zero and one trillion.");
  if (config.feeBps < 0 || config.feeBps > 1000 || config.slippageBps < 0 || config.slippageBps > 1000) throw new Error("Fees and slippage must be between 0 and 1,000 basis points.");
  if (config.allocation <= 0 || config.allocation > 1 || config.multiplier <= 0 || config.quantityStep <= 0) throw new Error("Sizing must be positive and allocation cannot exceed 100%.");
  if (!["gateio", "binance"].includes(config.provider) || !["long", "both"].includes(config.direction)) throw new Error("Unsupported provider or direction.");
  intervalMs(config.timeframe);
}

/** Cached and downloaded envelopes must describe the captured run, without relabelling it. */
export async function validateResearchDataset(value: unknown, config: Pick<ResearchConfig, "provider" | "symbol" | "timeframe" | "from" | "to">, now = Date.now()): Promise<Dataset> {
  const dataset = value as Dataset | null;
  if (!dataset || dataset.version !== 1 || dataset.product !== "perpetual" || (["provider", "symbol", "timeframe", "from", "to"] as const).some(key => dataset[key] !== config[key])) throw new Error("Dataset manifest does not match the captured run configuration.");
  if (!Array.isArray(dataset.bars) || dataset.bars.length < 2 || dataset.bars.some(bar => !bar || typeof bar !== "object")) throw new Error("Dataset must contain at least two valid closed candles.");
  const ordered = validateDataset(dataset.bars, config, now);
  if (dataset.bars.some((bar, index) => bar.t !== ordered[index].t)) throw new Error("Dataset candles must be ordered; the retained hash cannot be silently changed.");
  if (dataset.retrievedAt !== undefined && (!Number.isSafeInteger(dataset.retrievedAt) || dataset.retrievedAt < config.to || dataset.retrievedAt > now + 60_000)) throw new Error("Invalid dataset retrieval timestamp.");
  if (typeof dataset.hash !== "string" || !/^[a-f0-9]{64}$/.test(dataset.hash) || dataset.hash !== await sha256(JSON.stringify(dataset.bars.map(b => [b.t, b.o, b.h, b.l, b.c, b.v])))) throw new Error("Dataset candle hash does not match its retained contents.");
  return dataset;
}

export async function sha256(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, "0")).join("");
}
