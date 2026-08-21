# STATISTICS

This document specifies every metric in `BacktestMetrics`, computed by
`computeMetrics(...)` in `src/lib/strategy/zs-runtime.ts`. The metrics block
is isolated in a pure function so it is **independently testable** — given
`trades`, `equity`, `drawdown`, `cfg`, and `barsCount`, the output is fully
determined.

> **Honesty note.** Monte Carlo, bootstrap resampling, and confidence
> intervals are **roadmap items** and are NOT implemented. They must never
> be presented as available. See the final section.

## 1. Profit & loss

| Metric           | Definition |
|------------------|------------|
| `netProfit`      | `grossProfit − grossLoss` (sum of trade PnLs, net of commission) |
| `netProfitPct`   | `((finalEquity − initialCapital) / initialCapital) * 100` |
| `grossProfit`    | Sum of PnL over winning trades |
| `grossLoss`      | `abs(Sum of PnL over losing trades)` (reported as a positive number) |
| `finalEquity`    | Last equity curve value (mark-to-market) |

## 2. Ratio metrics

| Metric           | Definition |
|------------------|------------|
| `profitFactor`   | `grossProfit / grossLoss` (returns `Infinity` if `grossLoss === 0` and `grossProfit > 0`; `0` otherwise) |
| `expectancy`     | `netProfit / totalTrades` — average $ per trade, in R-ish terms |
| `avgTrade`       | Same numerator / total trades (alias kept for clarity in UI) |
| `winRate`        | `(winners / totalTrades) * 100` (percent) |
| `avgWin`         | `grossProfit / winners` (0 when no winners) |
| `avgLoss`        | `grossLoss / losers` (0 when no losers) |
| `maxWin`         | Largest single winning trade PnL |
| `maxLoss`        | Largest single losing trade PnL (negative) |

## 3. Drawdown

Drawdown is tracked per bar from the mark-to-market equity curve:

```ts
peak = max(peak, equity[i]);
drawdown[i] = equity[i] − peak;   // ≤ 0
```

| Metric              | Definition |
|---------------------|------------|
| `maxDrawdown`       | `abs(min(drawdown))` — worst peak-to-trough dollar drawdown |
| `maxDrawdownPct`    | `(abs(maxDrawdown) / peakEquity) * 100` |

## 4. Risk-adjusted returns

Computed from **per-bar equity returns** `r_i = (eq_i − eq_{i-1}) / eq_{i-1}`:

| Metric   | Definition |
|----------|------------|
| `sharpe` | `(meanRet / stdRet) * sqrt(252)` — annualized from per-bar returns assuming 252 bars/year |
| `sortino`| `(meanRet / downsideStd) * sqrt(252)` where downside deviation uses only `r_i < 0` |
| `calmar` | `CAGR / maxDrawdownPct` where `CAGR = (finalEquity/initialCapital)^(1/years) − 1` and `years = barsCount / 252` |

Notes:
- `sqrt(252)` annualization assumes daily bars. When the timeframe is
  intraday, the annualization factor is approximate and should be
  interpreted as a relative ranking metric, not an absolute annual return
  forecast.
- `calmar` divides `CAGR` (in percent) by `maxDrawdownPct` (in percent), so
  the units cancel — it is a ratio of two percentages.
- `sharpe` and `sortino` return `0` when the denominator is zero (no
  variance / no downside).

## 5. Exposure & streaks

| Metric                | Definition |
|-----------------------|------------|
| `exposure`            | `(barsInMarket / barsCount) * 100` where `barsInMarket = sum(trade.bars)` |
| `avgBars`             | Average trade duration in bars |
| `longestWinStreak`    | Longest consecutive winning-trade run |
| `longestLossStreak`   | Longest consecutive losing-trade run |
| `totalTrades`         | Trade count |
| `winners` / `losers`  | Counts of PnL-positive and PnL-negative trades |

## 6. Determinism & testability

- `computeMetrics` is a pure function of `(trades, equity, dd, cfg,
  barsCount)`. Given the same inputs it returns the same `BacktestMetrics`.
- The full backtest hash (`BacktestResult.hash`) covers the strategy source,
  the entire `BacktestConfig`, the params, and `barsCount`. Two runs with
  the same hash yield identical `trades`, `equity`, `drawdown`, **and**
  `metrics` — so a stored run is a reproducible artifact.
- Metrics can be unit-tested in isolation without running the strategy: pass
  in a synthetic `trades` + `equity` array and assert the output.

## 7. Monte Carlo trade-path analysis

The Strategy Tester can run a deterministic **trade-order Monte Carlo** analysis after a completed backtest contains at least ten closed trades. It uses the verified closed-trade P&L sequence from that run and a seeded local pseudo-random generator. For each path, the observed outcomes are shuffled without replacement, then applied to the selected initial equity. The result reports the 5th, 50th, and 95th percentiles of terminal equity and maximum drawdown, together with the path count, seed, and source backtest hash.

This analysis models **path dependency only**. It does not create synthetic candles, forecast prices, estimate market probabilities, or justify execution. It is withheld when fewer than ten closed trades are available, because a display of path uncertainty from an extremely small trade set would be misleading.

## 8. Roadmap — NOT yet implemented

The following are **explicitly out of scope** for the current engine. They must not be fabricated, presented in the UI, or implied in any response:

- **Bootstrap confidence intervals** — nonparametric resampling of per-bar
  or per-trade returns for confidence bands on Sharpe / expectancy.
- **Parameter sensitivity / optimization sweeps** — with proper in-sample /
  out-of-sample discipline to avoid overfitting.
- **Walk-forward efficiency** and **probabilistic Sharpe ratio**.

When any remaining item is implemented, this document will be updated with the exact formula, sample size, randomization discipline, and the honest caveat that must accompany the number in the UI.
