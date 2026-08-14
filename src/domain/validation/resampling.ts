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

export interface WalkForwardWindow {
  index: number;
  inSample: { from: number; to: number };
  outOfSample: { from: number; to: number };
}

/** Deterministic local PRNG. The seed must be persisted with every validation artifact. */
function mulberry32(seed: number) {
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

function percentile(sorted: readonly number[], fraction: number) {
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
