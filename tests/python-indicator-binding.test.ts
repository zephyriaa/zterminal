import assert from "node:assert/strict";
import { test } from "node:test";
import { createPythonStudy } from "../src/lib/indicator-library";
import { matchesPythonEvaluation } from "../src/lib/local-research/indicator-evaluation";
import type { IndicatorEvaluationResult } from "../src/lib/local-research/contracts";

test("saved Python outputs bind revision, parameters, venue, market, range and actual candles", () => {
  const bars = [1, 2, 3].map(n => ({ t: n * 3_600_000, o: 10, h: 12, l: 9, c: 11, v: 4 }));
  const study = createPythonStudy({ artifactId: "ema", revision: 2, name: "EMA", outputs: [{ id: "ema", plot: "line" }], params: { length: 2 } });
  const market = { provider: "gateio", symbol: "BTC_USDT", product: "perpetual", timeframe: "1h" } as const;
  const evaluation: IndicatorEvaluationResult = { version: 1, kind: "indicator_evaluation", id: "evaluation", createdAt: 0,
    artifact: { id: "ema", revision: 2, name: "EMA" }, params: { length: 2 }, parameters: {}, outputs: {}, diagnostics: [], logs: [],
    sourceHash: "b".repeat(64), inputHash: "c".repeat(64), resultHash: "d".repeat(64), engine: { indicator: "1.1.0", helper: "1.3.0", python: "3.12.10", sdk: "1" },
    datasetHash: "a".repeat(64), dataset: { ...market, version: 1, from: bars[0].t, to: bars.at(-1)!.t + 3_600_000, bars, hash: "a".repeat(64) } };
  assert.equal(matchesPythonEvaluation(evaluation, study, market, bars), true);
  assert.equal(matchesPythonEvaluation(evaluation, study, market, bars.slice(1)), true); // Matching view of the saved input, not a recalculation.
  for (const changed of [{ ...market, provider: "binance" }, { ...market, symbol: "ETH_USDT" }, { ...market, timeframe: "4h" }, { ...market, product: "spot" }]) assert.equal(matchesPythonEvaluation(evaluation, study, changed, bars), false);
  assert.equal(matchesPythonEvaluation(evaluation, { ...study, artifactRevision: 3 }, market, bars), false);
  assert.equal(matchesPythonEvaluation(evaluation, { ...study, inputs: { length: 3 } }, market, bars), false);
  assert.equal(matchesPythonEvaluation(evaluation, study, market, [{ ...bars[0], c: 10 }, ...bars.slice(1)]), false);
  assert.equal(matchesPythonEvaluation(evaluation, study, market, bars.map(b => ({ ...b, t: b.t + 86_400_000 }))), false);
  assert.equal(matchesPythonEvaluation(evaluation, study, market, bars.slice(0, 2)), false); // Full-input output is not a past-only replay evaluation.
  assert.equal(matchesPythonEvaluation({ ...evaluation, dataset: undefined }, study, market, bars), false);
});
