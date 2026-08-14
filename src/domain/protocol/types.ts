export const PROTOCOL_STAGES = [
  "DRAFT",
  "NEEDS_SOURCE",
  "NEEDS_RULE_CLARIFICATION",
  "READY_FOR_DATA_REVIEW",
  "READY_FOR_GENERATION",
  "BASELINE_RUNNING",
  "BASELINE_REVIEWED",
  "INCREMENTAL_RESEARCH",
  "PAUSED",
  "ARCHIVED",
] as const;

export type ProtocolStage = (typeof PROTOCOL_STAGES)[number];
export type ResearchSourceType = "DOI" | "ARXIV" | "URL" | "PASTED_TEXT" | "PDF";
export type DataCoverage = "NATIVE_VERIFIED" | "IMPORT_REQUIRED" | "UNAVAILABLE" | "AMBIGUOUS";
export type ArtifactApproval = "PENDING_ASSUMPTIONS" | "APPROVED" | "REJECTED";
export type ProtocolRunClass = "BASELINE" | "INCREMENTAL";

export interface ResearchCitation {
  title: string;
  author: string;
  year: number;
  sourceType: ResearchSourceType;
  reference: string;
  sourceText: string;
  rightsNote?: string;
}

export interface SourceExcerpt {
  id: string;
  locator: string;
  text: string;
  reviewerConfirmed: boolean;
}

export interface ScopeViolation {
  field: "entry" | "exit" | "sizing" | "source";
  code: "MISSING" | "EXTRA_FILTER" | "REGIME_GATE" | "MULTI_TIMEFRAME" | "PARAMETER_RANGE" | "OPTIMIZATION" | "MULTIPLE_ALTERNATIVES" | "AMBIGUITY";
  message: string;
  fragment?: string;
}

export interface RuleSpecRevision {
  id: string;
  revision: number;
  entry: string;
  exit: string;
  sizing: string;
  sourceExcerptIds: string[];
  deferredVariables: string[];
  scopeViolations: ScopeViolation[];
  hash: string;
  createdAt: string;
}

export interface DataRequirement {
  id: string;
  label: string;
  category: "INSTRUMENT" | "BARS" | "TIMEFRAME" | "LOOKBACK" | "SESSION" | "SPECIAL_SERIES";
  coverage: DataCoverage;
  detail: string;
  risk: string;
}

export interface DataAssessment {
  id: string;
  ruleSpecRevisionId: string;
  requirements: DataRequirement[];
  selectedDataset: {
    provider: string;
    symbol: string;
    timeframe: string;
    source: "GATEIO_HISTORICAL" | "CSV_IMPORT";
    qualityWarnings: string[];
  } | null;
  readyForGeneration: boolean;
  createdAt: string;
}

export interface GenerationAssumption {
  id: string;
  question: string;
  resolution: string;
  approved: boolean;
}

export interface GeneratedStrategyArtifact {
  id: string;
  ruleSpecRevisionId: string;
  source: string;
  semanticManifest: {
    entry: string;
    exit: string;
    sizing: string;
  };
  assumptions: GenerationAssumption[];
  unsupportedRequirements: string[];
  extrasDetected: string[];
  approval: ArtifactApproval;
  hash: string;
  createdAt: string;
}

export interface BaselineFingerprintInput {
  ruleSpecRevisionHash: string;
  generatedArtifactHash: string;
  datasetIdentity: string;
  executionModel: string;
  costModel: string;
  initialCapital: number;
  positionSize: number;
}

export interface SampleAdequacy {
  sampleSize: number;
  hitRate: number;
  confidenceLevel: number;
  hitRateInterval: { lower: number; upper: number };
  status: "INSUFFICIENT" | "LIMITED" | "INFORMATIVE";
  reason: string;
}

export interface VariableChange {
  id: string;
  label: string;
  kind: "FILTER" | "REGIME" | "TIMEFRAME" | "SIZING" | "OTHER";
  before: string;
  after: string;
  rationale: string;
}

export interface ProtocolRunRecord {
  id: string;
  runClass: ProtocolRunClass;
  fingerprint: string;
  ruleSpecRevisionId: string;
  generatedArtifactId: string;
  parentRunId: string | null;
  variableChange: VariableChange | null;
  resultHash: string;
  metrics: {
    totalTrades: number;
    winRate: number;
    avgWin: number;
    avgLoss: number;
    expectancy: number;
    maxDrawdown: number;
    netProfit: number;
  };
  adequacy: SampleAdequacy;
  provenanceWarnings: string[];
  createdAt: string;
}

export interface ProtocolDecision {
  id: string;
  type: "SOURCE_CONFIRMED" | "RULE_APPROVED" | "ASSUMPTIONS_APPROVED" | "BASELINE_REVIEWED" | "VARIABLE_ACCEPTED" | "VARIABLE_REJECTED";
  detail: string;
  createdAt: string;
}

export interface ProtocolProject {
  id: string;
  name: string;
  stage: ProtocolStage;
  citation: ResearchCitation;
  excerpts: SourceExcerpt[];
  revisions: RuleSpecRevision[];
  assessments: DataAssessment[];
  artifacts: GeneratedStrategyArtifact[];
  runs: ProtocolRunRecord[];
  pendingVariableChange: VariableChange | null;
  decisions: ProtocolDecision[];
  createdAt: string;
  updatedAt: string;
}
