# ROADMAP

Phased delivery plan for Z TERMINAL. Phases marked **DONE** are in the
codebase today; **BLOCKED** phases are gated on external dependencies;
**PENDING** phases are not yet started. This document tracks honest
status — see `PROJECT_RULES.md` §6 (honest documentation).

## Phase 0–1 — Shell + Design System + Command Palette  [DONE]

- Next.js 16 + TypeScript + Tailwind v4 + shadcn/ui scaffold.
- Single `/` route with client-side workspace view-switching via Zustand.
- Graphite/charcoal palette, hairline borders, tabular numerals, Geist
  Sans/Mono — see `DESIGN_SYSTEM.md`.
- Terminal primitives: `Panel`, `PanelHeader`, `SectionLabel`, `StatRow`,
  `SimulatedTag`, `Pill`.
- `WorkspaceShell`, `Sidebar`, `Topbar`, `CommandPalette`.
- Keyboard shortcuts: `?` palette, `g c/s/b/o/m` view jumps.
- Persisted workspace + strategy stores (`localStorage`).

## Phase 2 — Chart  [DONE]

- `ChartView` with candlestick rendering, timeframe switching, symbol
  selection.
- Deterministic historical bars via `/api/bars`.
- `SimulatedTag` surfaced on the chart panel.

## Phase 3 — Mock Provider + WebSocket Streaming  [DONE]

- `MockMarketDataProvider` (deterministic historical bars) + `MockLiveMarket`
  (live tick generation) in `src/lib/market/mock-provider.ts`.
- Socket.io mini-service on port 3003 (`mini-services/market-data/index.ts`).
- Frontend `useMarketStream` hook connecting via `io("/?XTransformPort=3003")`
  with reconnect + subscription restoration.
- All events labeled `provider: "mock"`, `environment: "simulation"`.

## Phase 4 — Rithmic Test Integration  [BLOCKED]

- `IRithmicProvider` interface declared with `login`, `heartbeat`,
  `restoreSubscriptions`, `validateSequence`, `logout`.
- `RithmicTestProvider` / `RithmicProductionProvider` are **interface-only
  stubs**.
- **Blocked on:** (a) official Rithmic R | Protocol API protobuf dev-kit,
  (b) credentials under a valid agreement, (c) conformance testing against
  the Rithmic Test (Exchange Simulator), (d) explicit authorization for
  Production.
- See `RITHMIC_INTEGRATION.md`. No wire protocol or auth flow is
  implemented — these require the official dev-kit and documentation.

## Phase 5 — Order Flow  [PARTIAL]

- `OrderFlowView` with basic DOM (depth ladder), footprint, and CVD
  (cumulative volume delta) from the mock provider's `buyVol`/`sellVol`
  split and trade aggressor side.
- **Pending:** true MBO-based order flow. The mock provider synthesizes
  depth ladders but does not emit real `MBOEvent`s. Real MBO requires the
  Rithmic feed (Phase 4 unblock).

## Phase 6 — Strategy Builder  [DONE]

- `StrategyView` with a code editor (`src/components/terminal/code-editor.tsx`)
  for the ZS strategy language.
- Compiler + diagnostics via `POST /api/strategy`.
- ZS language documented in `STRATEGY_LANGUAGE.md`.
- Default strategy (`EMA Cross + VWAP Filter`) ships in the store.

## Phase 7 — Backtest Engine  [DONE, with roadmap items]

- Deterministic event-driven engine in `src/lib/strategy/zs-runtime.ts`.
- `BacktestConfig`, `BacktestResult`, `BacktestMetrics` — see
  `BACKTESTING.md` and `STATISTICS.md`.
- Anti-look-ahead execution model (signal on `bar[i]` fills at
  `bar[i+1].open`).
- Determinism hash for reproducible runs.
- `BacktesterView` with trades table, equity curve, drawdown, monthly
  returns, metrics panel.

**Pending within Phase 7:**
- Limit / stop / bracket fills (currently market-only).
- Walk-forward analysis.
- Monte Carlo simulation.
- Parameter sensitivity / optimization sweeps.
- Contract rolls / continuous contracts.
- Volatility-targeted / risk-percent position sizing.

## Phase 8 — Research Lab  [SCAFFOLDED]

- `ResearchView` placeholder present in the view registry.
- Notebooks / screener / correlation matrix — not yet implemented.

## Phase 9 — Journal / Portfolio / Risk  [SCAFFOLDED]

- `JournalView`, `PortfolioView`, `RiskView` placeholders in the registry.
- Database persistence plan documented in `DATABASE.md`.
- Not yet wired to a persistence layer.

## Phase 10 — AI Research Assistant  [PENDING]

- Not started. Will assist with strategy authoring, anomaly detection in
- backtest results, and natural-language query over market data. Subject to
  the same honesty rules as every other feature (no fabricated results).

## Phase 11 — Security Hardening  [PENDING]

- Auth layer (session or token) before any multi-user deployment.
- Rate limiting on API routes (especially `/api/backtest`, `/api/bars`).
- CORS lockdown on the socket.io service.
- CSRF protection if cookie auth is added.
- Secrets manager for Rithmic credentials.
- Audit logging (connection lifecycle, backtest runs by hash, strategy
  saves) — never logging credentials.
- See `SECURITY.md`.

## Phase 12 — Performance Optimization  [PENDING]

- Web Worker for backtest execution to keep the UI thread free on long
  ranges.
- Virtualized trade tables and depth ladders.
- Memoized indicator computation across runs.
- Chart canvas optimization for large bar counts.
- Socket.io batching (currently `requestAnimationFrame` batching on the
  client).

## Phase 13 — Production Infrastructure  [PENDING]

- Production deployment topology (Next.js + socket.io mini-service +
  optional Rithmic adapter process).
- Observability: structured logs, metrics, traces.
- Backup / restore for the SQLite database (or migration to a managed
  target).
- Disaster recovery and entitlement enforcement before any real data is
  connected.

---

**Honesty reminder:** Anything not marked **DONE** here is not available in
the current codebase. Do not present scaffolded or pending phases as
functional. When a phase completes, update this document in the same commit
that ships the code.
