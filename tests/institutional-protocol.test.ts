import assert from "node:assert/strict";
import test from "node:test";
import { dataAssessmentReady, resolveDataRequirements } from "../src/domain/protocol/data-assessment";
import {
  assessSampleAdequacy,
  baselineFingerprint,
  canApproveArtifact,
  canGenerate,
  canTransition,
  validateCitation,
  validateRuleScope,
  validateSingleVariableChange,
} from "../src/domain/protocol/policy";
import type { GeneratedStrategyArtifact, RuleSpecRevision, VariableChange } from "../src/domain/protocol/types";

const cleanRules: RuleSpecRevision = {
  id: "revision-1",
  revision: 1,
  entry: "Enter long when QQQX_USDT closes above its prior 5m high.",
  exit: "Exit at the next 5m close after a close below the prior 5m low.",
  sizing: "Trade exactly one native contract.",
  sourceExcerptIds: ["excerpt-1"],
  deferredVariables: [],
  scopeViolations: [],
  hash: "ip_rules",
  createdAt: "2026-08-14T00:00:00.000Z",
};

function artifact(overrides: Partial<GeneratedStrategyArtifact> = {}): GeneratedStrategyArtifact {
  return {
    id: "artifact-1",
    ruleSpecRevisionId: cleanRules.id,
    source: "strategy protocol\nentry long when close > high[1]\nexit when close < low[1]",
    semanticManifest: { entry: cleanRules.entry, exit: cleanRules.exit, sizing: cleanRules.sizing },
    assumptions: [{ id: "a-1", question: "Use next bar close for exit", resolution: "next bar close", approved: true }],
    unsupportedRequirements: [],
    extrasDetected: [],
    approval: "PENDING_ASSUMPTIONS",
    hash: "ip_artifact",
    createdAt: "2026-08-14T00:00:00.000Z",
    ...overrides,
  };
}

test("Institutional Protocol requires a complete, retained academic citation", () => {
  assert.equal(validateCitation({ title: "", author: "", year: 99, reference: "", sourceText: "" }).length, 5);
  assert.deepEqual(validateCitation({ title: "Paper", author: "Researcher", year: 2024, reference: "https://doi.org/example", sourceText: "Method" }), []);
});

test("Institutional Protocol scope blocks filters, regimes, ranges, optimization, alternatives, and ambiguity", () => {
  const violations = validateRuleScope({
    entry: "Enter when the 5m close is above the high, only trade when the trend regime is strong.",
    exit: "Optimize between 5 and 20 bars, either exit at close or next open.",
    sizing: "Use a reasonable quantity.",
  });
  assert.ok(violations.some((item) => item.code === "EXTRA_FILTER"));
  assert.ok(violations.some((item) => item.code === "REGIME_GATE"));
  assert.ok(violations.some((item) => item.code === "OPTIMIZATION"));
  assert.ok(violations.some((item) => item.code === "MULTIPLE_ALTERNATIVES"));
  assert.ok(violations.some((item) => item.code === "AMBIGUITY"));
  assert.deepEqual(validateRuleScope(cleanRules), []);
});

test("Institutional Protocol stage transitions and generation approval enforce the workflow order", () => {
  assert.equal(canTransition("READY_FOR_DATA_REVIEW", "READY_FOR_GENERATION"), true);
  assert.equal(canTransition("DRAFT", "BASELINE_RUNNING"), false);
  assert.equal(canGenerate(cleanRules, true).ok, true);
  assert.equal(canGenerate({ ...cleanRules, scopeViolations: [{ field: "entry", code: "EXTRA_FILTER", message: "blocked" }] }, true).ok, false);
  assert.equal(canApproveArtifact(artifact()).ok, true);
  assert.equal(canApproveArtifact(artifact({ extrasDetected: ["EMA filter"] })).ok, false);
  assert.equal(canApproveArtifact(artifact({ assumptions: [{ id: "a-1", question: "Unclear", resolution: "", approved: false }] })).ok, false);
});

test("baseline fingerprints are deterministic and change when a protected baseline input changes", () => {
  const input = { ruleSpecRevisionHash: "rules", generatedArtifactHash: "code", datasetIdentity: "dataset", executionModel: "next-bar-open", costModel: "commission:1|slippage:1", initialCapital: 10000, positionSize: 1 };
  assert.equal(baselineFingerprint(input), baselineFingerprint(input));
  assert.notEqual(baselineFingerprint(input), baselineFingerprint({ ...input, positionSize: 2 }));
});

test("incremental research accepts exactly one meaningful variable change", () => {
  const change: VariableChange = { id: "v-1", label: "Session filter", kind: "FILTER", before: "all sessions", after: "UTC 08:00-16:00", rationale: "Test the isolated session hypothesis" };
  assert.equal(validateSingleVariableChange([change]).ok, true);
  assert.equal(validateSingleVariableChange([]).ok, false);
  assert.equal(validateSingleVariableChange([change, { ...change, id: "v-2", label: "Sizing" }]).ok, false);
  assert.equal(validateSingleVariableChange([{ ...change, after: change.before }]).ok, false);
});

test("sample adequacy visibly flags small trade counts and reports a Wilson hit-rate interval", () => {
  const small = assessSampleAdequacy(4, 10);
  assert.equal(small.status, "INSUFFICIENT");
  assert.ok(small.hitRateInterval.lower < small.hitRate);
  assert.ok(small.hitRateInterval.upper > small.hitRate);
  assert.equal(assessSampleAdequacy(55, 120).status, "INFORMATIVE");
});

test("data assessment identifies only verified native input and flags external or ambiguous requirements", () => {
  const native = resolveDataRequirements(cleanRules);
  assert.equal(native.some((item) => item.coverage !== "NATIVE_VERIFIED"), false);
  assert.equal(dataAssessmentReady(native), true);
  const unsupported = resolveDataRequirements({ ...cleanRules, entry: "Enter QQQX_USDT on 5m bars when options flow confirms the signal." });
  assert.equal(unsupported.some((item) => item.coverage === "IMPORT_REQUIRED"), true);
  assert.equal(dataAssessmentReady(unsupported), false);
});

import { buildSingleVariableSource, generateMinimalStrategy } from "../src/domain/protocol/generation";

test("minimal generation refuses unsupported rule grammar instead of silently inventing a strategy", () => {
  const unsupported = generateMinimalStrategy(cleanRules);
  assert.equal(unsupported.source, "");
  assert.ok(unsupported.unsupportedRequirements.length > 0);
  const explicit = generateMinimalStrategy({
    ...cleanRules,
    entry: "Enter when close crosses above the 20-period EMA.",
    exit: "Exit when close crosses below the 20-period EMA.",
    sizing: "Trade exactly one native contract.",
  });
  assert.match(explicit.source, /strategy\("Protocol EMA Crossover Baseline"/);
  assert.equal(explicit.assumptions.length, 2);
  assert.equal(explicit.extrasDetected.length, 0);
});

test("incremental source transformer changes one declared supported variable and rejects unreviewed changes", () => {
  const baseline = generateMinimalStrategy({
    ...cleanRules,
    entry: "Enter when close crosses above the 20-period EMA.",
    exit: "Exit when close crosses below the 20-period EMA.",
    sizing: "Trade exactly one native contract.",
  }).source;
  const sizing = buildSingleVariableSource(baseline, { kind: "SIZING", after: "2" });
  assert.equal(sizing.ok, true);
  if (sizing.ok) assert.match(sizing.source, /qty=2/);
  const filter = buildSingleVariableSource(baseline, { kind: "FILTER", after: "close > vwap" });
  assert.equal(filter.ok, true);
  const blocked = buildSingleVariableSource(baseline, { kind: "REGIME", after: "low volatility" });
  assert.equal(blocked.ok, false);
});
