# PROJECT_RULES

Z TERMINAL is a professional quantitative futures trading and research terminal — a
single-page workspace built for serious traders who stare at markets for many hours
a day. This document defines what the product is, what it is not, and the
non-negotiable rules that govern every line of code and every number on screen.

## 1. What Z TERMINAL IS

- A **hypothesis-testing environment** for futures and equity-index strategies.
  The terminal exists so a trader can frame an idea ("the EMA cross with a VWAP
  filter outperforms on NQ RTH"), translate it into the ZS strategy language,
  back-test it deterministically, and inspect the resulting trades and statistics
  — all without leaving the workspace.
- A **single-route Next.js 16 application** (`/`) with client-side workspace
  view-switching driven by Zustand. There is no per-view routing, no SSR page
  gymnastics — the shell loads once, and views are swapped in place.
- A **dark-first professional terminal** with a restrained graphite/charcoal
  palette, hairline borders, tabular numerals, and compact density. See
  `DESIGN_SYSTEM.md`.
- A **provider-abstracted** market-data consumer: Mock, Rithmic Test, and Rithmic
  Production providers all normalize into the same internal types. See
  `ARCHITECTURE.md` and `MARKET_DATA_SCHEMA.md`.

## 2. What Z TERMINAL is NOT

- **Not a brokerage.** No orders are routed to any exchange. No real money moves.
  The execution domain (`Order`, `Execution`, `Position`, `AccountSnapshot`) is
  modeled for analytics and backtesting only.
- **Not a TradingView / Bookmap / ATAS clone.** Do not scrape, embed, or reverse-
  engineer third-party terminals. Use authorized APIs only. See `LICENSING.md`.
- **Not Pine Script.** The ZS strategy language is a custom DSL that is
  Pine-*like* in spirit (series, inputs, `strategy.entry`) but is explicitly
  **not** Pine-compatible. Compilation does not fake Pine compatibility. See
  `STRATEGY_LANGUAGE.md`.
- **Not a live-trading system in this environment.** The Rithmic R | Protocol
  API integration is interface-only and is NOT operational here. See
  `RITHMIC_INTEGRATION.md`.

## 3. The hypothesis-testing philosophy

Every feature must answer one of two questions:

1. **"Does this help me test a trading hypothesis honestly?"** — backtester,
   strategy language, statistics, market-data plumbing, session model.
2. **"Does this help me run the terminal for eight hours without eye strain or
   cognitive overhead?"** — design system, command palette, view layout,
   primitives, keyboard shortcuts.

Features that answer neither are out of scope. The "would a serious trader stare
at this for 8 hours?" test is the design gate — see `DESIGN_SYSTEM.md`.

## 4. Target users

- Independent futures traders running systematic or semi-systematic strategies on
  CME equity-index futures (NQ/MNQ/ES/MES) and correlated ETFs (QQQ/SPY).
- Researchers who need **reproducible** backtests — identical inputs must always
  produce identical trades and metrics.
- Traders who want a single workspace to combine chart, order-flow, strategy
  authoring, backtesting, and (eventually) journaling — without context-switching
  across five SaaS tabs.

## 5. Non-negotiable rules

These rules are enforced in code where possible and in review everywhere else.

1. **Never fabricate results.** Backtests are deterministic. The hash of
   `(source, symbol, timeframe, range, costs, params, bars)` is stored with
   every result. Two identical hashes must produce identical trades. There is
   no `Math.random` anywhere in the backtest path. See `BACKTESTING.md`.
2. **Never fake LIVE data.** If the active provider is `mock`, every number on
   screen must be labeled `SIMULATED` via the `SimulatedTag` primitive and the
   `DataStatus="SIMULATED"` field on every API response and socket event. The
   workspace connection state defaults to `{ provider: "mock", environment:
   "simulation", dataStatus: "SIMULATED" }`.
3. **SIMULATED is always labeled.** Every panel that displays mock data must
   surface the `SimulatedTag` badge. Every normalized event carries
   `provider` and `environment` fields. Hiding the SIMULATED label is a defect.
4. **No look-ahead bias.** A signal generated on `bar[i]` is filled at
   `bar[i+1].open` (adjusted for slippage and commission). You cannot trade on
   the bar that produced the signal. See `BACKTESTING.md`.
5. **Credentials never reach the browser.** Rithmic credentials (and any other
   real-market secret) are server-side environment variables only. They must
   never appear in `localStorage`, URL parameters, logs, or Git. See
   `SECURITY.md`.
6. **Respect licensing.** Display, redistribution, historical storage, and
   derived-data rights are governed by exchange agreements. Do not scrape
   third-party terminals. See `LICENSING.md`.
7. **Analytics never depend on provider-specific code.** Everything flows
   through the normalized types in `src/lib/market/types.ts`. Provider
   adapters normalize; everything downstream consumes the normalized model.
8. **Honest documentation.** If a feature is a stub or roadmap item, the docs
   say so explicitly. Do not invent endpoints, protobuf messages, or
   authentication flows that do not exist in the codebase.

## 6. Scope of this environment

This repository is a development and demonstration environment. It runs against
the deterministic SIMULATED mock provider end-to-end. Real market-data
integration (Rithmic Test / Production) is blocked on the official Rithmic
protobuf dev-kit, credentials, and conformance testing — see
`RITHMIC_INTEGRATION.md`. No part of this codebase is authorized for production
trading.
