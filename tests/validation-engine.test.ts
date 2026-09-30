import test from "node:test";
import assert from "node:assert/strict";
import {
  runValidationBattery,
  evaluateOutOfSample,
  evaluateWalkForward,
  evaluateMonteCarlo,
  evaluateCostStress,
  evaluateRegimes,
  evaluateConcentration,
  evaluateSensitivity,
} from "../src/domain/validation/engine";
import {
  mulberry32,
  runMonteCarloValidation,
} from "../src/domain/validation/resampling";
import type {
  ResearchResult,
  ResearchTrade,
  Dataset,
} from "../src/lib/local-research/contracts";
import type { Bar } from "../src/lib/market/types";
import { canonicalHash, sha256 } from "../src/lib/local-research/dataset";
import { defaultValidationConfig } from "../src/domain/validation/contracts";
import { holdoutRequests, verifyHoldoutRun } from "../src/domain/validation/holdout";

// Helper to create synthetic candle bars
function createMockBars(count: number, startMs = 1_700_000_000_000, intervalMs = 3_600_000) {
  const bars: Bar[] = [];
  let price = 100;
  for (let i = 0; i < count; i += 1) {
    const t = startMs + i * intervalMs;
    // Vary volatility deterministically
    const vol = i < count * 0.33 ? 1.0 : i < count * 0.66 ? 2.5 : 5.0;
    const change = (Math.sin(i * 0.2) + Math.cos(i * 0.05)) * vol;
    const o = Math.max(10, price);
    const c = Math.max(10, price + change);
    const h = Math.max(o, c) + vol * 0.5;
    const l = Math.min(o, c) - vol * 0.5;
    price = c;
    bars.push({ t, o, h, l, c, v: 1000 + i * 10 });
  }
  return bars;
}

function createMockDataset(bars: ReturnType<typeof createMockBars>): Dataset {
  return {
    version: 1,
    provider: "gateio",
    product: "perpetual",
    symbol: "BTC_USDT",
    timeframe: "1h",
    from: bars[0].t,
    to: bars[bars.length - 1].t + 3_600_000,
    bars,
    hash: "mock-dataset-hash-12345",
  };
}

function createMockResult(
  trades: ResearchTrade[],
  bars = createMockBars(200),
  params: Record<string, number | string | boolean> = { fast: 20, slow: 50 },
  feeBps = 10,
  slippageBps = 5,
): ResearchResult {
  const dataset = createMockDataset(bars);
  return {
    version: 1,
    id: "run-test-fixture-123",
    createdAt: Date.now(),
    name: "Mock Strategy Run",
    source: "def strategy(data, params): pass",
    sourceHash: "source-hash-123",
    inputHash: "input-hash-123",
    resultHash: "result-hash-123",
    engine: { python: "3.12.0", vectorbt: "0.26.0", sdk: "1.0.0", analytics: "1.0.0" },
    config: {
      provider: "gateio",
      symbol: "BTC_USDT",
      timeframe: "1h",
      from: dataset.from,
      to: dataset.to,
      initialCapital: 10_000,
      feeBps,
      slippageBps,
      allocation: 0.1,
      direction: "long",
      multiplier: 1,
      quantityStep: 0.001,
    },
    params,
    dataset,
    assumptions: ["Standard assumptions"],
    metrics: {
      netProfit: { value: trades.reduce((sum, t) => sum + t.pnl, 0) },
      sharpe: { value: 1.85 },
      maxDrawdown: { value: 0.12 },
    },
    equity: bars.map((b) => ({ time: b.t, equity: 10_000, drawdown: 0, benchmark: 10_000 })),
    trades,
    plots: {},
    monthly: [],
    drawdowns: [{ start: bars[0].t, trough: bars[10].t, recovery: bars[20].t, depth: 0.08, durationMs: 20 * 3_600_000 }],
    observations: [],
    logs: [],
  };
}

function mockHoldoutRuns(parent: ResearchResult, ratio = 0.7, purge = 1) {
  const bars = parent.dataset.bars;
  const split = Math.floor(bars.length * ratio);
  const segment = (subset: typeof bars, id: string): ResearchResult => {
    const from = subset[0].t;
    const to = subset[subset.length - 1].t + 3_600_000;
    return {
      ...parent, id, resultHash: `${id}-hash`,
      config: { ...parent.config, from, to },
      dataset: { ...parent.dataset, from, to, bars: subset, hash: `${id}-dataset-hash` },
      trades: parent.trades.filter((t) => t.entryTime >= from && t.exitTime != null && t.exitTime < to),
    };
  };
  return {
    inSample: segment(bars.slice(0, split), "earlier-run"),
    outOfSample: segment(bars.slice(split + purge), "later-run"),
  };
}

// ============================================================================
// STRATEGY FIXTURES A THROUGH F
// ============================================================================

test("Strategy A: Synthetic positive trade sequence produces descriptive evidence", async () => {
  const bars = createMockBars(240);
  const trades: ResearchTrade[] = [];

  // Generate 60 consistent trades throughout the entire period
  for (let i = 0; i < 60; i += 1) {
    const entryBar = bars[i * 3];
    const exitBar = bars[i * 3 + 2];
    const isWin = i % 3 !== 0; // 66.7% win rate
    const pnl = isWin ? 120 : -90; // Positive expectancy
    trades.push({
      id: `trade-${i}`,
      side: "long",
      entryTime: entryBar.t,
      exitTime: exitBar.t,
      entryPrice: entryBar.c,
      exitPrice: exitBar.c,
      quantity: 0.1,
      pnl,
      return: pnl / 1000,
      accountReturn: pnl / 10_000,
      fees: 2,
      status: "closed",
    });
  }

  const result = createMockResult(trades, bars, { fast: 20, slow: 50 });
  const validation = await runValidationBattery(result, undefined, mockHoldoutRuns(result));

  // Assertions:
  assert.ok(validation.outOfSample, "OOS result should exist");
  assert.equal(validation.profile.sampleAdequacy, "strong", "60 trades should be adequate");
  assert.ok(validation.outOfSample.outOfSampleMetrics.netProfit > 0, "OOS must remain profitable");
  assert.equal(validation.profile.oosPersistence, "inconclusive", "An unsealed strategy choice cannot receive a strength rating");
  assert.ok(validation.diagnostics.some((d) => d.id === "oos-selection-unsealed"));
  assert.ok(validation.diagnostics.some((d) => d.id === "oos-thin-trades"));
  assert.ok(validation.costStress.breakEvenFrictionBps != null && validation.costStress.breakEvenFrictionBps >= 25, "Stable edge should survive >= 25 bps total friction");
  assert.notEqual(validation.costStress.breakEvenFrictionBps, 100, "Break-even must be calculated rather than filled with a fixed sentinel");
  assert.equal(validation.profile.frictionResilience, "strong");
  assert.ok(validation.monteCarlo!.probabilityOfLoss < 0.10, "Probability of loss should be low for stable edge");
});

test("Strategy B: A profitable baseline cannot manufacture parameter sensitivity", async () => {
  const bars = createMockBars(100);
  const trades: ResearchTrade[] = [
    {
      id: "t1",
      side: "long",
      entryTime: bars[5].t,
      exitTime: bars[15].t,
      entryPrice: 100,
      exitPrice: 150,
      quantity: 1,
      pnl: 500,
      return: 0.5,
      accountReturn: 0.05,
      fees: 2,
      status: "closed",
    },
    {
      id: "t2",
      side: "long",
      entryTime: bars[20].t,
      exitTime: bars[30].t,
      entryPrice: 100,
      exitPrice: 140,
      quantity: 1,
      pnl: 400,
      return: 0.4,
      accountReturn: 0.04,
      fees: 2,
      status: "closed",
    },
    {
      id: "t3",
      side: "long",
      entryTime: bars[40].t,
      exitTime: bars[50].t,
      entryPrice: 100,
      exitPrice: 160,
      quantity: 1,
      pnl: 600,
      return: 0.6,
      accountReturn: 0.06,
      fees: 2,
      status: "closed",
    },
  ];

  // Parameters at isolated spike
  const result = createMockResult(trades, bars, { fast: 20, slow: 50 });
  const validation = await runValidationBattery(result);

  assert.equal(validation.sensitivity, undefined, "No parameter variants were executed");
  assert.equal(validation.profile.parameterStability, "inconclusive");
  assert.equal(validation.diagnostics.some((d) => d.category === "sensitivity"), false);
  assert.ok(validation.provenance.validationConfigHash.length === 64, "Config hash must be valid SHA-256");
});

test("A parent backtest alone cannot claim out-of-sample execution", async () => {
  const parent = createMockResult([], createMockBars(100));
  const validation = await runValidationBattery(parent);
  assert.equal(validation.outOfSample, undefined);
  assert.equal(validation.profile.oosPersistence, "inconclusive");
});

test("Strategy C: Cost-fragile strategy collapses under realistic friction", async () => {
  const bars = createMockBars(120);
  const trades: ResearchTrade[] = [];

  // 40 trades with very small gross edge (only $1.50 per trade on $10,000 notional ≈ 1.5 bps)
  for (let i = 0; i < 40; i += 1) {
    const entryBar = bars[i * 2];
    const exitBar = bars[i * 2 + 1];
    trades.push({
      id: `fragile-${i}`,
      side: "long",
      entryTime: entryBar.t,
      exitTime: exitBar.t,
      entryPrice: 100,
      exitPrice: 100.015,
      quantity: 100, // notional ~ 10,000
      pnl: 1.5,      // $1.50 gain
      return: 0.00015,
      accountReturn: 0.00015,
      fees: 0,
      status: "closed",
    });
  }

  const result = createMockResult(trades, bars, { fast: 10, slow: 20 }, 0, 0);
  const validation = await runValidationBattery(result);

  assert.equal(validation.profile.frictionResilience, "weak", "Friction resilience must be weak");
  assert.ok(validation.costStress.breakEvenFrictionBps != null && validation.costStress.breakEvenFrictionBps < 5.0, "Break-even friction must be < 5 bps");

  const fragileDiagnostic = validation.diagnostics.find((d) => d.id === "cost-fragile-edge");
  assert.ok(fragileDiagnostic, "Must emit critical cost-fragile diagnostic");
  assert.equal(fragileDiagnostic?.severity, "critical");
});

test("Strategy D: Regime-dependent strategy highlights market state concentration", async () => {
  const bars = createMockBars(240);
  const trades: ResearchTrade[] = [];

  // Low/normal vol trades (first 66% of bars) produce flat/negative returns
  for (let i = 0; i < 20; i += 1) {
    const entryBar = bars[i * 6];
    const exitBar = bars[i * 6 + 2];
    trades.push({
      id: `flat-${i}`,
      side: "long",
      entryTime: entryBar.t,
      exitTime: exitBar.t,
      entryPrice: entryBar.c,
      exitPrice: exitBar.c,
      quantity: 0.1,
      pnl: -5,
      return: -0.05,
      accountReturn: -0.0005,
      fees: 1,
      status: "closed",
    });
  }

  // High vol trades (last 25% of bars) produce massive profits ($5,000)
  for (let i = 0; i < 15; i += 1) {
    const barIndex = 180 + i * 3;
    const entryBar = bars[barIndex];
    const exitBar = bars[barIndex + 2];
    trades.push({
      id: `high-vol-win-${i}`,
      side: "long",
      entryTime: entryBar.t,
      exitTime: exitBar.t,
      entryPrice: entryBar.c,
      exitPrice: exitBar.c,
      quantity: 0.1,
      pnl: 350,
      return: 0.35,
      accountReturn: 0.035,
      fees: 1,
      status: "closed",
    });
  }

  const result = createMockResult(trades, bars);
  const validation = await runValidationBattery(result);

  assert.ok(
    validation.regimes.dominantRegimePct >= 70.0,
    `Dominant regime should exceed 70%, got ${validation.regimes.dominantRegimePct}%`,
  );
  assert.equal(validation.profile.regimeBreadth, "weak", "Regime breadth should be weak when concentrated");

  const regimeDiag = validation.diagnostics.find((d) => d.id === "regime-concentration-flag");
  assert.ok(regimeDiag, "Must emit regime concentration warning diagnostic");
});

test("Strategy E: Concentrated strategy warns when top trades dominate PnL", async () => {
  const bars = createMockBars(100);
  const trades: ResearchTrade[] = [];

  // 25 small trades with small PnL ($10 each) = $250
  for (let i = 0; i < 25; i += 1) {
    const entryBar = bars[i * 3];
    const exitBar = bars[i * 3 + 1];
    trades.push({
      id: `small-${i}`,
      side: "long",
      entryTime: entryBar.t,
      exitTime: exitBar.t,
      entryPrice: entryBar.c,
      exitPrice: exitBar.c,
      quantity: 0.1,
      pnl: 10,
      return: 0.01,
      accountReturn: 0.001,
      fees: 1,
      status: "closed",
    });
  }

  // 2 massive outlier lottery trades = $2,000 each ($4,000 total out of $4,250 net)
  trades.push({
    id: "lottery-1",
    side: "long",
    entryTime: bars[80].t,
    exitTime: bars[85].t,
    entryPrice: 100,
    exitPrice: 300,
    quantity: 1,
    pnl: 2000,
    return: 2.0,
    accountReturn: 0.2,
    fees: 5,
    status: "closed",
  });
  trades.push({
    id: "lottery-2",
    side: "long",
    entryTime: bars[88].t,
    exitTime: bars[95].t,
    entryPrice: 100,
    exitPrice: 300,
    quantity: 1,
    pnl: 2000,
    return: 2.0,
    accountReturn: 0.2,
    fees: 5,
    status: "closed",
  });

  const result = createMockResult(trades, bars);
  const validation = await runValidationBattery(result);

  assert.ok(
    validation.concentration.top5TradesProfitPct >= 80.0,
    `Top 5 trades should account for >80% PnL, got ${validation.concentration.top5TradesProfitPct}%`,
  );

  const concDiag = validation.diagnostics.find((d) => d.id === "conc-top5-outliers");
  assert.ok(concDiag, "Must emit diagnostic warning on top 5 trade concentration");

  const reversed = await runValidationBattery({ ...result, trades: [...trades].reverse() });
  assert.equal(reversed.baseline.maxDrawdown, validation.baseline.maxDrawdown, "Drawdown must use execution order, not envelope order");
  assert.equal(reversed.concentration.longestLossStreak, validation.concentration.longestLossStreak);
  assert.deepEqual(reversed.monteCarlo?.maxDrawdownPct, validation.monteCarlo?.maxDrawdownPct);
});

test("Strategy F: Insufficient sample refuses false statistical certainty", async () => {
  const bars = createMockBars(40);
  // Only 4 trades!
  const trades: ResearchTrade[] = [
    {
      id: "sparse-1",
      side: "long",
      entryTime: bars[2].t,
      exitTime: bars[5].t,
      entryPrice: 100,
      exitPrice: 110,
      quantity: 1,
      pnl: 100,
      return: 0.1,
      accountReturn: 0.01,
      fees: 1,
      status: "closed",
    },
    {
      id: "sparse-2",
      side: "long",
      entryTime: bars[10].t,
      exitTime: bars[15].t,
      entryPrice: 100,
      exitPrice: 112,
      quantity: 1,
      pnl: 120,
      return: 0.12,
      accountReturn: 0.012,
      fees: 1,
      status: "closed",
    },
    {
      id: "sparse-3",
      side: "long",
      entryTime: bars[20].t,
      exitTime: bars[25].t,
      entryPrice: 100,
      exitPrice: 95,
      quantity: 1,
      pnl: -50,
      return: -0.05,
      accountReturn: -0.005,
      fees: 1,
      status: "closed",
    },
    {
      id: "sparse-4",
      side: "long",
      entryTime: bars[30].t,
      exitTime: bars[35].t,
      entryPrice: 100,
      exitPrice: 108,
      quantity: 1,
      pnl: 80,
      return: 0.08,
      accountReturn: 0.008,
      fees: 1,
      status: "closed",
    },
  ];

  const result = createMockResult(trades, bars);
  const validation = await runValidationBattery(result);

  assert.equal(validation.profile.sampleAdequacy, "weak", "Sample adequacy must be weak for 4 trades");
  assert.equal(validation.concentration.sampleSufficiency, "insufficient");

  // Monte Carlo should refuse to run on fewer than 5 trades
  assert.equal(validation.monteCarlo, undefined, "Monte Carlo must be undefined on < 5 trades");

  const thinDiag = validation.diagnostics.find((d) => d.id === "sample-thin-warning");
  assert.ok(thinDiag, "Must emit thin sample warning diagnostic");
});

// ============================================================================
// ZERO LEAKAGE & EMBARGO INVARIANTS
// ============================================================================

test("Disjoint segment attribution excludes a boundary-straddling parent trade", () => {
  const bars = createMockBars(100);
  const from = bars[0].t;
  const to = bars[bars.length - 1].t + 3_600_000;
  const splitTime = from + Math.floor((to - from) * 0.7);

  // In-sample trade
  const isTrade: ResearchTrade = {
    id: "is-trade",
    side: "long",
    entryTime: from + 3_600_000,
    exitTime: splitTime - 3_600_000,
    entryPrice: 100,
    exitPrice: 120,
    quantity: 1,
    pnl: 200,
    return: 0.2,
    accountReturn: 0.02,
    fees: 1,
    status: "closed",
  };

  // Boundary-straddling trade (starts in IS, exits in OOS) -> Must be purged!
  const boundaryTrade: ResearchTrade = {
    id: "straddle-trade",
    side: "long",
    entryTime: splitTime - 3_600_000,
    exitTime: splitTime + 3_600_000,
    entryPrice: 100,
    exitPrice: 150,
    quantity: 1,
    pnl: 500,
    return: 0.5,
    accountReturn: 0.05,
    fees: 1,
    status: "closed",
  };

  // OOS trade (starts strictly after split + purge)
  const oosTrade: ResearchTrade = {
    id: "oos-trade",
    side: "long",
    entryTime: splitTime + 7_200_000,
    exitTime: to - 3_600_000,
    entryPrice: 100,
    exitPrice: 110,
    quantity: 1,
    pnl: 100,
    return: 0.1,
    accountReturn: 0.01,
    fees: 1,
    status: "closed",
  };

  // Add 10 dummy trades to pass minimum trade count threshold
  const dummyTrades: ResearchTrade[] = Array.from({ length: 10 }, (_, i) => ({
    id: `dummy-${i}`,
    side: "long",
    entryTime: from + (i + 1) * 3_600_000 * 2,
    exitTime: from + (i + 1) * 3_600_000 * 2 + 3_600_000,
    entryPrice: 100,
    exitPrice: 105,
    quantity: 1,
    pnl: 50,
    return: 0.05,
    accountReturn: 0.005,
    fees: 1,
    status: "closed",
  }));

  const allTrades = [isTrade, boundaryTrade, oosTrade, ...dummyTrades];
  const result = createMockResult(allTrades, bars);
  const oos = evaluateOutOfSample(result, defaultValidationConfig(), mockHoldoutRuns(result));

  assert.ok(oos, "OOS result should exist");
  // The boundary straddle trade ($500) must NOT be counted in either IS or OOS:
  assert.ok(
    oos.inSampleMetrics.totalTrades < allTrades.length,
    "Boundary trade must not bleed into In-Sample",
  );
  assert.ok(
    oos.outOfSampleMetrics.netProfit === 100,
    `OOS net profit must only reflect the pure OOS trade ($100), got ${oos.outOfSampleMetrics.netProfit}`,
  );
});

test("Holdout requests run exact source on disjoint closed candle datasets", async () => {
  const alignedStart = Math.floor(1_700_000_000_000 / 3_600_000) * 3_600_000;
  const parent = createMockResult([], createMockBars(100, alignedStart));
  const requests = await holdoutRequests(parent, defaultValidationConfig());
  assert.ok(requests);
  assert.equal(requests.inSample.dataset.bars.length, 70);
  assert.equal(requests.outOfSample.dataset.bars.length, 29);
  assert.equal(requests.inSample.config.to + 3_600_000, requests.outOfSample.config.from);
  assert.equal(requests.inSample.source, parent.source);
  assert.equal(requests.outOfSample.source, parent.source);
  assert.notEqual(requests.inSample.dataset.hash, requests.outOfSample.dataset.hash);
  const child = {
    ...parent, id: "linked-child", resultHash: "f".repeat(64),
    sourceHash: await sha256(parent.source),
    config: requests.inSample.config, dataset: requests.inSample.dataset,
  };
  await verifyHoldoutRun(requests.inSample, child);
  await assert.rejects(
    verifyHoldoutRun(requests.inSample, { ...child, dataset: { ...child.dataset, bars: child.dataset.bars.slice(1) } }),
    /identity mismatch/,
  );
});

// ============================================================================
// DETERMINISTIC PRNG & PROVENANCE INVARIANTS
// ============================================================================

test("Deterministic PRNG: Mulberry32 reproduces bit-exact Monte Carlo results", () => {
  const tradePnls = [120, -50, 80, -30, 200, -110, 45, -20, 150, -80];
  const seed = 12345;

  const run1 = runMonteCarloValidation(tradePnls, {
    paths: 500,
    initialEquity: 10_000,
    seed,
    method: "trade_order_permutation",
  });

  const run2 = runMonteCarloValidation(tradePnls, {
    paths: 500,
    initialEquity: 10_000,
    seed,
    method: "trade_order_permutation",
  });

  assert.deepEqual(run1.terminalEquity, run2.terminalEquity, "Identical seed must yield exact same terminal equity");
  assert.deepEqual(run1.maxDrawdownPct, run2.maxDrawdownPct, "Identical seed must yield exact same max drawdown");
  assert.equal(run1.probabilityOfLoss, run2.probabilityOfLoss);
  assert.deepEqual(run1.samplePaths, run2.samplePaths, "Sample paths must be bit-exact identical");
  const expectedTerminal = 10_000 + tradePnls.reduce((sum, pnl) => sum + pnl, 0);
  assert.deepEqual(run1.terminalEquity, { p05: expectedTerminal, p50: expectedTerminal, p95: expectedTerminal }, "Permutation cannot change additive terminal PnL");
  assert.equal(run1.probabilityOfLoss, 0, "Permutation loss status is fixed by recorded PnL");
});

test("Provenance: Material validation config changes alter validationConfigHash", async () => {
  const configA = defaultValidationConfig();
  const configB = { ...configA, oosSplitRatio: 0.8 };
  const configC = { ...configA, monteCarloSeed: 999 };
  const configD = { ...configA, costTiersBps: [0, 10, 20, 50] };

  const hashA = await canonicalHash(configA);
  const hashB = await canonicalHash(configB);
  const hashC = await canonicalHash(configC);
  const hashD = await canonicalHash(configD);

  assert.notEqual(hashA, hashB, "Changing OOS split ratio must change hash");
  assert.notEqual(hashA, hashC, "Changing Monte Carlo seed must change hash");
  assert.notEqual(hashA, hashD, "Changing cost tiers must change hash");

  // Re-hashing configA should yield bit-exact identical hash
  const hashA2 = await canonicalHash(configA);
  assert.equal(hashA, hashA2, "Identical configuration must yield exact same hash");
});
