import type { ResearchResult } from "./contracts";
import { intervalMs, validateDataset } from "./dataset";

/** Read only the captured run, never the editor's current configuration. */
export function researchEvidence(result: ResearchResult) {
  const { dataset, config } = result;
  let coverage: string;
  try {
    if (["provider", "symbol", "timeframe", "from", "to"].some(key => dataset[key as keyof typeof dataset] !== config[key as keyof typeof config])) throw new Error("Dataset and requested configuration differ.");
    validateDataset(dataset.bars, config);
    coverage = `${dataset.bars.length.toLocaleString("en-US")} / ${(config.to - config.from) / intervalMs(config.timeframe)} closed candles; no missing timestamps in the requested range.`;
  } catch (error) {
    coverage = `Coverage warning: ${(error as Error).message}`;
  }
  const retrievedAt = dataset.retrievedAt;
  const retrievalKnown = Number.isSafeInteger(retrievedAt) && retrievedAt! >= dataset.to && retrievedAt! <= result.createdAt + 60_000;
  return {
    coverage: dataset.simulated ? `SIMULATED DATA. ${coverage}` : coverage,
    freshness: retrievalKnown
      ? `Retrieved ${new Date(retrievedAt!).toISOString()}. Historical snapshot; cached reuse does not refresh this timestamp.`
      : "Retrieval time unknown: this archive does not establish data freshness.",
    limitations: "OHLCV only: candle completeness does not certify provider accuracy or intrabar trades/depth. Funding, liquidation, leveraged margin and market impact are not modeled.",
  };
}
