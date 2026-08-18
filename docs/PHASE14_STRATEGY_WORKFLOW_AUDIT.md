# Phase 14 Strategy Workflow Audit

**Branch:** `product/orderflow-research-terminal`
**Date:** 2026-08-18
**Scope:** User-authorized in-browser strategy coding and deterministic historical evaluation.

## Existing Foundation

The terminal already has a strong safe foundation: a cited and human-approved protocol baseline, a closed ZS parser/compiler, a dedicated browser worker, next-bar-open historical execution mechanics, reproducible result hashes, explicit cost inputs, and visible no-broker/no-forecast boundaries.

| Capability | Current state | Evidence |
|---|---|---|
| Strategy source validation | Closed ZS syntax metadata compiler; forbidden identifiers and unsupported capabilities are diagnosed. | `shared/strategy/zsCompiler.ts` |
| Arbitrary JavaScript / browser escape | Not allowed by the compiler contract. | Forbidden `eval`, imports, network, DOM, process, file, and shell identifiers. |
| Historical evaluation | Deterministic worker runs a fixed EMA20/50 + VWAP template on verified candles with next-open fills. | `shared/backtest/engine.ts`, `client/src/workers/backtest.worker.ts` |
| Result evidence | Hash, provenance, costs, trades, markers, equity, drawdown, and monthly outcomes are present. | Backtest result contract and Research drawer. |
| Compiler-to-backtest linkage | **Missing.** A validated ZS source is not evaluated; the drawer always submits the fixed template ID. | `ProtocolResearchDrawer.tsx` calls the worker with `strategyId: "ema20_50_vwap_long"`. |

## Product Gap

The user-authorized product wedge requires that code written in the browser can drive a historical result. The current source editor is truthful about compilation but does not yet influence a backtest. That disconnect must be eliminated only through an explicit **closed runtime**, not by evaluating raw JavaScript with `eval`, `Function`, a worker sandbox, dynamic import, or any host capability.

## Safe Scope for This Slice

The next implementation should evaluate a documented, deterministic subset of the existing ZS grammar over verified historical **candles only**. The executable contract should support fixed numeric inputs, candle fields, selected pure indicators, comparisons, boolean conditions, and `strategy.entry` / `strategy.close` actions. It must remain long-only at first, signal at bar close, fill at next-bar open, and fail closed for unsupported constructs.

> This slice cannot truthfully claim historical tick-data execution, CVD history, DOM history, cross-exchange historical liquidity, or live automated trading. The current public tape is bounded and live-only; its values are not eligible to be retroactively converted into historical strategy inputs.

## Mandatory Runtime Prohibitions

| Prohibited category | Required behavior |
|---|---|
| Host execution | No `eval`, `Function`, dynamic import, runtime `require`, or raw JavaScript execution. |
| I/O | No network, WebSocket, fetch, files, storage writes, shell, DOM, timer, or browser-global access from source. |
| Trading | No broker order, paper order, autonomous loop, credential, or execution route. `strategy.entry` and `strategy.close` are historical signal declarations only. |
| Unsupported historical series | No CVD, tape delta, order book, depth imbalance, large-order, GEX, or fabricated tick-volume input. |
| Look-ahead | Strategy evaluation may access bars only through the current close and schedules a market fill at the next open. |
| Silent fallback | Unsupported source must return diagnostics; it must never silently evaluate the fixed template instead. |

## Browser Preconditions Observed

The local workstation was observed first while public sources were unavailable: the chart remained in its explicit verification state and Flow Pulse was withheld with its reason. After source recovery, the chart displayed a verified Gate.io historical window of 97 fifteen-minute bars; Gate.io tape was live and the other public-tape providers visibly remained degraded. This confirms that the upcoming strategy workflow can be evaluated only from a currently verified historical candle window, while live-only order-flow evidence remains separately labelled and ineligible for historical strategy replay.

The local Research drawer was also opened with a verified historical dataset but no baseline. It displayed all citation/rule blockers and a disabled baseline lock, then showed **“Strategy compiler is protocol-gated”** and **“BASELINE REQUIRED”** when the Strategy tab was selected. No source editor or evaluator was reachable without the explicit human-approval gate.
