import type { IndicatorInstance } from "../indicator-library";
import type { Bar } from "../market/types";
import type { IndicatorEvaluationResult } from "./contracts";
import { intervalMs } from "./dataset";

/** Display a saved calculation only on matching captured observations, never as a fresh calculation. */
export function matchesPythonEvaluation(evaluation: IndicatorEvaluationResult | undefined, study: IndicatorInstance, market: { provider: string | undefined; product: string; symbol: string; timeframe: string }, bars: Bar[]): boolean {
  const dataset = evaluation?.dataset;
  if (!dataset || !evaluation || !Array.isArray(dataset.bars) || evaluation.datasetHash !== dataset.hash || evaluation.artifact.id !== study.artifactId || evaluation.artifact.revision !== study.artifactRevision || dataset.provider !== market.provider || dataset.product !== market.product || dataset.symbol !== market.symbol || dataset.timeframe !== market.timeframe || !bars.length) return false;
  const keys = Object.keys(evaluation.params);
  if (keys.length !== Object.keys(study.inputs).length || keys.some(key => !Object.hasOwn(study.inputs, key) || study.inputs[key] !== evaluation.params[key])) return false;
  const interval = intervalMs(dataset.timeframe);
  if (bars[bars.length - 1].t < dataset.to - interval) return false;
  let overlap = false;
  for (const bar of bars) {
    if (bar.t < dataset.from || bar.t >= dataset.to) continue;
    overlap = true;
    const captured = dataset.bars[(bar.t - dataset.from) / interval];
    if (!captured || (["t", "o", "h", "l", "c", "v"] as const).some(key => captured[key] !== bar[key])) return false;
  }
  return overlap;
}
