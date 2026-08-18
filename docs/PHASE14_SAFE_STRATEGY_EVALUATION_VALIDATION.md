# Phase 14 Safe Strategy Evaluation Validation

**Branch:** `product/orderflow-research-terminal`
**Scope:** Closed in-browser strategy interpretation and deterministic historical candle evaluation
**Validation date:** 2026-08-18
**Release state:** Validated on the product branch only. This record does **not** authorize a recovery merge, production-branch change, or Render deployment.

## Objective

Phase 14 removes the misleading gap between a strategy editor that only compiled source and a backtest that always ran an unrelated fixed template. A successfully validated ZS source can now produce declared historical signals through a closed AST interpreter, and those signals drive a deterministic next-bar-open evidence result in the dedicated browser worker.

> The product does **not** execute JavaScript. ZS is a closed interpreted grammar. `strategy.entry` and `strategy.close` are historical research declarations only—not broker orders, paper orders, alerts, positions, or autonomous actions.

## Delivered Workflow

| Stage | Behavior | Boundary |
|---|---|---|
| Protocol gate | Cited hypothesis, fixed rules, verified historical dataset, and explicit human approval must lock a baseline before the Strategy tab is available. | The implementation does not bypass the existing human-approval control. |
| Source validation | `strategy.compile` continues to return deterministic closed-grammar diagnostics and typed inputs. | No `eval`, `Function`, import, network, browser-global, storage, file, shell, process, or broker capability is part of the grammar. |
| Closed interpretation | `evaluateClosedZS()` reads only a validated AST and current/prior verified OHLCV candles. | Unsupported constructs fail closed; no source is converted into or evaluated as JavaScript. |
| Historical signals | Runtime v1 supports long-only fixed-quantity `strategy.entry` and fixed-ID `strategy.close` declarations. | Shorting, dynamic sizing, stops/limits, brackets, pyramiding, and `strategy.exit` are rejected. |
| Worker evaluation | The browser worker turns closed-runtime signals into signal-at-close / market-fill-at-next-open research evidence. | No live feed, tick replay, CVD, DOM, Flow Pulse, tape, large-order, or GEX history is provided to source. |
| Evidence package | Result includes a strategy identity, source/runtime fingerprint, data provenance, costs, trades, markers, equity, drawdown, monthly outcomes, and classification. | Historical results remain research evidence only, not proof of future performance. |

## Deterministic and Safety Validation

| Check | Result |
|---|---|
| Closed runtime signal generation | Passed: identical source and bars return the same ordered entry/exit signals and fingerprint. |
| No-look-ahead execution | Passed: an entry signal at a bar close is filled at the following bar open; close declarations follow the same model. |
| Source-driven rather than template-driven evaluation | Passed: the engine test uses prevalidated closed-runtime signals, preserves declared quantity, and identifies the closed strategy rather than the fixed template. |
| Escape-hatch rejection | Passed: forbidden identifiers such as `eval`, `fetch`, imports, host globals, and I/O pathways do not produce signals. |
| Unsupported historical order-flow identifiers | Passed: `cvd` fails closed rather than being fabricated from candles or live tape. |
| Unsupported strategy behavior | Passed: short entries and dynamic quantity expressions fail closed with diagnostics. |
| Protocol UI gate | Browser observation passed: with verified historical bars but no locked baseline, the Strategy tab displayed `BASELINE REQUIRED` and no source editor/evaluator. |
| Static and full quality gates | `pnpm check` passed; `pnpm test` passed with **22 test files / 70 tests**; `pnpm build` passed; `git diff --check` passed. |

## Browser Validation Scope

The local workstation was observed with a verified Gate.io 15-minute historical window. The Research drawer correctly displayed source/rule blockers before a baseline could be locked. Selecting Strategy displayed **“Strategy compiler is protocol-gated”** and **“BASELINE REQUIRED.”**

A baseline was intentionally **not** fabricated or force-set for browser testing, because locking it requires a human attestation over a cited research hypothesis. The source-to-signal-to-next-open result path is therefore validated through deterministic pure-contract and engine tests, while the browser validates the user-facing approval boundary.

## Files Covered

| File | Change |
|---|---|
| `shared/strategy/zsRuntime.ts` | New pure closed AST interpreter and deterministic signal contract. |
| `shared/strategy/zsRuntime.test.ts` | New runtime fixtures for signal determinism and fail-closed boundaries. |
| `shared/backtest/engine.ts` | New `runSignalBacktest()` path retaining data provenance, explicit costs, next-open fills, result hashing, markers, and evidence metrics. |
| `shared/backtest/engine.test.ts` | Source-driven signal, quantity, timing, deterministic-hash, and invalid-signal coverage. |
| `client/src/workers/backtest.worker.ts` | Closed-source worker mode that validates source via the closed interpreter and sends only typed signals to the engine. |
| `client/src/components/research/ProtocolResearchDrawer.tsx` | Requires current successful source validation and submits the current closed source to the historical worker; clarified visible safety language. |
| `docs/PHASE14_CLOSED_RUNTIME_CONTRACT.md` | Runtime capabilities, prohibitions, and deterministic semantics. |
| `docs/PHASE14_STRATEGY_WORKFLOW_AUDIT.md` | Pre-implementation audit and browser-gate observations. |

## Known Limits

This slice deliberately does not provide raw JavaScript, historical tick data, historical CVD, DOM/depth replay, Flow Pulse replay, volume-at-price from ticks, multi-exchange historical liquidity, shorting, dynamic sizing, stop/limit orders, leverage, optimization, walk-forward, Monte Carlo, broker connectivity, paper trading, or execution. The active product data contract supports verified historical candles and bounded live public tape/depth only; the two sources must not be conflated.

## Promotion Gate

The completed slice may be committed and pushed to the product branch only. The recovery PR remains review-only. The `render-hosted-research-terminal` branch and Render deployment are unchanged pending separate, explicit user authorization.
