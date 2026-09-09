"use client";

import type { Bar } from "../market/types";
import { executeLocalBacktest, type BacktestConfig } from "./compute-engine";
import type { StrategyExecutionResult } from "./python-runtime";

export interface ParameterDefinition {
  name: string;
  min: number;
  max: number;
  step: number;
  type: "int" | "float";
}

export interface OptimizationCandidate {
  params: Record<string, number>;
  netProfit: number;
  sharpeRatio: number;
  winRate: number;
  profitFactor: number;
  maxDrawdownPct: number;
  totalTrades: number;
  fitness: number;
}

export interface OptimizationResult {
  candidates: OptimizationCandidate[];
  bestCandidate: OptimizationCandidate | null;
  totalCombinations: number;
  elapsedMs: number;
  paramNames: string[];
  heatmap?: {
    paramX: string;
    paramY: string;
    xValues: number[];
    yValues: number[];
    grid: number[][]; // grid[yIdx][xIdx] = netProfit or sharpe
  };
}

export interface WfaPeriod {
  cycle: number;
  inSampleFrom: number;
  inSampleTo: number;
  outOfSampleFrom: number;
  outOfSampleTo: number;
  bestParams: Record<string, number>;
  inSampleNetProfit: number;
  inSampleSharpe: number;
  inSampleAnnualReturn: number;
  outOfSampleNetProfit: number;
  outOfSampleSharpe: number;
  outOfSampleAnnualReturn: number;
  wfe: number; // Walk-Forward Efficiency %
}

export interface WfaResult {
  cycles: WfaPeriod[];
  aggregateWfe: number;
  overallOosNetProfit: number;
  overallOosSharpe: number;
  isRobust: boolean; // WFE > 50%
}

/**
 * Injects parameter values into Python/EasyLanguage source code.
 */
export function injectParameters(source: string, params: Record<string, number>): string {
  let updated = source;
  for (const [key, value] of Object.entries(params)) {
    // Replace inputs.int(key, ...) or key = ...
    const intRegex = new RegExp(`(${key}\\s*=\\s*inputs\\.int\\()\\d+`, "g");
    if (intRegex.test(updated)) {
      updated = updated.replace(intRegex, `$1${value}`);
      continue;
    }
    const floatRegex = new RegExp(`(${key}\\s*=\\s*inputs\\.float\\()\\d+(?:\\.\\d+)?`, "g");
    if (floatRegex.test(updated)) {
      updated = updated.replace(floatRegex, `$1${value}`);
      continue;
    }
    const simpleRegex = new RegExp(`\\b${key}\\s*=\\s*\\d+(?:\\.\\d+)?\\b`, "g");
    if (simpleRegex.test(updated)) {
      updated = updated.replace(simpleRegex, `${key} = ${value}`);
    }
  }
  return updated;
}

/**
 * Runs a multi-parameter grid search across historical bars.
 */
export async function runGridSearch(
  source: string,
  bars: Bar[],
  config: BacktestConfig,
  paramDefs: ParameterDefinition[],
  fitnessMetric: "sharpe" | "netProfit" | "profitFactor" = "sharpe",
  onProgress?: (completed: number, total: number) => void
): Promise<OptimizationResult> {
  const startTime = performance.now();

  // Generate parameter combinations
  const paramValuesList: { name: string; values: number[] }[] = paramDefs.map((def) => {
    const values: number[] = [];
    const step = Math.max(0.0001, def.step);
    for (let v = def.min; v <= def.max + 1e-9; v += step) {
      values.push(def.type === "int" ? Math.round(v) : Math.round(v * 1000) / 1000);
    }
    return { name: def.name, values };
  });

  function cartesianProduct(index: number, current: Record<string, number>, out: Record<string, number>[]) {
    if (index === paramValuesList.length) {
      out.push({ ...current });
      return;
    }
    const { name, values } = paramValuesList[index];
    for (const val of values) {
      current[name] = val;
      cartesianProduct(index + 1, current, out);
    }
  }

  const combinations: Record<string, number>[] = [];
  cartesianProduct(0, {}, combinations);

  const candidates: OptimizationCandidate[] = [];

  for (let i = 0; i < combinations.length; i++) {
    const params = combinations[i];
    const modifiedCode = injectParameters(source, params);

    try {
      const res = await executeLocalBacktest(modifiedCode, bars, config);
      const metrics = res.metrics;

      let fitness = metrics.sharpeRatio;
      if (fitnessMetric === "netProfit") fitness = metrics.netProfit;
      if (fitnessMetric === "profitFactor") fitness = metrics.profitFactor;

      candidates.push({
        params,
        netProfit: metrics.netProfit,
        sharpeRatio: metrics.sharpeRatio,
        winRate: metrics.winRate,
        profitFactor: metrics.profitFactor,
        maxDrawdownPct: metrics.maxDrawdownPct,
        totalTrades: metrics.totalTrades,
        fitness: Math.round(fitness * 100) / 100,
      });
    } catch {
      // Strategy evaluation failed for this combo
      candidates.push({
        params,
        netProfit: -config.initialCapital,
        sharpeRatio: -99,
        winRate: 0,
        profitFactor: 0,
        maxDrawdownPct: 1,
        totalTrades: 0,
        fitness: -999,
      });
    }

    if (onProgress && (i % 5 === 0 || i === combinations.length - 1)) {
      onProgress(i + 1, combinations.length);
    }
  }

  // Sort candidates descending by fitness
  candidates.sort((a, b) => b.fitness - a.fitness);
  const bestCandidate = candidates.length > 0 ? candidates[0] : null;

  // Build 2D heatmap if at least 2 parameters
  let heatmap: OptimizationResult["heatmap"] = undefined;
  if (paramValuesList.length >= 2) {
    const pX = paramValuesList[0];
    const pY = paramValuesList[1];
    const grid: number[][] = [];

    for (let yIdx = 0; yIdx < pY.values.length; yIdx++) {
      const row: number[] = [];
      for (let xIdx = 0; xIdx < pX.values.length; xIdx++) {
        const xVal = pX.values[xIdx];
        const yVal = pY.values[yIdx];
        const match = candidates.find(
          (c) => c.params[pX.name] === xVal && c.params[pY.name] === yVal
        );
        row.push(match ? match.netProfit : 0);
      }
      grid.push(row);
    }

    heatmap = {
      paramX: pX.name,
      paramY: pY.name,
      xValues: pX.values,
      yValues: pY.values,
      grid,
    };
  }

  return {
    candidates,
    bestCandidate,
    totalCombinations: combinations.length,
    elapsedMs: Math.round(performance.now() - startTime),
    paramNames: paramDefs.map((d) => d.name),
    heatmap,
  };
}

/**
 * Runs a Walk-Forward Analysis (WFA) with rolling In-Sample (training) and
 * Out-of-Sample (forward test) windows to compute Walk-Forward Efficiency (WFE).
 */
export async function runWalkForwardAnalysis(
  source: string,
  bars: Bar[],
  config: BacktestConfig,
  paramDefs: ParameterDefinition[],
  options: {
    cycles?: number;
    inSampleRatio?: number;
  } = {}
): Promise<WfaResult> {
  const numCycles = options.cycles || 5;
  const isRatio = options.inSampleRatio || 0.7;

  if (bars.length < numCycles * 20) {
    throw new Error("Insufficient bars for Walk-Forward Analysis. Need more historical data.");
  }

  const windowSize = Math.floor(bars.length / numCycles);
  const cycles: WfaPeriod[] = [];

  let aggregateIsAnnual = 0;
  let aggregateOosAnnual = 0;
  let overallOosNetProfit = 0;

  for (let c = 0; c < numCycles; c++) {
    const startIdx = c * Math.floor(bars.length / (numCycles + 1));
    const endIdx = Math.min(bars.length, startIdx + windowSize);
    const windowBars = bars.slice(startIdx, endIdx);

    const isCutoff = Math.floor(windowBars.length * isRatio);
    const isBars = windowBars.slice(0, isCutoff);
    const oosBars = windowBars.slice(isCutoff);

    if (isBars.length < 10 || oosBars.length < 5) continue;

    // 1. Optimize on In-Sample
    const opt = await runGridSearch(source, isBars, config, paramDefs, "sharpe");
    const bestParams = opt.bestCandidate?.params || {};

    // 2. Evaluate In-Sample with best params
    const isRes = await executeLocalBacktest(injectParameters(source, bestParams), isBars, config);

    // 3. Forward test Out-of-Sample with best params
    const oosRes = await executeLocalBacktest(injectParameters(source, bestParams), oosBars, config);

    const isDurationYears = Math.max(0.01, (isBars[isBars.length - 1].t - isBars[0].t) / (365.25 * 86400000));
    const oosDurationYears = Math.max(0.01, (oosBars[oosBars.length - 1].t - oosBars[0].t) / (365.25 * 86400000));

    const isAnnualReturn = (isRes.metrics.netProfit / config.initialCapital) / isDurationYears;
    const oosAnnualReturn = (oosRes.metrics.netProfit / config.initialCapital) / oosDurationYears;

    // Walk-Forward Efficiency = OOS Annual Return / IS Annual Return
    const wfe =
      isAnnualReturn > 0
        ? Math.max(0, Math.round((oosAnnualReturn / isAnnualReturn) * 1000) / 10)
        : oosAnnualReturn > 0
        ? 100
        : 0;

    aggregateIsAnnual += isAnnualReturn;
    aggregateOosAnnual += oosAnnualReturn;
    overallOosNetProfit += oosRes.metrics.netProfit;

    cycles.push({
      cycle: c + 1,
      inSampleFrom: isBars[0].t,
      inSampleTo: isBars[isBars.length - 1].t,
      outOfSampleFrom: oosBars[0].t,
      outOfSampleTo: oosBars[oosBars.length - 1].t,
      bestParams,
      inSampleNetProfit: isRes.metrics.netProfit,
      inSampleSharpe: isRes.metrics.sharpeRatio,
      inSampleAnnualReturn: Math.round(isAnnualReturn * 1000) / 10,
      outOfSampleNetProfit: oosRes.metrics.netProfit,
      outOfSampleSharpe: oosRes.metrics.sharpeRatio,
      outOfSampleAnnualReturn: Math.round(oosAnnualReturn * 1000) / 10,
      wfe,
    });
  }

  const aggregateWfe =
    aggregateIsAnnual > 0
      ? Math.round((aggregateOosAnnual / aggregateIsAnnual) * 1000) / 10
      : 0;

  return {
    cycles,
    aggregateWfe,
    overallOosNetProfit: Math.round(overallOosNetProfit * 100) / 100,
    overallOosSharpe: cycles.length > 0 ? Math.round((cycles.reduce((a, b) => a + b.outOfSampleSharpe, 0) / cycles.length) * 100) / 100 : 0,
    isRobust: aggregateWfe >= 50.0,
  };
}
