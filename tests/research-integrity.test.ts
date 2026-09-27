import test from "node:test";
import assert from "node:assert/strict";
import {
  LocalHelperExecutionProvider,
  RuntimeUnavailableError,
  StrategyExecutionRequest,
} from "../src/lib/research/execution-provider";
import { sha256, canonicalHash, validateDataset, validateConfig } from "../src/lib/local-research/dataset";
import { defaultResearchConfig, type ResearchResult } from "../src/lib/local-research/contracts";
import { evaluateStrategySource } from "../src/lib/research/python-runtime";
import { executeLocalBacktest } from "../src/lib/research/compute-engine";

const baseConfig = { ...defaultResearchConfig(1_800_000_000_000), from: 3_600_000, to: 10_800_000 };
const sampleBars = [1, 2].map(n => ({ t: n * 3_600_000, o: 100, h: 105, l: 95, c: 102, v: 50 }));

test("ExecutionProvider: fails closed when local helper is unavailable", async () => {
  const provider = new LocalHelperExecutionProvider();
  const caps = await provider.capabilities();
  assert.equal(caps.provider, "local_helper");
  assert.equal(typeof caps.available, "boolean");

  const request: StrategyExecutionRequest = {
    runId: "test-run-1",
    strategy: {
      language: "python",
      source: "import zterminal as zt\ndef strategy(data, params): return zt.Strategy(data.close > 0, data.close < 0)",
      sourceHash: "test-hash",
    },
    dataset: {
      version: 1,
      product: "perpetual",
      provider: "gateio",
      symbol: "BTC_USDT",
      timeframe: "1h",
      from: 3_600_000,
      to: 10_800_000,
      bars: sampleBars,
      hash: "dataset-hash",
    },
    parameters: {},
    execution: {
      initialCapital: 10000,
      feeBps: 10,
      slippageBps: 5,
      allocation: 0.1,
      direction: "long",
      multiplier: 1,
      quantityStep: 1,
    },
  };

  // When helper is offline, must reject with RuntimeUnavailableError or Error
  await assert.rejects(
    async () => {
      await provider.execute(request);
    },
    (err: Error) => {
      assert.ok(err instanceof RuntimeUnavailableError || err.message.includes("Python runtime unavailable"));
      return true;
    }
  );
});

test("Browser Python runtime: does NOT silently fall back to EMA cross on arbitrary Python", async () => {
  const arbitraryCode = `import custom_proprietary_lib
def run_my_model():
    return 42
`;

  // 1. evaluateStrategySource must throw rather than returning fake intents
  assert.throws(
    () => evaluateStrategySource(arbitraryCode, sampleBars),
    /Unsupported strategy code in browser mock runtime/
  );

  // 2. executeLocalBacktest must reject rather than returning fake trades
  await assert.rejects(
    async () => {
      await executeLocalBacktest(arbitraryCode, sampleBars, {
        symbol: "BTC_USDT",
        timeframe: "1h",
        initialCapital: 10000,
        commissionPerContract: 0,
        slippageTicks: 0,
        tickSize: 1,
        multiplier: 1,
      });
    },
    /Unsupported strategy code in browser mock runtime/
  );
});

test("Provenance & Hashing: cryptographic SHA-256 is deterministic and input-sensitive", async () => {
  const sourceA = "import zterminal as zt\ndef strategy(data, params): pass";
  const sourceB = "import zterminal as zt\ndef strategy(data, params): return 1";

  const hashA1 = await sha256(sourceA);
  const hashA2 = await sha256(sourceA);
  const hashB = await sha256(sourceB);

  // Determinism
  assert.equal(hashA1, hashA2);
  // Real SHA-256 64-char hex
  assert.equal(hashA1.length, 64);
  assert.match(hashA1, /^[0-9a-f]{64}$/);
  // Sensitivity to changes
  assert.notEqual(hashA1, hashB);
});

test("Provenance & Hashing: canonicalHash ignores JSON property ordering", async () => {
  const obj1 = { symbol: "BTC_USDT", feeBps: 10, initialCapital: 1000 };
  const obj2 = { initialCapital: 1000, feeBps: 10, symbol: "BTC_USDT" };

  const hash1 = await canonicalHash(obj1);
  const hash2 = await canonicalHash(obj2);

  assert.equal(hash1, hash2);

  // Modifying friction changes hash
  const obj3 = { ...obj1, feeBps: 15 };
  const hash3 = await canonicalHash(obj3);
  assert.notEqual(hash1, hash3);
});

test("Dataset Integrity: rejects gaps, incomplete candles and duplicates", () => {
  const valid = validateDataset(sampleBars, baseConfig);
  assert.deepEqual(valid, sampleBars);

  // Gap / duplicate
  assert.throws(() => validateDataset([sampleBars[0], sampleBars[0]], baseConfig), /gap or duplicate/);

  // Incomplete
  assert.throws(() => validateDataset(sampleBars.slice(1), baseConfig), /Incomplete/);
});

test("Reproduction link: preserves parent run identity without overwriting original", () => {
  const originalRun: Partial<ResearchResult> = {
    id: "run-original-123",
    name: "Original Momentum Run",
    source: "def strategy(data, params): pass",
    sourceHash: "abc123hash",
  };

  const reproducedRun: Partial<ResearchResult> = {
    ...originalRun,
    id: "run-reproduced-456",
    name: "Original Momentum Run (Reproduction)",
    reproducedFrom: originalRun.id,
  };

  assert.equal(reproducedRun.reproducedFrom, "run-original-123");
  assert.notEqual(reproducedRun.id, originalRun.id);
  assert.equal(reproducedRun.source, originalRun.source);
});
