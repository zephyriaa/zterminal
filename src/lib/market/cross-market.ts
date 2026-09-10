import type { Bar } from "./types";

export interface CorrelationMatrix {
  symbols: string[];
  matrix: number[][]; // N x N values between -1.00 and +1.00
}

export interface BetaMetrics {
  beta: number;
  alpha: number;
  rSquared: number;
  covariance: number;
  benchmarkVariance: number;
}

export interface RelativeStrengthPoint {
  timestamp: number;
  ratio: number;
  normalized: number; // Rebased to 100 at start
}

export interface SpreadBar {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

/**
 * Calculates log returns for a series of bars: ln(close_t / close_{t-1})
 */
export function calculateReturns(bars: Bar[]): number[] {
  if (bars.length < 2) return [];
  const returns: number[] = [];
  for (let i = 1; i < bars.length; i++) {
    const prev = bars[i - 1].c;
    const curr = bars[i].c;
    returns.push(prev > 0 ? (curr - prev) / prev : 0);
  }
  return returns;
}

/**
 * Calculates Pearson Correlation Coefficient between two return series.
 */
export function pearsonCorrelation(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n < 2) return 0;

  let sumX = 0;
  let sumY = 0;
  for (let i = 0; i < n; i++) {
    sumX += x[i];
    sumY += y[i];
  }
  const meanX = sumX / n;
  const meanY = sumY / n;

  let num = 0;
  let denX = 0;
  let denY = 0;

  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }

  const denom = Math.sqrt(denX * denY);
  if (denom === 0) return 0;
  return Math.max(-1, Math.min(1, Number((num / denom).toFixed(4))));
}

/**
 * Computes an N x N correlation matrix across multiple instruments.
 */
export function computeCorrelationMatrix(
  symbols: string[],
  returnsMap: Map<string, number[]>,
): CorrelationMatrix {
  const n = symbols.length;
  const matrix: number[][] = Array.from({ length: n }, () => Array(n).fill(1));

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) {
        matrix[i][j] = 1.0;
      } else if (i < j) {
        const retA = returnsMap.get(symbols[i]) ?? [];
        const retB = returnsMap.get(symbols[j]) ?? [];
        const corr = pearsonCorrelation(retA, retB);
        matrix[i][j] = corr;
        matrix[j][i] = corr;
      }
    }
  }

  return { symbols, matrix };
}

/**
 * Computes Asset Beta, Alpha and R-Squared relative to a benchmark (e.g. BTC or SPY).
 */
export function computeBetaMetrics(
  targetReturns: number[],
  benchmarkReturns: number[],
): BetaMetrics {
  const n = Math.min(targetReturns.length, benchmarkReturns.length);
  if (n < 2) {
    return { beta: 1.0, alpha: 0, rSquared: 0, covariance: 0, benchmarkVariance: 0 };
  }

  let meanT = 0;
  let meanB = 0;
  for (let i = 0; i < n; i++) {
    meanT += targetReturns[i];
    meanB += benchmarkReturns[i];
  }
  meanT /= n;
  meanB /= n;

  let cov = 0;
  let varB = 0;
  let varT = 0;

  for (let i = 0; i < n; i++) {
    const dt = targetReturns[i] - meanT;
    const db = benchmarkReturns[i] - meanB;
    cov += dt * db;
    varB += db * db;
    varT += dt * dt;
  }

  cov /= (n - 1);
  varB /= (n - 1);
  varT /= (n - 1);

  const beta = varB > 0 ? Number((cov / varB).toFixed(4)) : 1.0;
  const alpha = Number((meanT - beta * meanB).toFixed(6));
  const rSquared = (varB > 0 && varT > 0) ? Number((Math.pow(cov, 2) / (varB * varT)).toFixed(4)) : 0;

  return {
    beta,
    alpha,
    rSquared,
    covariance: Number(cov.toFixed(6)),
    benchmarkVariance: Number(varB.toFixed(6)),
  };
}

/**
 * Generates a Relative Strength ratio curve rebased to 100.
 */
export function computeRelativeStrength(
  targetBars: Bar[],
  benchmarkBars: Bar[],
): RelativeStrengthPoint[] {
  const benchMap = new Map<number, number>();
  for (const b of benchmarkBars) benchMap.set(b.t, b.c);

  const points: RelativeStrengthPoint[] = [];
  let baseRatio: number | null = null;

  for (const bar of targetBars) {
    const benchClose = benchMap.get(bar.t);
    if (benchClose && benchClose > 0) {
      const ratio = bar.c / benchClose;
      if (baseRatio === null) baseRatio = ratio;
      points.push({
        timestamp: bar.t,
        ratio: Number(ratio.toFixed(6)),
        normalized: baseRatio > 0 ? Number(((ratio / baseRatio) * 100).toFixed(2)) : 100,
      });
    }
  }

  return points;
}

/**
 * Generates synthetic pairs trading spread bars: Spread = AssetA - (hedgeRatio * AssetB)
 */
export function generateSyntheticSpread(
  barsA: Bar[],
  barsB: Bar[],
  hedgeRatio = 1.0,
): SpreadBar[] {
  const mapB = new Map<number, Bar>();
  for (const b of barsB) mapB.set(b.t, b);

  const spreads: SpreadBar[] = [];

  for (const a of barsA) {
    const b = mapB.get(a.t);
    if (b) {
      spreads.push({
        timestamp: a.t,
        open: Number((a.o - hedgeRatio * b.o).toFixed(4)),
        high: Number((a.h - hedgeRatio * b.l).toFixed(4)),
        low: Number((a.l - hedgeRatio * b.h).toFixed(4)),
        close: Number((a.c - hedgeRatio * b.c).toFixed(4)),
      });
    }
  }

  return spreads;
}
