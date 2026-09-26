import test from "node:test";
import assert from "node:assert/strict";
import { defaultResearchConfig } from "../src/lib/local-research/contracts";
import { validateDataset, validateConfig, sha256 } from "../src/lib/local-research/dataset";
import { researchEvidence } from "../src/lib/local-research/evidence";
import type { ResearchResult } from "../src/lib/local-research/contracts";

const config = { ...defaultResearchConfig(1_800_000_000_000), from: 3_600_000, to: 10_800_000 };
const bars = [1, 2].map(n => ({ t: n * 3_600_000, o: 10, h: 12, l: 9, c: 11, v: 4 }));
test("research accepts only complete closed history and keeps input unchanged", () => {
  assert.deepEqual(validateDataset([...bars].reverse(), config), bars);
  assert.throws(() => validateDataset(bars.slice(1), config), /Incomplete/);
  assert.throws(() => validateDataset([bars[0], bars[0]], config), /gap or duplicate/);
  assert.throws(() => validateDataset(bars, config, config.to - 1), /unfinished/);
  assert.throws(() => validateDataset([{ ...bars[0], h: 8 }, bars[1]], config), /Invalid OHLCV/);
});
test("research rejects invalid costs, allocation and unsupported intervals", () => {
  validateConfig(config);
  for (const patch of [{ feeBps: -1 }, { allocation: 1.1 }, { initialCapital: NaN }, { timeframe: "invalid" }]) assert.throws(() => validateConfig({ ...config, ...patch }));
});
test("source hashes are actual reproducible SHA-256", async () => {
  assert.equal(await sha256("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});

test("captured evidence distinguishes complete candles, gaps and unknown retrieval time", () => {
  const result = { config, createdAt: config.to + 1000, dataset: { ...config, bars } } as unknown as ResearchResult;
  assert.match(researchEvidence(result).coverage, /2 \/ 2 closed/);
  assert.match(researchEvidence(result).freshness, /unknown/);
  result.dataset.retrievedAt = config.to;
  assert.match(researchEvidence(result).freshness, /cached reuse does not refresh/);
  result.dataset.bars = bars.slice(1);
  assert.match(researchEvidence(result).coverage, /Coverage warning: Incomplete/);
  result.dataset.bars = [bars[0], bars[0]];
  assert.match(researchEvidence(result).coverage, /gap or duplicate/);
  result.dataset.provider = "binance";
  assert.match(researchEvidence(result).coverage, /configuration differ/);
});
