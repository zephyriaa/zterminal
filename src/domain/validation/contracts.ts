/**
 * ZTerminal Validation Engine v0.1 — Contracts & Data Models
 *
 * Invariant: Every validation result is immutably linked to a parent ResearchRun
 * via sourceRunFingerprint and validationConfigHash. No magic scores (e.g. 87/100).
 */

export const VALIDATION_ENGINE_VERSION = "0.1.0" as const;
export const VALIDATION_SCHEMA_VERSION = 2 as const;

export type ValidationRating = "strong" | "moderate" | "weak" | "inconclusive";

export interface ValidationBaseline {
  initialCapital: number;
  netProfit: number;
  totalReturn: number;
  cagr: number | null;
  sharpe: number | null;
  sortino: number | null;
  maxDrawdown: number;
  profitFactor: number | null;
  winRate: number | null;
  totalTrades: number;
}

export interface OutOfSampleResult {
  splitRatio: number;
  inSampleRange: { from: number; to: number };
  outOfSampleRange: { from: number; to: number };
  purgeBars: number;
  inSampleMetrics: ValidationBaseline;
  outOfSampleMetrics: ValidationBaseline;
  degradation: {
    sharpeDelta: number | null;
    returnDelta: number;
    drawdownDelta: number;
    winRateDelta: number;
    rating: ValidationRating;
  };
}

export interface WalkForwardCycle {
  cycle: number;
  inSample: { from: number; to: number; return: number; sharpe: number | null; trades: number };
  outOfSample: { from: number; to: number; return: number; sharpe: number | null; trades: number };
  wfe: number; // Out-of-sample annual return / In-sample annual return (percentage ratio)
}

export interface WalkForwardResult {
  cycles: WalkForwardCycle[];
  aggregateWfe: number;
  positiveOosCycles: number;
  totalCycles: number;
  rating: ValidationRating;
}

export interface MonteCarloValidationResult {
  method: "trade_order_permutation" | "iid_trade_resampling";
  seed: number;
  paths: number;
  observations: number;
  terminalEquity: { p05: number; p50: number; p95: number };
  maxDrawdownPct: { p05: number; p50: number; p95: number };
  probabilityOfLoss: number;
  probabilityOfRuin: number; // Max drawdown >= 50%
  samplePaths: number[][]; // Selected sample paths downsampled to at most 50 steps
}

export interface ParameterSensitivityPoint {
  x: number;
  y: number;
  metricValue: number;
  trades: number;
}

export interface ParameterSensitivityResult {
  paramX: string;
  paramY: string;
  xValues: number[];
  yValues: number[];
  baselinePoint: { x: number; y: number; metricValue: number };
  grid: ParameterSensitivityPoint[][]; // grid[yIdx][xIdx]
  neighborDegradationRatio: number;   // Mean(8 neighbors) / Baseline
  coefficientOfVariation: number;
  surfaceClassification: "broad_plateau" | "narrow_spike" | "boundary_optimum" | "unstable_surface";
  rating: ValidationRating;
}

export interface CostTier {
  feeBps: number;
  slippageBps: number;
  totalFrictionBps: number;
  netProfit: number;
  sharpe: number | null;
  profitFactor: number | null;
  expectancy: number;
}

export interface CostStressResult {
  tiers: CostTier[];
  breakEvenFrictionBps: number | null; // Total friction; null when no positive trade notional exists
  frictionElasticity: number; // % drop in expectancy per 10 bps friction
  rating: ValidationRating;
}

export interface RegimeMetric {
  regime: string;
  label: string;
  barsCount: number;
  tradesCount: number;
  winRate: number;
  netProfit: number;
  profitContributionPct: number;
  sharpe: number | null;
}

export interface RegimeValidationResult {
  volatilityRegimes: RegimeMetric[]; // low, normal, high
  trendRegimes: RegimeMetric[];      // bull, bear, neutral
  dominantRegimePct: number;
  rating: ValidationRating;
}

export interface ConcentrationResult {
  top5TradesProfitPct: number;
  top10TradesProfitPct: number;
  giniCoefficient: number;
  herfindahlIndex: number;
  longestLossStreak: number;
  maxDrawdownDays: number;
  sampleSufficiency: "adequate" | "marginal" | "insufficient";
}

export interface ValidationProfile {
  oosPersistence: ValidationRating;
  parameterStability: ValidationRating;
  frictionResilience: ValidationRating;
  regimeBreadth: ValidationRating;
  sampleAdequacy: ValidationRating;
}

export interface ValidationDiagnostic {
  id: string;
  category: "oos" | "sensitivity" | "cost" | "regime" | "concentration" | "sample";
  severity: "info" | "warning" | "critical";
  headline: string;
  detail: string;
  metricValue?: number | string;
}

export interface ValidationConfig {
  oosSplitRatio: number; // e.g. 0.70
  purgeBars: number;     // e.g. 1
  monteCarloPaths: number; // e.g. 1000
  monteCarloSeed: number;  // e.g. 42
  monteCarloMethod: "trade_order_permutation" | "iid_trade_resampling";
  costTiersBps: number[];  // added friction on top of baseline: [0, 5, 10, 20, 30]
  sensitivityGrid?: {
    paramX: { name: string; min: number; max: number; steps: number };
    paramY: { name: string; min: number; max: number; steps: number };
  };
}

export interface ValidationResult {
  version: typeof VALIDATION_SCHEMA_VERSION;
  id: string;
  sourceRunId: string;
  createdAt: number;
  provenance: {
    sourceRunFingerprint: string;
    validationConfigHash: string;
    engineVersion: typeof VALIDATION_ENGINE_VERSION;
  };
  config: ValidationConfig;
  baseline: ValidationBaseline;
  outOfSample?: OutOfSampleResult;
  walkForward?: WalkForwardResult;
  monteCarlo?: MonteCarloValidationResult;
  sensitivity?: ParameterSensitivityResult;
  costStress: CostStressResult;
  regimes: RegimeValidationResult;
  concentration: ConcentrationResult;
  profile: ValidationProfile;
  diagnostics: ValidationDiagnostic[];
}

export function defaultValidationConfig(): ValidationConfig {
  return {
    oosSplitRatio: 0.70,
    purgeBars: 1,
    monteCarloPaths: 1000,
    monteCarloSeed: 42,
    monteCarloMethod: "trade_order_permutation",
    costTiersBps: [0, 5, 10, 20, 30],
  };
}
