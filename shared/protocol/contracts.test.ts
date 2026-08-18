import { describe, expect, it } from "vitest";
import {
  buildBaselineCandidate,
  lockBaseline,
  validateCitation,
  validateRuleScope,
  validateSingleVariableExperiment,
  type BaselineInput,
} from "./contracts";

const validInput: BaselineInput = {
  citation: {
    title: "A retained crossover research note", author: "Research Desk", year: 2020, sourceType: "URL",
    reference: "https://example.com/research/crossover", sourceText: "Enter when close crosses above the 20-period EMA; exit when close crosses below it; use one native contract.",
  },
  rules: {
    entry: "Enter long when close crosses above the 20-period EMA.",
    exit: "Exit the position when close crosses below the 20-period EMA.",
    sizing: "Use exactly one native contract.",
  },
  dataset: { provider: "gateio", symbol: "BTC_USDT", interval: "15m", coverageComplete: true, returnedBars: 480, sourceTimestamp: 1_700_000_000_000, fingerprint: "fnv1a-data-1234" },
  executionModel: "signal on close; market fill at next bar open",
  costModel: "explicit public-perpetual commission, spread, and slippage configuration",
  initialCapital: 100_000,
  positionSize: 1,
};

describe("protocol research contracts", () => {
  it("requires retained, correctly typed citation evidence before a protocol can advance", () => {
    expect(validateCitation({ ...validInput.citation, title: "", reference: "not-a-url" }, 2026)).toEqual(expect.arrayContaining([
      "A source title is required.",
      "URL citations must include an http:// or https:// scheme.",
    ]));
    expect(validateCitation(validInput.citation, 2026)).toEqual([]);
  });

  it("rejects silent optimization, additional filters, and ambiguous language from a baseline rule", () => {
    const violations = validateRuleScope({
      entry: "Enter when RSI is oversold and optimize the EMA from 10 to 30.",
      exit: "Exit as appropriate.",
      sizing: "Use one contract.",
    });
    expect(violations.map(item => item.code)).toEqual(expect.arrayContaining(["EXTRA_FILTER", "OPTIMIZATION", "PARAMETER_RANGE", "AMBIGUITY"]));
  });

  it("creates a deterministic ready-for-approval candidate only for cited, scoped, complete verified data", () => {
    const first = buildBaselineCandidate(validInput);
    const second = buildBaselineCandidate({ ...validInput, citation: { ...validInput.citation }, rules: { ...validInput.rules }, dataset: { ...validInput.dataset! } });
    expect(first).toMatchObject({ stage: "READY_FOR_APPROVAL", blockers: [], fingerprint: expect.stringMatching(/^fnv1a-/) });
    expect(first.fingerprint).toBe(second.fingerprint);

    const orderFlowCandidate = buildBaselineCandidate({ ...validInput, rules: { ...validInput.rules, entry: "Enter when live footprint delta is positive." } });
    expect(orderFlowCandidate.stage).toBe("READY_FOR_DATA_REVIEW");
    expect(orderFlowCandidate.dataRequirements).toEqual(expect.arrayContaining([expect.objectContaining({ id: "order-flow-history", coverage: "IMPORT_REQUIRED" })]));
  });

  it("locks only after explicit human approval and preserves a baseline snapshot for one-variable incremental research", () => {
    const candidate = buildBaselineCandidate(validInput);
    expect(lockBaseline(validInput, candidate, false, 1_000)).toEqual({ locked: null, reason: expect.stringContaining("human") });
    const lockedResult = lockBaseline(validInput, candidate, true, 1_000);
    expect(lockedResult.locked).toMatchObject({ fingerprint: candidate.fingerprint, lockedAt: 1_000, rules: validInput.rules });
    const baseline = lockedResult.locked!;

    expect(validateSingleVariableExperiment(baseline, [])).toEqual({ ok: false, reason: expect.stringContaining("exactly one") });
    expect(validateSingleVariableExperiment(baseline, [{ field: "sizing", before: "1", after: "1", rationale: "No change" }])).toEqual({ ok: false, reason: expect.stringContaining("does not alter") });
    expect(validateSingleVariableExperiment(baseline, [{ field: "sizing", before: "1", after: "2", rationale: "Test one additional native contract." }])).toEqual({ ok: true, reason: null });
    expect(baseline.rules.sizing).toBe("Use exactly one native contract.");
  });
});
