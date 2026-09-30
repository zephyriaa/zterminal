/**
 * ZTerminal Validation Engine v0.1 — Contracts & Data Models
 *
 * Invariant: Every validation result is immutably linked to a parent ResearchRun
 * via sourceRunFingerprint and validationConfigHash. No magic scores (e.g. 87/100).
 */

export const VALIDATION_ENGINE_VERSION = "0.2.0" as const;
export const VALIDATION_SCHEMA_VERSION = 4 as const;

export type ValidationRating = "strong" | "moderate" | "weak" | "inconclusive";
export type ValidationTab = "Summary" | "OOS" | "Walk Forward" | "Monte Carlo" | "Sensitivity" | "Costs" | "Regimes" | "Concentration" | "Diagnostics" | "Provenance";

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
  inSampleRun: { id: string; resultHash: string };
  outOfSampleRun: { id: string; resultHash: string };
  inSampleRange: { from: number; to: number };
  outOfSampleRange: { from: number; to: number };
  inSampleObservations: number;
  outOfSampleObservations: number;
  purgeBars: number;
  inSampleMetrics: ValidationBaseline;
  outOfSampleMetrics: ValidationBaseline;
  degradation: {
    sharpeDelta: number | null;
    drawdownDelta: number;
    winRateDelta: number | null;
    rating: ValidationRating;
  };
}

export interface WalkForwardCycle {
  cycle: number;
  inSample: { from: number; to: number; return: number; sharpe: number | null; trades: number; observations: number; run: { id: string; resultHash: string } };
  outOfSample: { from: number; to: number; return: number; sharpe: number | null; trades: number; observations: number; run: { id: string; resultHash: string } };
  selectedParams: Record<string, string | number | boolean>;
  trainingCandidates: { id: string; resultHash: string }[];
  wfe: number | null; // OOS / IS return per unit time; unavailable for nonpositive IS return
}

export interface WalkForwardResult {
  cycles: WalkForwardCycle[];
  aggregateWfe: number | null;
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
  neighborDegradationRatio: number | null; // Mean local neighbors / best grid cell
  coefficientOfVariation: number | null;
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
  expectancy: number | null;
  totalReturn?: number;
  finalEquity?: number;
  totalTrades?: number;
  winRate?: number | null;
  run?: { id: string; resultHash: string };
}

export interface CostStressResult {
  tiers: CostTier[];
  breakEvenFrictionBps: number | null; // Total friction; null when no positive trade notional exists
  breakEvenBracketBps?: [number, number] | null;
  frictionElasticity: number | null; // Measured % drop in expectancy at exactly +10 bps
  rating: ValidationRating;
}

export interface RegimeMetric {
  regime: string;
  label: string;
  barsCount: number;
  tradesCount: number;
  winRate: number | null;
  netProfit: number;
  profitContributionPct: number | null;
  sharpe: number | null;
}

export interface RegimeValidationResult {
  volatilityRegimes: RegimeMetric[]; // low, normal, high
  trendRegimes: RegimeMetric[];      // bull, bear, neutral
  dominantRegimePct: number | null;
  rating: ValidationRating;
}

export interface ConcentrationResult {
  top5TradesProfitPct: number | null;
  top10TradesProfitPct: number | null;
  giniCoefficient: number | null;
  herfindahlIndex: number | null;
  longestLossStreak: number;
  maxDrawdownDays: number;
  sampleSufficiency: "adequate" | "marginal" | "insufficient";
  largestWinnerContributionPct?: number | null;
  periods?: { group: string; trades: number; netProfit: number; grossWinningPnl: number; grossWinningContributionPct: number | null }[];
  directions?: { group: string; trades: number; netProfit: number; grossWinningPnl: number; grossWinningContributionPct: number | null }[];
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
  version: 1;
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
  walkForward?: { trainingBars: number; testingBars: number; stepBars: number; optimize: boolean };
  regimes?: { volatilityWindow: 20; historyWindow: 100; trendFast: 20; trendSlow: 50; neutralFraction: 0.001; attribution: "previous_closed_bar"; thresholds: "trailing_tertiles" };
}

export interface ValidationResult {
  version: typeof VALIDATION_SCHEMA_VERSION;
  id: string;
  sourceRunId: string;
  createdAt: number;
  resultHash: string;
  evidenceRuns: Record<string, { id: string; resultHash: string }>;
  provenance: {
    sourceRunFingerprint: string;
    validationConfigHash: string;
    engineVersion: typeof VALIDATION_ENGINE_VERSION;
    fingerprint: string;
    runtime: Record<string, string>;
    execution: "helper_fresh_cpython_processes";
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
  sample: { observations: number; durationDays: number; closedTrades: number; laterClosedTrades: number | null; volatilityKnownObservations: number; volatilityCoverageFraction: number };
}

/** Retained historical evidence. Integrity is separate from recipient reproduction. */
export interface ResearchEvidenceBundle {
  version: 1;
  kind: "zterminal_research_evidence";
  exportedAt: number;
  validation: ValidationResult;
  runs: import("@/lib/local-research/contracts").ResearchResult[];
  manifest: { validationId: string; validationHash: string; validationFingerprint: string; sourceRunId: string; sourceRunFingerprint: string; validationConfigHash: string; runs: { id: string; resultHash: string; sourceHash: string; datasetHash: string; payloadHash: string }[] };
  graphFingerprint: string;
  bundleHash: string;
  limitations: string[];
}

export function defaultValidationConfig(): ValidationConfig {
  return {
    version: 1,
    oosSplitRatio: 0.70,
    purgeBars: 1,
    monteCarloPaths: 1000,
    monteCarloSeed: 42,
    monteCarloMethod: "trade_order_permutation",
    costTiersBps: [0, 5, 10, 20, 30],
  };
}
