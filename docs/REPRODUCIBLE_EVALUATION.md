# Reproducible Research Evaluation Contract

## Purpose

This module evaluates a **single, explicitly defined research template** against the same normalized Gate.io OHLCV window already disclosed in the Canvas. It is a deterministic research utility, not execution infrastructure, a recommendation engine, an optimizer, or a forecast.

## Current template

| Property | Value |
|---|---|
| Template | `ema20_50_vwap_long` |
| Version | `1.0.0` |
| Direction | Long-only |
| Entry signal | EMA 20 crosses above EMA 50 and the close is above loaded-window VWAP |
| Exit signal | EMA 20 crosses below EMA 50 or the close is below loaded-window VWAP |
| Signal timing | Bar close |
| Fill model | Next bar open only |
| Data threshold | At least 52 verified bars |

> A signal identified on bar *i* is queued at that bar’s close and may only enter or exit at bar *i + 1*’s open. The engine never fills on the signal bar.

## Input identity and determinism

The engine normalizes and sorts valid OHLCV bars, rejects duplicate timestamps, and uses the shared feature registry for EMA and VWAP. Its FNV-1a run hash includes the engine version, strategy and strategy version, full execution configuration, normalized dataset fingerprint, and bar count. Identical inputs therefore yield identical trades, equity points, metrics, and run identifier.

| Included in hash | Excluded from hash |
|---|---|
| Strategy version, explicit capital, position size, multiplier, commission, slippage ticks, tick size, execution model, normalized-data fingerprint, bar count | Wall-clock time, random values, browser state unrelated to the run |

## Cost and position model

The P0/P1 slice uses fixed unit sizing. The user-visible default is $100,000 starting capital, one unit, multiplier `1`, commission `0`, slippage `0` ticks, and tick size `0.01`. A long entry fills at `nextOpen + slippage`; a long exit fills at `nextOpen − slippage`. Net P&L is gross P&L less explicit round-trip commission. No costs are hidden.

## Output and limitations

A completed run returns trade records, mark-to-market equity, net P&L, return, trade count, win rate, profit factor, expectancy, maximum drawdown, input fingerprint, run hash, and model limitations. The initial slice does **not** model intrabar fills, limits, stops, brackets, short selling, borrowing, liquidity, spread behavior, market impact, contract rolls, parameter optimization, walk-forward testing, or broker routing.

The UI marks every result as research-only and carries the statement: **“Not investment advice. No broker route, forecast, optimization, or intrabar-fill claim.”**
