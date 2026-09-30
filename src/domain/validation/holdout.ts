import type { Dataset, ResearchResult, RunRequest } from "@/lib/local-research/contracts";
import { canonicalHash, canonicalJson, intervalMs, sha256, validateDataset } from "@/lib/local-research/dataset";
import type { ValidationConfig } from "./contracts";

export interface HoldoutRuns { inSample: ResearchResult; outOfSample: ResearchResult }

/** Build disjoint, complete candle requests. The embargo bars belong to neither run. */
export async function holdoutRequests(
  parent: ResearchResult,
  config: ValidationConfig,
): Promise<{ inSample: RunRequest; outOfSample: RunRequest } | null> {
  const bars = validateDataset(parent.dataset.bars, parent.config, parent.createdAt);
  if (bars.length < 30) return null;
  if (!Number.isInteger(config.purgeBars) || config.purgeBars < 1 || config.purgeBars > 100) {
    throw new Error("Holdout purge must be between 1 and 100 complete bars.");
  }
  if (!Number.isFinite(config.oosSplitRatio) || config.oosSplitRatio < 0.5 || config.oosSplitRatio > 0.9) {
    throw new Error("Holdout split must be between 50% and 90% in-sample.");
  }
  const split = Math.floor(bars.length * config.oosSplitRatio);
  const later = split + config.purgeBars;
  if (split < 2 || bars.length - later < 2) return null;
  const interval = intervalMs(parent.config.timeframe);
  const request = async (segment: typeof bars, name: string): Promise<RunRequest> => {
    const from = segment[0].t;
    const to = segment[segment.length - 1].t + interval;
    const dataset: Dataset = {
      ...parent.dataset, from, to, bars: segment,
      hash: await canonicalHash(segment.map((bar) => [bar.t, bar.o, bar.h, bar.l, bar.c, bar.v])),
    };
    return {
      name: `${parent.name} · ${name}`.slice(0, 120),
      source: parent.source,
      config: { ...parent.config, from, to },
      params: { ...parent.params },
      dataset,
    };
  };
  return {
    inSample: await request(bars.slice(0, split), "earlier segment"),
    outOfSample: await request(bars.slice(later), "later segment"),
  };
}

/** Refuse results that do not correspond to the exact request sent to CPython. */
export async function verifyHoldoutRun(request: RunRequest, result: ResearchResult): Promise<void> {
  if (result.version !== 1 || !/^[a-f0-9]{64}$/.test(result.resultHash)) {
    throw new Error("Helper returned an invalid holdout result identity.");
  }
  if (result.source !== request.source || result.sourceHash !== await sha256(request.source)) {
    throw new Error("Holdout source identity mismatch.");
  }
  if (canonicalJson(result.config) !== canonicalJson(request.config) ||
      canonicalJson(result.params) !== canonicalJson(request.params) ||
      canonicalJson(result.dataset) !== canonicalJson(request.dataset)) {
    throw new Error("Holdout configuration or dataset identity mismatch.");
  }
}
