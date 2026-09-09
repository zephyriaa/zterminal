import assert from "node:assert/strict";
import test from "node:test";
import { executeLocalBacktest } from "../src/lib/research/compute-engine";
import { transpileToPython, detectScriptLanguage } from "../src/lib/research/transpiler";
import type { Bar } from "../src/lib/market/types";

test("detects and transpiles TradingView PineScript to zterminal_research Python", () => {
  const pineCode = `//@version=5
strategy("RSI Strategy", overlay=true)
length = input(14)
rsiVal = ta.rsi(close, length)
if ta.crossover(rsiVal, 30)
    strategy.entry("Long", strategy.long)
if ta.crossunder(rsiVal, 70)
    strategy.close("Long")
`;

  assert.equal(detectScriptLanguage(pineCode), "pinescript");
  const result = transpileToPython(pineCode);
  assert.equal(result.sourceLanguage, "pinescript");
  assert.equal(result.targetLanguage, "python");
  assert.equal(result.pythonCode.includes("from zterminal_research import"), true);
  assert.equal(result.pythonCode.includes("@strategy"), true);
});

test("detects and transpiles MultiCharts EasyLanguage to zterminal_research Python", () => {
  const elCode = `Inputs: Fast(9), Slow(21);
Vars: FastAvg(0), SlowAvg(0);

FastAvg = Average(Close, Fast);
SlowAvg = Average(Close, Slow);

If FastAvg Crosses Above SlowAvg Then
    Buy 1 Contracts Next Bar at Market;
If FastAvg Crosses Below SlowAvg Then
    Sell Next Bar at Market;
`;

  assert.equal(detectScriptLanguage(elCode), "easylanguage");
  const result = transpileToPython(elCode);
  assert.equal(result.sourceLanguage, "easylanguage");
  assert.equal(result.targetLanguage, "python");
  assert.equal(result.pythonCode.includes("from zterminal_research import"), true);
});

test("executes deterministic local backtest with realistic slippage and commissions", async () => {
  // Generate 100 synthetic bars with a clear upward trend followed by downward trend
  const baseTime = 1709251200000;
  const bars: Bar[] = [];
  let price = 60000;

  for (let i = 0; i < 100; i++) {
    // Bars 0-25: downtrend, Bars 26-60: uptrend (causes crossover), Bars 61-99: downtrend (causes crossunder)
    const delta = i < 25 ? -30 : i < 60 ? 50 : -40;
    price += delta;
    bars.push({
      t: baseTime + i * 300_000,
      o: price - 10,
      h: price + 20,
      l: price - 20,
      c: price,
      v: 100 + i,
    });
  }

  const strategyCode = `from zterminal_research import strategy, inputs, ta

@strategy(name="Trend Follower")
def trend_strategy(ctx, fast=inputs.int(5), slow=inputs.int(15)):
    fast_ema = ta.ema(ctx.close, 5)
    slow_ema = ta.ema(ctx.close, 15)
    if ta.crossover(fast_ema, slow_ema)[ctx.index] and not ctx.has_position:
        ctx.enter_long(quantity=1)
    elif ta.crossunder(fast_ema, slow_ema)[ctx.index] and ctx.has_long_position:
        ctx.close_position()
`;

  const result = await executeLocalBacktest(strategyCode, bars, {
    symbol: "BTCUSDT",
    timeframe: "5m",
    initialCapital: 100_000,
    commissionPerContract: 2.5,
    slippageTicks: 1,
    tickSize: 0.1,
    multiplier: 1,
  });

  assert.equal(result.barsProcessed, 100);
  assert.equal(result.intents.length > 0, true);
  assert.equal(result.trades.length > 0, true);
  assert.equal(Number.isFinite(result.metrics.netProfit), true);
  assert.equal(result.equityCurve.length > 0, true);
  assert.equal(result.trades[0].entryPrice > 0, true);
  assert.equal(result.trades[0].exitPrice > 0, true);
});
