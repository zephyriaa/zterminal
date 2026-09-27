export interface BootstrapSummary {
  samples: number;
  confidenceLevel: number;
  mean: number;
  lower: number;
  upper: number;
}

export interface MonteCarloSummary {
  paths: number;
  terminalEquity: { lower: number; median: number; upper: number };
  maxDrawdown: { lower: number; median: number; upper: number };
}

export interface FullMonteCarloResult {
  method: "trade_order_permutation" | "iid_trade_resampling";
  seed: number;
  paths: number;
  observations: number;
  terminalEquity: { p05: number; p50: number; p95: number };
  maxDrawdownPct: { p05: number; p50: number; p95: number };
  probabilityOfLoss: number;
  probabilityOfRuin: number;
  samplePaths: number[][];
}

export interface WalkForwardWindow {
  index: number;
  inSample: { from: number; to: number };
  outOfSample: { from: number; to: number };
}

/** Deterministic local PRNG (32-bit Mulberry32). The seed must be persisted with every validation artifact. */
export function mulberry32(seed: number) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function assertReturns(returns: readonly number[]) {
  if (!returns.length) throw new Error("At least one return is required.");
  if (!returns.every(Number.isFinite)) throw new Error("Returns must be finite numbers.");
}

function mean(values: readonly number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function percentile(sorted: readonly number[], fraction: number): number {
  if (!sorted.length) return Number.NaN;
  const position = Math.min(sorted.length - 1, Math.max(0, fraction * (sorted.length - 1)));
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

export function bootstrapMean(
  returns: readonly number[],
  options: { samples: number; confidenceLevel: number; seed: number },
): BootstrapSummary {
  assertReturns(returns);
  const { samples, confidenceLevel, seed } = options;
  if (!Number.isInteger(samples) || samples < 10) throw new Error("Bootstrap samples must be an integer of at least ten.");
  if (!(confidenceLevel > 0 && confidenceLevel < 1)) throw new Error("Confidence level must be in (0, 1).");
  const rng = mulberry32(seed);
  const sampleMeans = Array.from({ length: samples }, () => {
    const resample = Array.from({ length: returns.length }, () => returns[Math.floor(rng() * returns.length)]);
    return mean(resample);
  }).sort((left, right) => left - right);
  const alpha = (1 - confidenceLevel) / 2;
  return {
    samples,
    confidenceLevel,
    mean: mean(returns),
    lower: percentile(sampleMeans, alpha),
    upper: percentile(sampleMeans, 1 - alpha),
  };
}

/**
 * Permutes observed trade returns without manufacturing new outcomes. This models path dependency,
 * not market forecasting. The results must be presented as a distribution under these assumptions.
 */
export function simulateTradeSequence(
  tradeReturns: readonly number[],
  options: { paths: number; initialEquity: number; seed: number },
): MonteCarloSummary {
  assertReturns(tradeReturns);
  const { paths, initialEquity, seed } = options;
  if (!Number.isInteger(paths) || paths < 10) throw new Error("Monte Carlo paths must be an integer of at least ten.");
  if (!Number.isFinite(initialEquity) || initialEquity <= 0) throw new Error("Initial equity must be positive.");
  const rng = mulberry32(seed);
  const terminalEquities: number[] = [];
  const maxDrawdowns: number[] = [];
  for (let path = 0; path < paths; path += 1) {
    const returns = [...tradeReturns];
    for (let index = returns.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(rng() * (index + 1));
      [returns[index], returns[swapIndex]] = [returns[swapIndex], returns[index]];
    }
    let equity = initialEquity;
    let peak = equity;
    let maximumDrawdown = 0;
    for (const tradeReturn of returns) {
      equity += tradeReturn;
      peak = Math.max(peak, equity);
      maximumDrawdown = Math.max(maximumDrawdown, peak - equity);
    }
    terminalEquities.push(equity);
    maxDrawdowns.push(maximumDrawdown);
  }
  terminalEquities.sort((left, right) => left - right);
  maxDrawdowns.sort((left, right) => left - right);
  return {
    paths,
    terminalEquity: {
      lower: percentile(terminalEquities, 0.05),
      median: percentile(terminalEquities, 0.5),
      upper: percentile(terminalEquities, 0.95),
    },
    maxDrawdown: {
      lower: percentile(maxDrawdowns, 0.05),
      median: percentile(maxDrawdowns, 0.5),
      upper: percentile(maxDrawdowns, 0.95),
    },
  };
}

/**
 * Full Monte Carlo simulation supporting trade-order permutation (reordering without replacement)
 * and IID bootstrap resampling (with replacement). Produces percentiles, ruin probability, and downsampled curves.
 */
export function runMonteCarloValidation(
  tradeReturns: readonly number[],
  options: {
    paths: number;
    initialEquity: number;
    seed: number;
    method?: "trade_order_permutation" | "iid_trade_resampling";
  },
): FullMonteCarloResult {
  assertReturns(tradeReturns);
  const { paths, initialEquity, seed, method = "trade_order_permutation" } = options;
  if (!Number.isInteger(paths) || paths < 10) throw new Error("Monte Carlo paths must be an integer of at least ten.");
  if (!Number.isFinite(initialEquity) || initialEquity <= 0) throw new Error("Initial equity must be positive.");

  const rng = mulberry32(seed);
  const terminalEquities: number[] = [];
  const maxDrawdownPcts: number[] = [];
  const rawSampleCurves: number[][] = [];
  const maxSampleCurvesToKeep = Math.min(20, paths);

  let lossCount = 0;
  let ruinCount = 0; // Max drawdown >= 50%

  for (let path = 0; path < paths; path += 1) {
    let sequence: number[];
    if (method === "trade_order_permutation") {
      sequence = [...tradeReturns];
      for (let index = sequence.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(rng() * (index + 1));
        [sequence[index], sequence[swapIndex]] = [sequence[swapIndex], sequence[index]];
      }
    } else {
      // iid_trade_resampling with replacement
      sequence = Array.from({ length: tradeReturns.length }, () => tradeReturns[Math.floor(rng() * tradeReturns.length)]);
    }

    let equity = initialEquity;
    let peak = equity;
    let maxDDPct = 0;
    const curve: number[] = [initialEquity];

    for (const tradePnl of sequence) {
      equity += tradePnl;
      if (equity > peak) peak = equity;
      const dd = peak > 0 ? (peak - equity) / peak : 0;
      if (dd > maxDDPct) maxDDPct = dd;
      curve.push(equity);
    }

    terminalEquities.push(equity);
    maxDrawdownPcts.push(maxDDPct);

    if (equity < initialEquity) lossCount += 1;
    if (maxDDPct >= 0.50) ruinCount += 1;

    if (rawSampleCurves.length < maxSampleCurvesToKeep) {
      rawSampleCurves.push(curve);
    }
  }

  terminalEquities.sort((a, b) => a - b);
  maxDrawdownPcts.sort((a, b) => a - b);

  // Downsample rawSampleCurves to at most 50 steps each for compact storage and UI rendering
  const samplePaths = rawSampleCurves.map((curve) => {
    if (curve.length <= 50) return curve;
    const step = (curve.length - 1) / 49;
    const sampled: number[] = [];
    for (let i = 0; i < 50; i += 1) {
      const idx = Math.min(curve.length - 1, Math.round(i * step));
      sampled.push(curve[idx]);
    }
    return sampled;
  });

  return {
    method,
    seed,
    paths,
    observations: tradeReturns.length,
    terminalEquity: {
      p05: Math.round(percentile(terminalEquities, 0.05) * 100) / 100,
      p50: Math.round(percentile(terminalEquities, 0.50) * 100) / 100,
      p95: Math.round(percentile(terminalEquities, 0.95) * 100) / 100,
    },
    maxDrawdownPct: {
      p05: Math.round(percentile(maxDrawdownPcts, 0.05) * 1000) / 1000,
      p50: Math.round(percentile(maxDrawdownPcts, 0.50) * 1000) / 1000,
      p95: Math.round(percentile(maxDrawdownPcts, 0.95) * 1000) / 1000,
    },
    probabilityOfLoss: Math.round((lossCount / paths) * 1000) / 1000,
    probabilityOfRuin: Math.round((ruinCount / paths) * 1000) / 1000,
    samplePaths,
  };
}

/**
 * Builds non-overlapping rolling windows. `purge` creates a deliberate temporal gap so
 * in-sample information cannot directly touch the out-of-sample period.
 */
export function createWalkForwardWindows(
  totalObservations: number,
  options: { inSample: number; outOfSample: number; step: number; purge?: number },
): WalkForwardWindow[] {
  const { inSample, outOfSample, step, purge = 0 } = options;
  if (![totalObservations, inSample, outOfSample, step, purge].every(Number.isInteger)) {
    throw new Error("Walk-forward configuration values must be integers.");
  }
  if (totalObservations < 1 || inSample < 1 || outOfSample < 1 || step < 1 || purge < 0) {
    throw new Error("Walk-forward configuration values are out of range.");
  }
  const windows: WalkForwardWindow[] = [];
  for (let start = 0, index = 0; start + inSample + purge + outOfSample <= totalObservations; start += step, index += 1) {
    const inSampleEnd = start + inSample;
    const outOfSampleStart = inSampleEnd + purge;
    windows.push({
      index,
      inSample: { from: start, to: inSampleEnd },
      outOfSample: { from: outOfSampleStart, to: outOfSampleStart + outOfSample },
    });
  }
  return windows;
}
