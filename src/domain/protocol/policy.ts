import type {
  BaselineFingerprintInput,
  GeneratedStrategyArtifact,
  ProtocolStage,
  RuleSpecRevision,
  SampleAdequacy,
  ScopeViolation,
  VariableChange,
} from "./types";

const TRANSITIONS: Record<ProtocolStage, ProtocolStage[]> = {
  DRAFT: ["NEEDS_SOURCE", "NEEDS_RULE_CLARIFICATION", "READY_FOR_DATA_REVIEW", "PAUSED", "ARCHIVED"],
  NEEDS_SOURCE: ["NEEDS_RULE_CLARIFICATION", "READY_FOR_DATA_REVIEW", "PAUSED", "ARCHIVED"],
  NEEDS_RULE_CLARIFICATION: ["NEEDS_SOURCE", "READY_FOR_DATA_REVIEW", "PAUSED", "ARCHIVED"],
  READY_FOR_DATA_REVIEW: ["READY_FOR_GENERATION", "NEEDS_RULE_CLARIFICATION", "PAUSED", "ARCHIVED"],
  READY_FOR_GENERATION: ["BASELINE_RUNNING", "NEEDS_RULE_CLARIFICATION", "PAUSED", "ARCHIVED"],
  BASELINE_RUNNING: ["BASELINE_REVIEWED", "PAUSED", "ARCHIVED"],
  BASELINE_REVIEWED: ["INCREMENTAL_RESEARCH", "PAUSED", "ARCHIVED"],
  INCREMENTAL_RESEARCH: ["PAUSED", "ARCHIVED"],
  PAUSED: ["NEEDS_SOURCE", "NEEDS_RULE_CLARIFICATION", "READY_FOR_DATA_REVIEW", "READY_FOR_GENERATION", "BASELINE_REVIEWED", "INCREMENTAL_RESEARCH", "ARCHIVED"],
  ARCHIVED: [],
};

const EXTRA_PATTERNS: Array<{ code: ScopeViolation["code"]; pattern: RegExp; message: string }> = [
  { code: "EXTRA_FILTER", pattern: /\b(filter|only trade when|confirmation|confirming|exclude|avoid)\b/i, message: "Extra filters belong in Stage 6, not the three-rule baseline." },
  { code: "REGIME_GATE", pattern: /\b(regime|volatility regime|trend regime|bull market|bear market)\b/i, message: "Regime conditions are deferred complexity and cannot enter the baseline." },
  { code: "MULTI_TIMEFRAME", pattern: /\b(multi[- ]?timeframe|higher timeframe|lower timeframe|1h.*15m|15m.*1h)\b/i, message: "Multi-timeframe confirmation is deferred complexity and cannot enter the baseline." },
  { code: "PARAMETER_RANGE", pattern: /\b(range|between\s+\d|from\s+\d+\s+to\s+\d|\d+\s*(?:to|–|-)\s*\d+)\b/i, message: "Parameter ranges imply tuning and cannot enter the baseline." },
  { code: "OPTIMIZATION", pattern: /\b(optimiz(?:e|ation|ing)?|grid search|best parameter|tune|curve.?fit)\b/i, message: "Optimization language is prohibited before baseline review." },
  { code: "MULTIPLE_ALTERNATIVES", pattern: /\b(either|or alternatively|option a|option b)\b/i, message: "The baseline needs one unambiguous rule, not alternatives." },
];

const AMBIGUITY_PATTERN = /\b(appropriate|significant|strong|weak|normal|reasonable|etc\.?|as needed)\b/i;

export function stableHash(value: unknown): string {
  const text = JSON.stringify(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `ip_${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function validateCitation(citation: { title: string; author: string; year: number; reference: string; sourceText: string }): string[] {
  const failures: string[] = [];
  if (!citation.title.trim()) failures.push("Source title is required.");
  if (!citation.author.trim()) failures.push("At least one source author is required.");
  if (!Number.isInteger(citation.year) || citation.year < 1600 || citation.year > new Date().getUTCFullYear()) failures.push("Publication year must be a valid historical year.");
  if (!citation.reference.trim()) failures.push("A DOI, arXiv identifier, URL, or document reference is required.");
  if (!citation.sourceText.trim()) failures.push("Source text or a retained evidence excerpt is required before rule extraction.");
  return failures;
}

export function validateRuleScope(input: Pick<RuleSpecRevision, "entry" | "exit" | "sizing">): ScopeViolation[] {
  const violations: ScopeViolation[] = [];
  for (const field of ["entry", "exit", "sizing"] as const) {
    const value = input[field].trim();
    if (!value) {
      violations.push({ field, code: "MISSING", message: `${field[0].toUpperCase()}${field.slice(1)} rule is required.` });
      continue;
    }
    for (const rule of EXTRA_PATTERNS) {
      const match = value.match(rule.pattern);
      if (match) violations.push({ field, code: rule.code, message: rule.message, fragment: match[0] });
    }
    const ambiguity = value.match(AMBIGUITY_PATTERN);
    if (ambiguity) violations.push({ field, code: "AMBIGUITY", message: "Ambiguous wording must be resolved before code generation.", fragment: ambiguity[0] });
  }
  return violations;
}

export function canTransition(from: ProtocolStage, to: ProtocolStage): boolean {
  return TRANSITIONS[from].includes(to);
}

export function canGenerate(revision: RuleSpecRevision, dataReady: boolean): { ok: boolean; reason?: string } {
  if (revision.scopeViolations.length) return { ok: false, reason: "Resolve all rule-scope and ambiguity violations before generation." };
  if (!dataReady) return { ok: false, reason: "Complete a data assessment and select a verified dataset before generation." };
  return { ok: true };
}

export function canApproveArtifact(artifact: GeneratedStrategyArtifact): { ok: boolean; reason?: string } {
  if (artifact.extrasDetected.length) return { ok: false, reason: "Generated code contains undeclared behavior and cannot be approved." };
  if (artifact.unsupportedRequirements.length) return { ok: false, reason: "Generated code has unsupported requirements that must be resolved first." };
  if (artifact.assumptions.some((assumption) => !assumption.approved)) return { ok: false, reason: "Every interpretation assumption must be explicitly approved." };
  return { ok: true };
}

export function baselineFingerprint(input: BaselineFingerprintInput): string {
  return stableHash({
    protocol: "institutional-baseline-v1",
    ruleSpecRevisionHash: input.ruleSpecRevisionHash,
    generatedArtifactHash: input.generatedArtifactHash,
    datasetIdentity: input.datasetIdentity,
    executionModel: input.executionModel,
    costModel: input.costModel,
    initialCapital: input.initialCapital,
    positionSize: input.positionSize,
  });
}

export function validateSingleVariableChange(changes: VariableChange[]): { ok: boolean; reason?: string } {
  if (changes.length !== 1) return { ok: false, reason: "Incremental research requires exactly one declared variable change." };
  const [change] = changes;
  if (!change.label.trim() || !change.before.trim() || !change.after.trim() || !change.rationale.trim()) {
    return { ok: false, reason: "The one variable change must include a label, before/after values, and rationale." };
  }
  if (change.before === change.after) return { ok: false, reason: "The proposed variable change does not alter the parent configuration." };
  return { ok: true };
}

export function wilsonInterval(successes: number, trials: number, z = 1.96): { lower: number; upper: number } {
  if (!Number.isFinite(successes) || !Number.isFinite(trials) || trials <= 0) return { lower: 0, upper: 0 };
  const n = Math.floor(trials);
  const p = Math.max(0, Math.min(1, successes / n));
  const denominator = 1 + (z * z) / n;
  const centre = (p + (z * z) / (2 * n)) / denominator;
  const margin = (z * Math.sqrt((p * (1 - p) + (z * z) / (4 * n)) / n)) / denominator;
  return { lower: Math.max(0, centre - margin), upper: Math.min(1, centre + margin) };
}

export function assessSampleAdequacy(winners: number, totalTrades: number): SampleAdequacy {
  const hitRate = totalTrades > 0 ? winners / totalTrades : 0;
  const hitRateInterval = wilsonInterval(winners, totalTrades);
  if (totalTrades < 30) {
    return { sampleSize: totalTrades, hitRate, confidenceLevel: 0.95, hitRateInterval, status: "INSUFFICIENT", reason: "Fewer than 30 completed trades; the hit-rate estimate is highly unstable." };
  }
  if (totalTrades < 100) {
    return { sampleSize: totalTrades, hitRate, confidenceLevel: 0.95, hitRateInterval, status: "LIMITED", reason: "Fewer than 100 completed trades; interpret the 95% hit-rate interval cautiously." };
  }
  return { sampleSize: totalTrades, hitRate, confidenceLevel: 0.95, hitRateInterval, status: "INFORMATIVE", reason: "At least 100 completed trades; confidence remains conditional on data quality and non-stationarity." };
}
