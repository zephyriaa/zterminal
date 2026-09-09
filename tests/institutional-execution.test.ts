import assert from "node:assert/strict";
import test from "node:test";
import { executeLocalBacktest } from "../src/lib/research/compute-engine";
import { runGridSearch, runWalkForwardAnalysis, injectParameters } from "../src/lib/research/optimizer";
import type { Bar } from "../src/lib/market/types";

test("Bar Magnifier deterministically resolves stop vs target race conditions with sub-bars", async () => {
  const baseTime = 1709251200000;

  // Master bars: bar 0 enters long, bar 1 has huge range covering both stop and target
  const masterBars: Bar[] = [
    { t: baseTime, o: 100, h: 101, l: 99, c: 100, v: 100 },
    { t: baseTime + 300_000, o: 100, h: 115, l: 85, c: 102, v: 500 }, // both stop (90) and target (110) inside range!
    { t: baseTime + 600_000, o: 102, h: 103, l: 101, c: 102, v: 100 },
  ];

  // Scenario A: Sub-bars where profit target (110) is hit in minute 1, before stop (90) is hit in minute 3
  const subBarsTargetFirst: Bar[] = [
    { t: baseTime + 300_000, o: 100, h: 112, l: 99, c: 111, v: 100 }, // Target hit!
    { t: baseTime + 360_000, o: 111, h: 113, l: 105, c: 106, v: 100 },
    { t: baseTime + 420_000, o: 106, h: 107, l: 86, c: 88, v: 100 },   // Stop hit later
    { t: baseTime + 480_000, o: 88, h: 102, l: 87, c: 102, v: 100 },
  ];

  // Scenario B: Sub-bars where stop loss (90) is hit in minute 1, before rally
  const subBarsStopFirst: Bar[] = [
    { t: baseTime + 300_000, o: 100, h: 101, l: 88, c: 89, v: 100 },  // Stop hit first!
    { t: baseTime + 360_000, o: 89, h: 114, l: 89, c: 112, v: 100 },  // Target hit later
  ];

  // Custom strategy script with explicit bracket stop & target
  const bracketStrategy = `from zterminal_research import strategy

@strategy(name="Bracket Test")
def test_strategy(ctx):
    if ctx.index == 0:
        ctx.enter_long(quantity=1, stop_loss=90, take_profit=110)
`;

  // Test Scenario A: Bar Magnifier should detect target hit first
  const resultTargetFirst = await executeLocalBacktest(bracketStrategy, masterBars, {
    symbol: "BTCUSDT",
    timeframe: "5m",
    initialCapital: 10_000,
    commissionPerContract: 0,
    slippageTicks: 0,
    tickSize: 1,
    multiplier: 1,
    enableBarMagnifier: true,
    subBars: subBarsTargetFirst,
  });

  assert.equal(resultTargetFirst.trades.length, 1);
  assert.equal(resultTargetFirst.trades[0].reason, "take_profit_magnifier");
  assert.equal(resultTargetFirst.trades[0].exitPrice, 110);
  assert.equal(resultTargetFirst.trades[0].pnl > 0, true);

  // Test Scenario B: Bar Magnifier should detect stop hit first
  const resultStopFirst = await executeLocalBacktest(bracketStrategy, masterBars, {
    symbol: "BTCUSDT",
    timeframe: "5m",
    initialCapital: 10_000,
    commissionPerContract: 0,
    slippageTicks: 0,
    tickSize: 1,
    multiplier: 1,
    enableBarMagnifier: true,
    subBars: subBarsStopFirst,
  });

  assert.equal(resultStopFirst.trades.length, 1);
  assert.equal(resultStopFirst.trades[0].reason, "stop_loss_magnifier");
  assert.equal(resultStopFirst.trades[0].exitPrice, 90);
  assert.equal(resultStopFirst.trades[0].pnl < 0, true);
});

test("Limit orders adhere to touch vs penetrate fill settings", async () => {
  const baseTime = 1709251200000;
  // Bar 0: Signal generated to buy at limit 95
  // Bar 1: Low reaches exactly 95.0 (touches, but does NOT penetrate below 95.0)
  const bars: Bar[] = [
    { t: baseTime, o: 100, h: 101, l: 99, c: 100, v: 100 },
    { t: baseTime + 300_000, o: 98, h: 99, l: 95.0, c: 97, v: 100 },
    { t: baseTime + 600_000, o: 97, h: 99, l: 96, c: 98, v: 100 },
  ];

  const limitStrategy = `from zterminal_research import strategy

@strategy(name="Limit Test")
def test_limit(ctx):
    if ctx.index == 0:
        ctx.enter_long(quantity=1, limit_price=95.0)
`;

  // 1. Touch mode: should fill at 95.0
  const resultTouch = await executeLocalBacktest(limitStrategy, bars, {
    symbol: "BTCUSDT",
    timeframe: "5m",
    initialCapital: 10_000,
    commissionPerContract: 0,
    slippageTicks: 0,
    tickSize: 0.1,
    multiplier: 1,
    limitFillMode: "touch",
  });

  // Position is opened on bar 1 in touch mode
  assert.equal(resultTouch.intents[0].limit_price, 95.0);

  // 2. Penetrate mode: should NOT fill because low only touched 95.0 (requires 95.0 - 0.1 = 94.9)
  const resultPenetrate = await executeLocalBacktest(limitStrategy, bars, {
    symbol: "BTCUSDT",
    timeframe: "5m",
    initialCapital: 10_000,
    commissionPerContract: 0,
    slippageTicks: 0,
    tickSize: 0.1,
    multiplier: 1,
    limitFillMode: "penetrate",
  });

  assert.equal(resultPenetrate.trades.length, 0);
});

test("Trailing stop ratchets upward as price advances", async () => {
  const baseTime = 1709251200000;
  // Bar 0: Enter long at 100 with trailing stop of 5 ticks ($5.0)
  // Bar 1: Price rallies to High 110 -> stop should ratchet to 105
  // Bar 2: Price drops to Low 104 -> should trigger trailing stop exit at 105
  const bars: Bar[] = [
    { t: baseTime, o: 100, h: 101, l: 99, c: 100, v: 100 },
    { t: baseTime + 300_000, o: 101, h: 110, l: 100, c: 109, v: 100 },
    { t: baseTime + 600_000, o: 109, h: 109, l: 103, c: 104, v: 100 },
  ];

  const trailStrategy = `from zterminal_research import strategy

@strategy(name="Trail Test")
def test_trail(ctx):
    if ctx.index == 0:
        ctx.enter_long(quantity=1, trailing_stop_ticks=5)
`;

  const result = await executeLocalBacktest(trailStrategy, bars, {
    symbol: "BTCUSDT",
    timeframe: "5m",
    initialCapital: 10_000,
    commissionPerContract: 0,
    slippageTicks: 0,
    tickSize: 1,
    multiplier: 1,
  });

  assert.equal(result.trades.length, 1);
  assert.equal(result.trades[0].reason, "stop_loss");
  assert.equal(result.trades[0].exitPrice, 105);
  assert.equal(result.trades[0].pnl, 4); // Entry at bar 1 open 101, exit at 105
});

test("Parameter optimizer sweeps grid and injects parameters cleanly", async () => {
  const baseTime = 1709251200000;
  const bars: Bar[] = [];
  let price = 100;
  for (let i = 0; i < 50; i++) {
    price += i < 20 ? -1 : 1.5;
    bars.push({ t: baseTime + i * 60_000, o: price - 0.5, h: price + 1, l: price - 1, c: price, v: 100 });
  }

  const code = `from zterminal_research import strategy, inputs, ta

@strategy(name="Opt Test")
def opt_strat(ctx, fast=inputs.int(5), slow=inputs.int(15)):
    f = ta.ema(ctx.close, fast)
    s = ta.ema(ctx.close, slow)
    if ta.crossover(f, s)[ctx.index]:
        ctx.enter_long()
    elif ta.crossunder(f, s)[ctx.index]:
        ctx.close_position()
`;

  const injected = injectParameters(code, { fast: 8, slow: 21 });
  assert.equal(injected.includes("inputs.int(8)"), true);
  assert.equal(injected.includes("inputs.int(21)"), true);

  const optRes = await runGridSearch(
    code,
    bars,
    {
      symbol: "BTCUSDT",
      timeframe: "1m",
      initialCapital: 10_000,
      commissionPerContract: 0,
      slippageTicks: 0,
      tickSize: 0.1,
      multiplier: 1,
    },
    [
      { name: "fast", min: 3, max: 7, step: 2, type: "int" },
      { name: "slow", min: 10, max: 14, step: 2, type: "int" },
    ],
    "netProfit"
  );

  assert.equal(optRes.totalCombinations, 9); // 3 * 3 = 9
  assert.equal(optRes.candidates.length, 9);
  assert.equal(optRes.bestCandidate != null, true);
  assert.equal(optRes.heatmap != null, true);
});

test("Walk-Forward Analysis calculates Walk-Forward Efficiency (WFE)", async () => {
  const baseTime = 1709251200000;
  const bars: Bar[] = [];
  let price = 50000;
  for (let i = 0; i < 150; i++) {
    price += (i % 10 < 5 ? 30 : -20);
    bars.push({ t: baseTime + i * 60_000, o: price - 5, h: price + 10, l: price - 10, c: price, v: 100 });
  }

  const code = `from zterminal_research import strategy, inputs, ta

@strategy(name="WFA Test")
def wfa_strat(ctx, fast=inputs.int(5), slow=inputs.int(15)):
    f = ta.ema(ctx.close, fast)
    s = ta.ema(ctx.close, slow)
    if ta.crossover(f, s)[ctx.index]:
        ctx.enter_long()
    elif ta.crossunder(f, s)[ctx.index]:
        ctx.close_position()
`;

  const wfa = await runWalkForwardAnalysis(
    code,
    bars,
    {
      symbol: "BTCUSDT",
      timeframe: "1m",
      initialCapital: 10_000,
      commissionPerContract: 0,
      slippageTicks: 0,
      tickSize: 0.1,
      multiplier: 1,
    },
    [
      { name: "fast", min: 3, max: 7, step: 2, type: "int" },
      { name: "slow", min: 10, max: 14, step: 2, type: "int" },
    ],
    { cycles: 3, inSampleRatio: 0.7 }
  );

  assert.equal(wfa.cycles.length > 0, true);
  assert.equal(Number.isFinite(wfa.aggregateWfe), true);
  assert.equal(typeof wfa.isRobust, "boolean");
});
