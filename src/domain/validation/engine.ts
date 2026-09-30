/**
 * ZTerminal Validation Engine v0.1 — Core Quantitative Domain Engine
 *
 * Invariants:
 * - Deterministic: Same input + seed = bit-exact identical output.
 * - Zero Lookahead: In-Sample and Out-of-Sample boundaries enforce strict embargo purge.
 * - Adversarial Evidence: Evaluates degradation, fragility, regime concentration, and sample thinness.
 * - No Magic Scores: Only inspectable, rule-based quantitative evidence.
 */

import type { ResearchResult, ResearchTrade } from "@/lib/local-research/contracts";
import { canonicalHash } from "@/lib/local-research/dataset";
import {
  defaultValidationConfig,
  VALIDATION_ENGINE_VERSION,
  VALIDATION_SCHEMA_VERSION,
  type CostStressResult,
  type CostTier,
  type ConcentrationResult,
  type MonteCarloValidationResult,
  type OutOfSampleResult,
  type ParameterSensitivityResult,
  type RegimeMetric,
  type RegimeValidationResult,
  type ValidationBaseline,
  type ValidationConfig,
  type ValidationDiagnostic,
  type ValidationProfile,
  type ValidationRating,
  type ValidationResult,
  type WalkForwardCycle,
  type WalkForwardResult,
} from "./contracts";
import {
  createWalkForwardWindows,
  runMonteCarloValidation,
} from "./resampling";

/** Compute baseline summary metrics from a subset of closed trades. */
export function computeBaselineFromTrades(
  trades: readonly ResearchTrade[],
  initialCapital: number,
  durationDays: number,
): ValidationBaseline {
  const closed = trades.filter((t) => t.status === "closed").sort(
    (a, b) => (a.exitTime ?? a.entryTime) - (b.exitTime ?? b.entryTime) || a.entryTime - b.entryTime || a.id.localeCompare(b.id),
  );
  const totalTrades = closed.length;
  if (totalTrades === 0) {
    return {
      initialCapital,
      netProfit: 0,
      totalReturn: 0,
      cagr: 0,
      sharpe: null,
      sortino: null,
      maxDrawdown: 0,
      profitFactor: null,
      winRate: null,
      totalTrades: 0,
    };
  }

  const pnls = closed.map((t) => t.pnl);
  const wins = pnls.filter((p) => p > 0);
  const losses = pnls.filter((p) => p < 0);

  const grossWin = wins.reduce((sum, p) => sum + p, 0);
  const grossLoss = Math.abs(losses.reduce((sum, p) => sum + p, 0));
  const netProfit = grossWin - grossLoss;
  const totalReturn = netProfit / initialCapital;

  const years = Math.max(0.01, durationDays / 365.25);
  const endingEquity = initialCapital + netProfit;
  const cagr =
    endingEquity > 0 && years >= 0.05
      ? Math.pow(endingEquity / initialCapital, 1 / years) - 1
      : null;

  // Track max drawdown
  let equity = initialCapital;
  let peak = initialCapital;
  let maxDD = 0;
  for (const p of pnls) {
    equity += p;
    if (equity > peak) peak = equity;
    const dd = peak > 0 ? (peak - equity) / peak : 0;
    if (dd > maxDD) maxDD = dd;
  }

  // Trade return variance for Sharpe & Sortino
  const tradeReturns = closed
    .map((t) => (t.accountReturn != null ? t.accountReturn : t.pnl / initialCapital))
    .filter(Number.isFinite);

  let sharpe: number | null = null;
  let sortino: number | null = null;

  if (tradeReturns.length >= 5) {
    const mean = tradeReturns.reduce((sum, r) => sum + r, 0) / tradeReturns.length;
    const variance =
      tradeReturns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / (tradeReturns.length - 1);
    const stdDev = Math.sqrt(Math.max(0, variance));

    const downsideReturns = tradeReturns.filter((r) => r < 0);
    const downsideVariance =
      downsideReturns.length > 0
        ? downsideReturns.reduce((sum, r) => sum + r ** 2, 0) / downsideReturns.length
        : 0;
    const downsideStdDev = Math.sqrt(downsideVariance);

    const tradesPerYear = totalTrades / years;
    const annualFactor = Math.sqrt(Math.max(1, tradesPerYear));

    if (stdDev > 1e-9) {
      sharpe = Math.round((mean / stdDev) * annualFactor * 100) / 100;
    }
    if (downsideStdDev > 1e-9) {
      sortino = Math.round((mean / downsideStdDev) * annualFactor * 100) / 100;
    }
  }

  return {
    initialCapital,
    netProfit: Math.round(netProfit * 100) / 100,
    totalReturn: Math.round(totalReturn * 1000) / 1000,
    cagr: cagr != null ? Math.round(cagr * 1000) / 1000 : null,
    sharpe,
    sortino,
    maxDrawdown: Math.round(maxDD * 1000) / 1000,
    profitFactor:
      grossLoss > 0
        ? Math.round((grossWin / grossLoss) * 100) / 100
        : grossWin > 0
        ? 99.0
        : null,
    winRate: Math.round((wins.length / totalTrades) * 1000) / 1000,
    totalTrades,
  };
}

/**
 * 1. OUT-OF-SAMPLE VALIDATION
 * Chronological train/test split with strict embargo purge.
 */
export function evaluateOutOfSample(
  result: ResearchResult,
  config: ValidationConfig,
): OutOfSampleResult | null {
  const { dataset, trades, config: runConfig } = result;
  const closed = trades.filter((t) => t.status === "closed");
  if (closed.length < 6 || dataset.bars.length < 30) {
    return null;
  }

  const from = runConfig.from;
  const to = runConfig.to;
  const totalDuration = to - from;
  const splitRatio = Math.max(0.5, Math.min(0.9, config.oosSplitRatio));
  const splitTime = from + Math.floor(totalDuration * splitRatio);

  // Interval duration per bar
  const intervalMs =
    dataset.bars.length > 1
      ? dataset.bars[1].t - dataset.bars[0].t
      : Math.floor(totalDuration / dataset.bars.length);

  const purgeMs = config.purgeBars * intervalMs;
  const oosStartTime = splitTime + purgeMs;

  // In-Sample trades: strictly entry >= from and exit <= splitTime
  const isTrades = closed.filter((t) => t.entryTime >= from && t.exitTime != null && t.exitTime <= splitTime);

  // Out-of-Sample trades: strictly entry >= oosStartTime and exit <= to
  const oosTrades = closed.filter((t) => t.entryTime >= oosStartTime && (t.exitTime == null || t.exitTime <= to));

  const isDurationDays = (splitTime - from) / 86400000;
  const oosDurationDays = (to - oosStartTime) / 86400000;

  const isMetrics = computeBaselineFromTrades(isTrades, runConfig.initialCapital, isDurationDays);
  const oosMetrics = computeBaselineFromTrades(oosTrades, runConfig.initialCapital, oosDurationDays);

  // Degradation calculation
  let sharpeDelta: number | null = null;
  if (isMetrics.sharpe != null && oosMetrics.sharpe != null) {
    sharpeDelta =
      Math.abs(isMetrics.sharpe) > 1e-4
        ? Math.round(((oosMetrics.sharpe - isMetrics.sharpe) / Math.abs(isMetrics.sharpe)) * 1000) / 1000
        : oosMetrics.sharpe - isMetrics.sharpe;
  }

  const drawdownDelta = Math.round((oosMetrics.maxDrawdown - isMetrics.maxDrawdown) * 1000) / 1000;
  const winRateDelta =
    isMetrics.winRate != null && oosMetrics.winRate != null
      ? Math.round((oosMetrics.winRate - isMetrics.winRate) * 1000) / 1000
      : 0;

  // Deterministic OOS Rating
  let rating: ValidationRating = "moderate";
  if (oosMetrics.totalTrades < 3 || isMetrics.totalTrades < 3) {
    rating = "inconclusive";
  } else if (sharpeDelta != null && sharpeDelta >= -0.20 && (oosMetrics.sharpe ?? 0) > 0.5) {
    rating = "strong";
  } else if (sharpeDelta != null && sharpeDelta < -0.50 || (oosMetrics.sharpe != null && oosMetrics.sharpe <= 0)) {
    rating = "weak";
  } else if (oosMetrics.netProfit <= 0 && isMetrics.netProfit > 0) {
    rating = "weak";
  } else {
    rating = "moderate";
  }

  return {
    splitRatio,
    inSampleRange: { from, to: splitTime },
    outOfSampleRange: { from: oosStartTime, to },
    purgeBars: config.purgeBars,
    inSampleMetrics: isMetrics,
    outOfSampleMetrics: oosMetrics,
    degradation: {
      sharpeDelta,
      drawdownDelta,
      winRateDelta,
      rating,
    },
  };
}

/**
 * 2. WALK-FORWARD ANALYSIS
 * Rolling windows with purge to compute Walk-Forward Efficiency (WFE).
 */
export function evaluateWalkForward(
  result: ResearchResult,
  config: ValidationConfig,
): WalkForwardResult | null {
  const { dataset, trades, config: runConfig } = result;
  const bars = dataset.bars;
  const closed = trades.filter((t) => t.status === "closed");

  const numCycles = 5;
  if (bars.length < numCycles * 25 || closed.length < 10) {
    return null;
  }

  const totalBars = bars.length;
  const windowBars = Math.floor(totalBars / numCycles);
  const isRatio = 0.70;
  const isBarsCount = Math.floor(windowBars * isRatio);
  const oosBarsCount = windowBars - isBarsCount;

  const windows = createWalkForwardWindows(totalBars, {
    inSample: isBarsCount,
    outOfSample: oosBarsCount,
    step: Math.floor(windowBars * 0.5),
    purge: config.purgeBars,
  });

  if (windows.length < 3) {
    return null;
  }

  const cycles: WalkForwardCycle[] = [];
  let sumIsAnnual = 0;
  let sumOosAnnual = 0;
  let positiveOosCount = 0;

  for (let c = 0; c < windows.length; c += 1) {
    const win = windows[c];
    const isStart = bars[win.inSample.from].t;
    const isEnd = bars[win.inSample.to - 1].t;
    const oosStart = bars[win.outOfSample.from].t;
    const oosEnd = bars[win.outOfSample.to - 1].t;

    const isTrades = closed.filter((t) => t.entryTime >= isStart && t.exitTime != null && t.exitTime <= isEnd);
    const oosTrades = closed.filter((t) => t.entryTime >= oosStart && (t.exitTime == null || t.exitTime <= oosEnd));

    const isDuration = Math.max(0.01, (isEnd - isStart) / (365.25 * 86400000));
    const oosDuration = Math.max(0.01, (oosEnd - oosStart) / (365.25 * 86400000));

    const isM = computeBaselineFromTrades(isTrades, runConfig.initialCapital, isDuration * 365.25);
    const oosM = computeBaselineFromTrades(oosTrades, runConfig.initialCapital, oosDuration * 365.25);

    const isAnnual = isM.totalReturn / isDuration;
    const oosAnnual = oosM.totalReturn / oosDuration;

    let wfe = 0;
    if (isAnnual > 0) {
      wfe = Math.max(0, Math.round((oosAnnual / isAnnual) * 1000) / 10);
    } else if (oosAnnual > 0) {
      wfe = 100;
    }

    if (oosM.netProfit > 0) positiveOosCount += 1;
    sumIsAnnual += Math.max(0, isAnnual);
    sumOosAnnual += oosAnnual;

    cycles.push({
      cycle: c + 1,
      inSample: {
        from: isStart,
        to: isEnd,
        return: isM.totalReturn,
        sharpe: isM.sharpe,
        trades: isM.totalTrades,
      },
      outOfSample: {
        from: oosStart,
        to: oosEnd,
        return: oosM.totalReturn,
        sharpe: oosM.sharpe,
        trades: oosM.totalTrades,
      },
      wfe,
    });
  }

  const aggregateWfe =
    sumIsAnnual > 0
      ? Math.max(0, Math.round((sumOosAnnual / sumIsAnnual) * 1000) / 10)
      : 0;

  let rating: ValidationRating = "moderate";
  if (cycles.length < 3) {
    rating = "inconclusive";
  } else if (aggregateWfe >= 50.0 && positiveOosCount >= Math.ceil(cycles.length * 0.6)) {
    rating = "strong";
  } else if (aggregateWfe < 25.0 || positiveOosCount < Math.ceil(cycles.length * 0.4)) {
    rating = "weak";
  }

  return {
    cycles,
    aggregateWfe,
    positiveOosCycles: positiveOosCount,
    totalCycles: cycles.length,
    rating,
  };
}

/**
 * 3. MONTE CARLO PERMUTATION
 * Deterministic trade permutation and bootstrap analysis.
 */
export function evaluateMonteCarlo(
  result: ResearchResult,
  config: ValidationConfig,
): MonteCarloValidationResult | null {
  const closed = result.trades.filter((t) => t.status === "closed").sort(
    (a, b) => (a.exitTime ?? a.entryTime) - (b.exitTime ?? b.entryTime) || a.entryTime - b.entryTime || a.id.localeCompare(b.id),
  );
  if (closed.length < 5) {
    return null;
  }

  const tradePnls = closed.map((t) => t.pnl);
  const summary = runMonteCarloValidation(tradePnls, {
    paths: config.monteCarloPaths,
    initialEquity: result.config.initialCapital,
    seed: config.monteCarloSeed,
    method: config.monteCarloMethod,
  });

  return {
    method: summary.method,
    seed: summary.seed,
    paths: summary.paths,
    observations: summary.observations,
    terminalEquity: summary.terminalEquity,
    maxDrawdownPct: summary.maxDrawdownPct,
    probabilityOfLoss: summary.probabilityOfLoss,
    probabilityOfRuin: summary.probabilityOfRuin,
    samplePaths: summary.samplePaths,
  };
}

/**
 * 4. COST & SLIPPAGE STRESS TESTING
 * Incremental friction decay curve and break-even calculation.
 */
export function evaluateCostStress(
  result: ResearchResult,
  config: ValidationConfig,
): CostStressResult {
  const closed = result.trades.filter((t) => t.status === "closed");
  const baseFee = result.config.feeBps;
  const baseSlip = result.config.slippageBps;
  const baseFriction = baseFee + baseSlip;
  const multiplier = result.config.multiplier;
  const initialCapital = result.config.initialCapital;
  const durationDays = Math.max(1, (result.config.to - result.config.from) / 86400000);

  const tiersBps = config.costTiersBps && config.costTiersBps.length > 0
    ? [...config.costTiersBps].sort((a, b) => a - b)
    : [0, 5, 10, 20, 30];

  const tiers: CostTier[] = tiersBps.map((addedBps) => {
    let totalPnl = 0;
    const adjustedPnls: number[] = [];

    for (const t of closed) {
      // 2 fills per completed round-trip trade (entry and exit)
      const notional = (t.entryPrice + t.exitPrice) * t.quantity * multiplier;
      const addedCost = notional * (addedBps / 10000);
      const adjPnl = t.pnl - addedCost;
      totalPnl += adjPnl;
      adjustedPnls.push(adjPnl);
    }

    const wins = adjustedPnls.filter((p) => p > 0);
    const losses = adjustedPnls.filter((p) => p < 0);
    const grossWin = wins.reduce((sum, p) => sum + p, 0);
    const grossLoss = Math.abs(losses.reduce((sum, p) => sum + p, 0));
    const profitFactor =
      grossLoss > 0
        ? Math.round((grossWin / grossLoss) * 100) / 100
        : grossWin > 0
        ? 99.0
        : null;

    const expectancy =
      closed.length > 0 ? Math.round((totalPnl / closed.length) * 100) / 100 : 0;

    // Quick trade-return Sharpe
    let sharpe: number | null = null;
    if (adjustedPnls.length >= 5) {
      const mean = totalPnl / adjustedPnls.length;
      const variance =
        adjustedPnls.reduce((sum, p) => sum + (p - mean) ** 2, 0) / (adjustedPnls.length - 1);
      const std = Math.sqrt(variance);
      const tradesPerYear = (closed.length / durationDays) * 365.25;
      if (std > 1e-9) {
        sharpe = Math.round((mean / std) * Math.sqrt(Math.max(1, tradesPerYear)) * 100) / 100;
      }
    }

    return {
      feeBps: baseFee,
      slippageBps: baseSlip + addedBps,
      totalFrictionBps: baseFriction + addedBps,
      netProfit: Math.round(totalPnl * 100) / 100,
      sharpe,
      profitFactor,
      expectancy,
    };
  });

  // Under this explicitly linear PnL haircut, the zero crossing is algebraic.
  // It must not be replaced by the highest sampled tier or a made-up ceiling.
  const totalNotional = closed.reduce(
    (sum, t) => sum + (t.entryPrice + t.exitPrice) * t.quantity * multiplier,
    0,
  );
  const baseNetProfit = closed.reduce((sum, t) => sum + t.pnl, 0);
  const breakEvenFrictionBps = totalNotional > 0
    ? Math.round(Math.max(0, baseFriction + (baseNetProfit / totalNotional) * 10000) * 10) / 10
    : null;

  // Friction Elasticity: % drop in expectancy at +10 bps
  const baseTier = tiers.find((t) => t.totalFrictionBps === baseFriction) ?? tiers[0];
  const plus10Tier = tiers.find((t) => t.totalFrictionBps >= baseFriction + 10) ?? tiers[tiers.length - 1];
  let frictionElasticity = 0;
  if (baseTier.expectancy > 0) {
    const drop = (baseTier.expectancy - plus10Tier.expectancy) / baseTier.expectancy;
    frictionElasticity = Math.round(drop * 1000) / 10;
  }

  // Deterministic Rating
  let rating: ValidationRating = "moderate";
  if (breakEvenFrictionBps == null) {
    rating = "inconclusive";
  } else if (breakEvenFrictionBps >= 25 && (plus10Tier.sharpe ?? 0) > 0.5) {
    rating = "strong";
  } else if (breakEvenFrictionBps < 10 || plus10Tier.netProfit < 0) {
    rating = "weak";
  }

  return {
    tiers,
    breakEvenFrictionBps,
    frictionElasticity,
    rating,
  };
}

/**
 * 5. REGIME ANALYSIS
 * Classifies bars into Volatility tertiles and Trend states, attributing trade outcomes.
 */
export function evaluateRegimes(result: ResearchResult): RegimeValidationResult {
  const { dataset, trades, config: runConfig } = result;
  const bars = dataset.bars;
  const closed = trades.filter((t) => t.status === "closed");

  if (bars.length < 20 || closed.length === 0) {
    return {
      volatilityRegimes: [],
      trendRegimes: [],
      dominantRegimePct: 0,
      rating: "inconclusive",
    };
  }

  // 1. Calculate ATR(20) and EMA(50)/EMA(200) across all bars
  const atrs: number[] = [];
  const closes = bars.map((b) => b.c);

  for (let i = 0; i < bars.length; i += 1) {
    const current = bars[i];
    const prevClose = i > 0 ? bars[i - 1].c : current.o;
    const tr = Math.max(
      current.h - current.l,
      Math.abs(current.h - prevClose),
      Math.abs(current.l - prevClose),
    );
    atrs.push(tr / current.c); // ATR %
  }

  // Rolling 20-bar ATR average
  const smoothedAtr: number[] = [];
  let atrSum = 0;
  for (let i = 0; i < atrs.length; i += 1) {
    atrSum += atrs[i];
    if (i >= 20) atrSum -= atrs[i - 20];
    smoothedAtr.push(atrSum / Math.min(i + 1, 20));
  }

  // Tertile thresholds for volatility
  const sortedAtrs = [...smoothedAtr].sort((a, b) => a - b);
  const p33 = sortedAtrs[Math.floor(sortedAtrs.length * 0.33)];
  const p66 = sortedAtrs[Math.floor(sortedAtrs.length * 0.66)];

  // Calculate EMA(50) and EMA(200)
  function calcEma(period: number): number[] {
    const out: number[] = [];
    const alpha = 2 / (period + 1);
    let prev = closes[0];
    for (const c of closes) {
      prev = c * alpha + prev * (1 - alpha);
      out.push(prev);
    }
    return out;
  }
  const ema50 = calcEma(50);
  const ema200 = calcEma(200);

  // Pre-index bar timestamps
  const barMap = new Map<number, number>();
  for (let i = 0; i < bars.length; i += 1) {
    barMap.set(bars[i].t, i);
  }

  // Groups for volatility
  const volBuckets: Record<string, { label: string; bars: number; trades: ResearchTrade[] }> = {
    low: { label: "Low Volatility", bars: 0, trades: [] },
    normal: { label: "Normal Volatility", bars: 0, trades: [] },
    high: { label: "High Volatility", bars: 0, trades: [] },
  };

  // Groups for trend
  const trendBuckets: Record<string, { label: string; bars: number; trades: ResearchTrade[] }> = {
    bull: { label: "Bull Trend", bars: 0, trades: [] },
    bear: { label: "Bear Trend", bars: 0, trades: [] },
    neutral: { label: "Range / Neutral", bars: 0, trades: [] },
  };

  // Count bars per regime
  for (let i = 0; i < bars.length; i += 1) {
    const vol = smoothedAtr[i];
    if (vol <= p33) volBuckets.low.bars += 1;
    else if (vol <= p66) volBuckets.normal.bars += 1;
    else volBuckets.high.bars += 1;

    const c = closes[i];
    const e50 = ema50[i];
    const e200 = ema200[i];
    if (c > e50 && e50 > e200) trendBuckets.bull.bars += 1;
    else if (c < e50 && e50 < e200) trendBuckets.bear.bars += 1;
    else trendBuckets.neutral.bars += 1;
  }

  // Attribute trades to regimes based on trade entryTime
  for (const t of closed) {
    const idx = barMap.get(t.entryTime) ?? 0;
    const vol = smoothedAtr[idx];
    if (vol <= p33) volBuckets.low.trades.push(t);
    else if (vol <= p66) volBuckets.normal.trades.push(t);
    else volBuckets.high.trades.push(t);

    const c = closes[idx];
    const e50 = ema50[idx];
    const e200 = ema200[idx];
    if (c > e50 && e50 > e200) trendBuckets.bull.trades.push(t);
    else if (c < e50 && e50 < e200) trendBuckets.bear.trades.push(t);
    else trendBuckets.neutral.trades.push(t);
  }

  const totalProfit = Math.max(
    1e-4,
    closed.filter((t) => t.pnl > 0).reduce((sum, t) => sum + t.pnl, 0),
  );

  function buildMetrics(
    buckets: Record<string, { label: string; bars: number; trades: ResearchTrade[] }>,
  ): RegimeMetric[] {
    return Object.entries(buckets).map(([key, data]) => {
      const count = data.trades.length;
      const wins = data.trades.filter((t) => t.pnl > 0);
      const netPnl = data.trades.reduce((sum, t) => sum + t.pnl, 0);
      const grossWins = wins.reduce((sum, t) => sum + t.pnl, 0);
      const winRate = count > 0 ? Math.round((wins.length / count) * 1000) / 1000 : 0;
      const contrib = Math.round((grossWins / totalProfit) * 1000) / 10;

      // Sharpe estimate
      let sharpe: number | null = null;
      if (count >= 4) {
        const mean = netPnl / count;
        const variance =
          data.trades.reduce((sum, t) => sum + (t.pnl - mean) ** 2, 0) / (count - 1);
        const std = Math.sqrt(variance);
        if (std > 1e-9) {
          sharpe = Math.round((mean / std) * Math.sqrt(count) * 100) / 100;
        }
      }

      return {
        regime: key,
        label: data.label,
        barsCount: data.bars,
        tradesCount: count,
        winRate,
        netProfit: Math.round(netPnl * 100) / 100,
        profitContributionPct: contrib,
        sharpe,
      };
    });
  }

  const volatilityRegimes = buildMetrics(volBuckets);
  const trendRegimes = buildMetrics(trendBuckets);

  // Maximum single regime concentration
  const maxVolContrib = Math.max(...volatilityRegimes.map((r) => r.profitContributionPct), 0);
  const maxTrendContrib = Math.max(...trendRegimes.map((r) => r.profitContributionPct), 0);
  const dominantRegimePct = Math.max(maxVolContrib, maxTrendContrib);

  let rating: ValidationRating = "moderate";
  if (dominantRegimePct >= 75.0) {
    rating = "weak"; // Overly dependent on a single market state
  } else if (dominantRegimePct <= 55.0 && volatilityRegimes.filter((r) => r.netProfit > 0).length >= 2) {
    rating = "strong";
  }

  return {
    volatilityRegimes,
    trendRegimes,
    dominantRegimePct,
    rating,
  };
}

/**
 * 6. PERFORMANCE CONCENTRATION & SAMPLE ADEQUACY
 * Analyzes whether results are dominated by a handful of outlier trades.
 */
export function evaluateConcentration(result: ResearchResult): ConcentrationResult {
  const closed = result.trades.filter((t) => t.status === "closed").sort(
    (a, b) => (a.exitTime ?? a.entryTime) - (b.exitTime ?? b.entryTime) || a.entryTime - b.entryTime || a.id.localeCompare(b.id),
  );
  const pnls = closed.map((t) => t.pnl);
  const totalNet = Math.max(1e-4, pnls.reduce((sum, p) => sum + p, 0));

  // Sort descending
  const sortedDesc = [...pnls].sort((a, b) => b - a);
  const top5Sum = sortedDesc.slice(0, 5).reduce((sum, p) => sum + Math.max(0, p), 0);
  const top10Sum = sortedDesc.slice(0, 10).reduce((sum, p) => sum + Math.max(0, p), 0);

  const top5TradesProfitPct = Math.round((top5Sum / totalNet) * 1000) / 10;
  const top10TradesProfitPct = Math.round((top10Sum / totalNet) * 1000) / 10;

  // Gini coefficient of positive trades
  const positivePnls = sortedDesc.filter((p) => p > 0);
  let gini = 0;
  if (positivePnls.length >= 2) {
    const n = positivePnls.length;
    let sumDifferences = 0;
    const sortedAsc = [...positivePnls].reverse();
    for (let i = 0; i < n; i += 1) {
      for (let j = 0; j < n; j += 1) {
        sumDifferences += Math.abs(sortedAsc[i] - sortedAsc[j]);
      }
    }
    const meanPnl = positivePnls.reduce((sum, p) => sum + p, 0) / n;
    gini = Math.round((sumDifferences / (2 * n * n * meanPnl)) * 1000) / 1000;
  }

  // Herfindahl-Hirschman Index (HHI)
  let hhi = 0;
  const grossProfit = positivePnls.reduce((sum, p) => sum + p, 0);
  if (grossProfit > 0) {
    hhi =
      Math.round(
        positivePnls.reduce((sum, p) => sum + (p / grossProfit) ** 2, 0) * 1000,
      ) / 1000;
  }

  // Longest losing streak
  let currentLossStreak = 0;
  let maxLossStreak = 0;
  for (const p of pnls) {
    if (p <= 0) {
      currentLossStreak += 1;
      if (currentLossStreak > maxLossStreak) maxLossStreak = currentLossStreak;
    } else {
      currentLossStreak = 0;
    }
  }

  // Max drawdown days
  let maxDrawdownDays = 0;
  for (const dd of result.drawdowns) {
    const days = dd.durationMs / 86400000;
    if (days > maxDrawdownDays) maxDrawdownDays = Math.round(days * 10) / 10;
  }

  // Sample sufficiency
  let sampleSufficiency: ConcentrationResult["sampleSufficiency"] = "adequate";
  if (closed.length < 20) {
    sampleSufficiency = "insufficient";
  } else if (closed.length < 50) {
    sampleSufficiency = "marginal";
  }

  return {
    top5TradesProfitPct,
    top10TradesProfitPct,
    giniCoefficient: gini,
    herfindahlIndex: hhi,
    longestLossStreak: maxLossStreak,
    maxDrawdownDays,
    sampleSufficiency,
  };
}

/** Parameter sensitivity requires independent strategy executions for every cell. */
export function evaluateSensitivity(
  _result: ResearchResult,
  _config: ValidationConfig,
): ParameterSensitivityResult | null {
  return null;
}

/**
 * 8. EVIDENCE PROFILE SYNTHESIS
 * Synthesizes the 5 independent pillar ratings without creating a single magic score.
 */
export function synthesizeProfile(
  oos: OutOfSampleResult | null,
  sensitivity: ParameterSensitivityResult | null,
  costStress: CostStressResult,
  regimes: RegimeValidationResult,
  concentration: ConcentrationResult,
): ValidationProfile {
  let sampleAdequacy: ValidationRating = "strong";
  if (concentration.sampleSufficiency === "insufficient") {
    sampleAdequacy = "weak";
  } else if (concentration.sampleSufficiency === "marginal") {
    sampleAdequacy = "moderate";
  }

  return {
    oosPersistence: oos?.degradation.rating ?? "inconclusive",
    parameterStability: sensitivity?.rating ?? "inconclusive",
    frictionResilience: costStress.rating,
    regimeBreadth: regimes.rating,
    sampleAdequacy,
  };
}

/**
 * 9. PLAIN-LANGUAGE DETERMINISTIC DIAGNOSTICS
 * Generates human-readable quantitative statements from explicit mathematical rules.
 */
export function generateDiagnostics(
  baseline: ValidationBaseline,
  oos: OutOfSampleResult | null,
  wfo: WalkForwardResult | null,
  mc: MonteCarloValidationResult | null,
  sensitivity: ParameterSensitivityResult | null,
  costs: CostStressResult,
  regimes: RegimeValidationResult,
  conc: ConcentrationResult,
): ValidationDiagnostic[] {
  const diagnostics: ValidationDiagnostic[] = [];

  // 1. OOS Diagnostics
  if (oos) {
    if (oos.degradation.sharpeDelta != null && oos.degradation.sharpeDelta < -0.30) {
      diagnostics.push({
        id: "oos-sharpe-degradation",
        category: "oos",
        severity: oos.degradation.sharpeDelta < -0.50 ? "critical" : "warning",
        headline: "Significant Out-of-Sample Degradation",
        detail: `Out-of-sample Sharpe ratio is ${Math.round(Math.abs(oos.degradation.sharpeDelta) * 100)}% lower than in-sample performance (${oos.outOfSampleMetrics.sharpe ?? "—"} vs ${oos.inSampleMetrics.sharpe ?? "—"}).`,
        metricValue: oos.degradation.sharpeDelta,
      });
    } else if (oos.degradation.rating === "strong") {
      diagnostics.push({
        id: "oos-persistence-strong",
        category: "oos",
        severity: "info",
        headline: "Positive Performance in Later Chronological Segment",
        detail: `Later-period Sharpe is ${oos.outOfSampleMetrics.sharpe ?? "—"} versus earlier-period Sharpe ${oos.inSampleMetrics.sharpe ?? "—"}. This partition of one backtest does not establish that the strategy was selected without seeing later data.`,
      });
    }
  }

  // 2. Walk-Forward Diagnostics
  if (wfo) {
    if (wfo.aggregateWfe < 35.0) {
      diagnostics.push({
        id: "wfo-low-efficiency",
        category: "oos",
        severity: "warning",
        headline: "Low Later-Window Return Ratio",
        detail: `The later-to-earlier annualized return ratio is ${wfo.aggregateWfe}% across rolling windows of one backtest. No parameter selection or separate forward execution was performed.`,
        metricValue: wfo.aggregateWfe,
      });
    }
  }

  // 3. Monte Carlo Diagnostics
  if (mc) {
    if (mc.maxDrawdownPct.p95 > baseline.maxDrawdown * 1.5) {
      diagnostics.push({
        id: "mc-path-dependency-drawdown",
        category: "concentration",
        severity: "warning",
        headline: "Elevated Path-Dependent Drawdown Risk",
        detail: `95th percentile simulated drawdown reaches ${(mc.maxDrawdownPct.p95 * 100).toFixed(1)}%, materially higher than historical drawdown (${(baseline.maxDrawdown * 100).toFixed(1)}%).`,
        metricValue: mc.maxDrawdownPct.p95,
      });
    }
    if (mc.method === "iid_trade_resampling" && mc.probabilityOfLoss > 0.15) {
      diagnostics.push({
        id: "mc-probability-of-loss",
        category: "concentration",
        severity: "warning",
        headline: "Substantial Risk of Negative Terminal Capital",
        detail: `Reshuffled trade order simulations yield a ${(mc.probabilityOfLoss * 100).toFixed(1)}% probability of ending in net loss.`,
        metricValue: mc.probabilityOfLoss,
      });
    }
  }

  // 4. Sensitivity Diagnostics
  if (sensitivity) {
    if (sensitivity.surfaceClassification === "narrow_spike") {
      diagnostics.push({
        id: "sens-needle-spike",
        category: "sensitivity",
        severity: "critical",
        headline: "Narrow Performance Spike (Curve-Fitting Flag)",
        detail: `Baseline parameters occupy an isolated peak. Adjacent parameter neighbors degrade by ${Math.round((1 - sensitivity.neighborDegradationRatio) * 100)}%, indicating sensitivity to slight market shifts.`,
        metricValue: sensitivity.neighborDegradationRatio,
      });
    } else if (sensitivity.surfaceClassification === "broad_plateau") {
      diagnostics.push({
        id: "sens-broad-plateau",
        category: "sensitivity",
        severity: "info",
        headline: "Broad Parameter Stability Region",
        detail: `Performance remains consistent across immediate parameter neighbors (stability ratio ${sensitivity.neighborDegradationRatio.toFixed(2)}).`,
        metricValue: sensitivity.neighborDegradationRatio,
      });
    }
  }

  // 5. Cost Stress Diagnostics
  if (costs.breakEvenFrictionBps == null) {
    diagnostics.push({
      id: "cost-insufficient-sample", category: "cost", severity: "warning",
      headline: "Cost threshold unavailable", detail: "No positive trade notional is available for a break-even friction calculation.",
    });
  } else if (costs.breakEvenFrictionBps < 10) {
    diagnostics.push({
      id: "cost-fragile-edge",
      category: "cost",
      severity: "critical",
      headline: "Edge Collapses Under Modest Friction",
      detail: `Projected break-even total friction is ${costs.breakEvenFrictionBps.toFixed(1)} bps under a linear haircut of recorded trades. Additional execution costs could eliminate net profit.`,
      metricValue: costs.breakEvenFrictionBps,
    });
  } else {
    diagnostics.push({
      id: "cost-break-even-info",
      category: "cost",
      severity: "info",
      headline: "Friction Tolerance",
      detail: `Projected break-even total friction is ${costs.breakEvenFrictionBps.toFixed(1)} bps under a linear haircut of recorded trades; the strategy was not rerun.`,
      metricValue: costs.breakEvenFrictionBps,
    });
  }

  // 6. Regime Diagnostics
  if (regimes.dominantRegimePct >= 70.0) {
    diagnostics.push({
      id: "regime-concentration-flag",
      category: "regime",
      severity: "warning",
      headline: "High Regime Dependency",
      detail: `${regimes.dominantRegimePct.toFixed(1)}% of gross winning profit occurred within a single market regime. Performance may suffer when market dynamics shift.`,
      metricValue: regimes.dominantRegimePct,
    });
  }

  // 7. Concentration & Sample Adequacy Diagnostics
  if (conc.top5TradesProfitPct >= 65.0) {
    diagnostics.push({
      id: "conc-top5-outliers",
      category: "concentration",
      severity: "warning",
      headline: "Profits Dominated by Top 5 Trades",
      detail: `Top 5 trades account for ${conc.top5TradesProfitPct.toFixed(1)}% of total net profit. Strategy edge is heavily reliant on rare outlier occurrences.`,
      metricValue: conc.top5TradesProfitPct,
    });
  }

  if (conc.sampleSufficiency === "insufficient") {
    diagnostics.push({
      id: "sample-thin-warning",
      category: "sample",
      severity: "warning",
      headline: "Thin Sample Warning (<20 Closed Trades)",
      detail: `Only ${baseline.totalTrades} closed trades are available. Statistical ratios have wide error bands; interpret validation metrics cautiously.`,
      metricValue: baseline.totalTrades,
    });
  }

  return diagnostics;
}

/**
 * 10. RUN FULL VALIDATION BATTERY
 * Orchestrates all validation modules, computes provenance hashes, and generates ValidationResult.
 */
export async function runValidationBattery(
  result: ResearchResult,
  customConfig?: Partial<ValidationConfig>,
): Promise<ValidationResult> {
  const config: ValidationConfig = {
    ...defaultValidationConfig(),
    ...customConfig,
  };

  const durationDays = Math.max(1, (result.config.to - result.config.from) / 86400000);
  const baseline = computeBaselineFromTrades(result.trades, result.config.initialCapital, durationDays);

  const oos = evaluateOutOfSample(result, config);
  const wfo = evaluateWalkForward(result, config);
  const mc = evaluateMonteCarlo(result, config);
  const sensitivity = evaluateSensitivity(result, config);
  const costStress = evaluateCostStress(result, config);
  const regimes = evaluateRegimes(result);
  const concentration = evaluateConcentration(result);

  const profile = synthesizeProfile(oos, sensitivity, costStress, regimes, concentration);
  const diagnostics = generateDiagnostics(
    baseline,
    oos,
    wfo,
    mc,
    sensitivity,
    costStress,
    regimes,
    concentration,
  );

  const validationConfigHash = await canonicalHash(config);
  const validationId = `val-${result.id.slice(0, 8)}-${Date.now()}`;

  return {
    version: VALIDATION_SCHEMA_VERSION,
    id: validationId,
    sourceRunId: result.id,
    createdAt: Date.now(),
    provenance: {
      sourceRunFingerprint: result.resultHash,
      validationConfigHash,
      engineVersion: VALIDATION_ENGINE_VERSION,
    },
    config,
    baseline,
    outOfSample: oos ?? undefined,
    walkForward: wfo ?? undefined,
    monteCarlo: mc ?? undefined,
    sensitivity: sensitivity ?? undefined,
    costStress,
    regimes,
    concentration,
    profile,
    diagnostics,
  };
}
