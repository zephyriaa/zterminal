export const RESEARCH_SOURCE_TYPES = ["DOI", "ARXIV", "URL", "PDF", "PASTED_TEXT"] as const;
export type ResearchSourceType = (typeof RESEARCH_SOURCE_TYPES)[number];
export type DataCoverage = "NATIVE_VERIFIED" | "IMPORT_REQUIRED" | "UNAVAILABLE" | "AMBIGUOUS";
export type ProtocolStage = "DRAFT" | "NEEDS_SOURCE" | "NEEDS_RULE_CLARIFICATION" | "READY_FOR_DATA_REVIEW" | "READY_FOR_APPROVAL" | "BASELINE_LOCKED" | "INCREMENTAL_RESEARCH";

export type ResearchCitation = {
  title: string;
  author: string;
  year: number;
  sourceType: ResearchSourceType;
  reference: string;
  sourceText: string;
  rightsNote?: string;
};

export type RuleSpec = {
  entry: string;
  exit: string;
  sizing: string;
};

export type ScopeViolation = {
  field: keyof RuleSpec;
  code: "MISSING" | "EXTRA_FILTER" | "REGIME_GATE" | "MULTI_TIMEFRAME" | "PARAMETER_RANGE" | "OPTIMIZATION" | "MULTIPLE_ALTERNATIVES" | "AMBIGUITY";
  message: string;
  fragment?: string;
};

export type DataRequirement = {
  id: string;
  label: string;
  coverage: DataCoverage;
  detail: string;
  risk: string;
};

export type ResearchDatasetContext = {
  provider: string;
  symbol: string;
  interval: string;
  coverageComplete: boolean;
  returnedBars: number;
  sourceTimestamp: number | null;
  fingerprint: string | null;
};

export type BaselineInput = {
  citation: ResearchCitation;
  rules: RuleSpec;
  dataset: ResearchDatasetContext | null;
  executionModel: string;
  costModel: string;
  initialCapital: number;
  positionSize: number;
};

export type BaselineCandidate = {
  stage: ProtocolStage;
  citationFailures: string[];
  scopeViolations: ScopeViolation[];
  dataRequirements: DataRequirement[];
  fingerprint: string | null;
  blockers: string[];
};

export type LockedBaseline = {
  fingerprint: string;
  citation: ResearchCitation;
  rules: RuleSpec;
  dataset: ResearchDatasetContext;
  executionModel: string;
  costModel: string;
  initialCapital: number;
  positionSize: number;
  lockedAt: number;
};

export type VariableChange = {
  field: keyof RuleSpec | "executionModel" | "costModel" | "initialCapital" | "positionSize";
  before: string;
  after: string;
  rationale: string;
};

function normalized(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function hashString(value: string) {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function canonicalBaselinePayload(input: BaselineInput) {
  return JSON.stringify({
    protocol: "zterminal-protocol-v1",
    citation: {
      title: normalized(input.citation.title), author: normalized(input.citation.author), year: input.citation.year,
      sourceType: input.citation.sourceType, reference: normalized(input.citation.reference), sourceText: normalized(input.citation.sourceText),
    },
    rules: { entry: normalized(input.rules.entry), exit: normalized(input.rules.exit), sizing: normalized(input.rules.sizing) },
    dataset: input.dataset ? {
      provider: input.dataset.provider, symbol: input.dataset.symbol, interval: input.dataset.interval,
      coverageComplete: input.dataset.coverageComplete, returnedBars: input.dataset.returnedBars,
      sourceTimestamp: input.dataset.sourceTimestamp, fingerprint: input.dataset.fingerprint,
    } : null,
    executionModel: input.executionModel, costModel: input.costModel, initialCapital: input.initialCapital, positionSize: input.positionSize,
  });
}

export function validateCitation(citation: ResearchCitation, currentYear = new Date().getUTCFullYear()): string[] {
  const failures: string[] = [];
  if (!normalized(citation.title)) failures.push("A source title is required.");
  if (!normalized(citation.author)) failures.push("A source author or organization is required.");
  if (!Number.isInteger(citation.year) || citation.year < 1600 || citation.year > currentYear) failures.push("Publication year must be a valid historical year.");
  if (!normalized(citation.reference)) failures.push("A DOI, arXiv identifier, URL, file reference, or retained-source reference is required.");
  if (!normalized(citation.sourceText)) failures.push("Retained source text or a reviewer-confirmed evidence excerpt is required before rule extraction.");
  const reference = normalized(citation.reference);
  if (reference && citation.sourceType === "DOI" && !/^10\.\d{4,9}\/.+$/i.test(reference)) failures.push("DOI citations must use a DOI identifier beginning with `10.`.");
  if (reference && citation.sourceType === "ARXIV" && !/^\d{4}\.\d{4,5}(?:v\d+)?$/i.test(reference)) failures.push("arXiv citations must use a canonical identifier such as `2401.01234`.");
  if (reference && citation.sourceType === "URL" && !/^https?:\/\//i.test(reference)) failures.push("URL citations must include an http:// or https:// scheme.");
  return failures;
}

const EXTRA_PATTERNS: Array<{ code: ScopeViolation["code"]; pattern: RegExp; message: string }> = [
  { code: "OPTIMIZATION", pattern: /\b(optimi[sz]e|grid\s*search|parameter\s*search|best\s+(?:period|setting)|curve\s*fit)\b/i, message: "Optimization language is outside a fixed baseline rule." },
  { code: "PARAMETER_RANGE", pattern: /\b\d+\s*(?:to|[-–])\s*\d+\b/i, message: "Parameter ranges must be resolved to one fixed value before baseline locking." },
  { code: "MULTI_TIMEFRAME", pattern: /\b(multi[-\s]?timeframe|higher\s+timeframe|lower\s+timeframe|confirm(?:ation)?\s+timeframe)\b/i, message: "Multi-timeframe logic is a separate declared research variable." },
  { code: "REGIME_GATE", pattern: /\b(regime|bull(?:ish)?\s+market|bear(?:ish)?\s+market|high\s+volatility|low\s+volatility)\b/i, message: "Regime gating must be declared as a later one-variable experiment." },
  { code: "EXTRA_FILTER", pattern: /\b(rsi|macd|bollinger|volume\s+filter|news\s+filter|fundamental\s+filter)\b/i, message: "An additional filter is outside the stated single-rule baseline." },
  { code: "MULTIPLE_ALTERNATIVES", pattern: /\b(and\/or|either\b.*\bor\b|alternatively)\b/i, message: "Multiple alternative rules must be resolved before baseline locking." },
];

const AMBIGUITY_PATTERN = /\b(maybe|approximately|around|etc\.?|as\s+appropriate|if\s+needed)\b/i;

export function validateRuleScope(rules: RuleSpec): ScopeViolation[] {
  const violations: ScopeViolation[] = [];
  for (const field of ["entry", "exit", "sizing"] as const) {
    const value = normalized(rules[field]);
    if (!value) {
      violations.push({ field, code: "MISSING", message: `${field[0].toUpperCase()}${field.slice(1)} rule is required.` });
      continue;
    }
    for (const rule of EXTRA_PATTERNS) {
      const match = value.match(rule.pattern);
      if (match) violations.push({ field, code: rule.code, message: rule.message, fragment: match[0] });
    }
    const ambiguity = value.match(AMBIGUITY_PATTERN);
    if (ambiguity) violations.push({ field, code: "AMBIGUITY", message: "Ambiguous wording must be resolved before baseline locking.", fragment: ambiguity[0] });
  }
  return violations;
}

export function resolveDataRequirements(rules: RuleSpec, dataset: ResearchDatasetContext | null): DataRequirement[] {
  const combined = `${rules.entry}\n${rules.exit}\n${rules.sizing}`;
  const requirements: DataRequirement[] = [];
  requirements.push({
    id: "instrument", label: "Instrument", coverage: dataset?.symbol ? "NATIVE_VERIFIED" : "AMBIGUOUS",
    detail: dataset?.symbol ? `Selected dataset is bound to ${dataset.provider} ${dataset.symbol}.` : "No verified market dataset is selected.",
    risk: dataset?.symbol ? "Coverage remains limited to the selected provider contract." : "Select one verified instrument before baseline locking.",
  });
  requirements.push({
    id: "timeframe", label: "Timeframe", coverage: dataset?.interval ? "NATIVE_VERIFIED" : "AMBIGUOUS",
    detail: dataset?.interval ? `Selected dataset uses ${dataset.interval} bars.` : "No verified bar interval is selected.",
    risk: dataset?.interval ? "The interval is immutable for this baseline." : "An undefined interval makes a result non-reproducible.",
  });
  requirements.push({
    id: "historical-bars", label: "Historical OHLCV bars", coverage: dataset?.coverageComplete && (dataset.returnedBars ?? 0) > 1 ? "NATIVE_VERIFIED" : "AMBIGUOUS",
    detail: dataset?.coverageComplete ? `${dataset.returnedBars} verified bars are available in the current requested range.` : "The current requested history is partial or unavailable.",
    risk: "Coverage gaps and provider corrections remain part of result provenance.",
  });
  if (/\b(order\s*flow|footprint|market\s*by\s*order|\bmbo\b|level\s*2)\b/i.test(combined)) requirements.push({
    id: "order-flow-history", label: "Historical order-flow series", coverage: "IMPORT_REQUIRED",
    detail: "The current bounded public live tape cannot provide historical order-flow research coverage.",
    risk: "A versioned external dataset with coverage and license evidence is required.",
  });
  if (/\b(options?\s*flow|implied\s*volatility|\biv\b|open\s*interest|\bgex\b)\b/i.test(combined)) requirements.push({
    id: "options-history", label: "Options / derivatives series", coverage: "IMPORT_REQUIRED",
    detail: "Gate.io perpetual bars do not provide required options-chain or Greek inputs.",
    risk: "A licensed options dataset and methodology are required.",
  });
  if (/\b(session|rth|overnight|new\s*york|london|\butc\b)\b/i.test(combined)) requirements.push({
    id: "session-policy", label: "Session policy", coverage: "AMBIGUOUS",
    detail: "The rule references sessions but does not declare an exchange/session-timezone policy.",
    risk: "Session boundaries cannot be silently inferred.",
  });
  return requirements;
}

export function dataAssessmentReady(requirements: DataRequirement[]) {
  return requirements.length > 0 && requirements.every(requirement => requirement.coverage === "NATIVE_VERIFIED");
}

export function buildBaselineCandidate(input: BaselineInput): BaselineCandidate {
  const citationFailures = validateCitation(input.citation);
  const scopeViolations = validateRuleScope(input.rules);
  const dataRequirements = resolveDataRequirements(input.rules, input.dataset);
  const blockers = [
    ...citationFailures,
    ...scopeViolations.map(violation => violation.message),
    ...(!dataAssessmentReady(dataRequirements) ? ["Resolve all data requirements against the selected verified dataset before baseline locking."] : []),
    ...(!input.dataset?.fingerprint ? ["The selected dataset requires a stable fingerprint before baseline locking."] : []),
    ...(!Number.isFinite(input.initialCapital) || input.initialCapital <= 0 ? ["Initial capital must be a positive finite value."] : []),
    ...(!Number.isFinite(input.positionSize) || input.positionSize <= 0 ? ["Position size must be a positive finite value."] : []),
    ...(!normalized(input.executionModel) ? ["An explicit execution model is required."] : []),
    ...(!normalized(input.costModel) ? ["An explicit cost model is required."] : []),
  ];
  const ready = blockers.length === 0 && input.dataset !== null;
  return {
    stage: citationFailures.length ? "NEEDS_SOURCE" : scopeViolations.length ? "NEEDS_RULE_CLARIFICATION" : !ready ? "READY_FOR_DATA_REVIEW" : "READY_FOR_APPROVAL",
    citationFailures, scopeViolations, dataRequirements, blockers,
    fingerprint: ready ? hashString(canonicalBaselinePayload(input)) : null,
  };
}

/** Locks a complete protocol snapshot only after an explicit human approval signal. */
export function lockBaseline(input: BaselineInput, candidate: BaselineCandidate, humanApproved: boolean, now = Date.now()): { locked: LockedBaseline | null; reason: string | null } {
  if (!candidate.fingerprint || !input.dataset) return { locked: null, reason: "A complete cited, scoped, and verified-data baseline is required before locking." };
  if (!humanApproved) return { locked: null, reason: "A human must explicitly approve this immutable baseline before it can be locked." };
  return {
    locked: {
      fingerprint: candidate.fingerprint, citation: { ...input.citation }, rules: { ...input.rules }, dataset: { ...input.dataset },
      executionModel: input.executionModel, costModel: input.costModel, initialCapital: input.initialCapital, positionSize: input.positionSize, lockedAt: now,
    },
    reason: null,
  };
}

/** Enforces the protocol rule that every post-baseline experiment names one meaningful, changed variable. */
export function validateSingleVariableExperiment(baseline: LockedBaseline | null, changes: VariableChange[]): { ok: boolean; reason: string | null } {
  if (!baseline) return { ok: false, reason: "Lock an approved baseline before staging an incremental experiment." };
  if (changes.length !== 1) return { ok: false, reason: "Incremental research requires exactly one declared variable change." };
  const change = changes[0];
  if (!normalized(change.before) || !normalized(change.after) || !normalized(change.rationale)) return { ok: false, reason: "The variable change must include before/after values and a rationale." };
  if (normalized(change.before) === normalized(change.after)) return { ok: false, reason: "The proposed variable does not alter the locked baseline." };
  return { ok: true, reason: null };
}
