# ARCHITECTURE

Z TERMINAL is a single-route Next.js 16 application with a client-side workspace
shell. All market data flows through a provider abstraction layer, normalizes
into a single internal model, and is delivered to the UI either via REST API
(historical bars) or via a socket.io mini-service (live streaming). The
backtester is a deterministic, event-driven engine that runs against the same
normalized bars.

## 1. Frontend

- **Framework:** Next.js 16, App Router, TypeScript, Tailwind v4, shadcn/ui
  (new-york style).
- **Routing:** A single route — `/`. There is no per-view URL. The shell
  (`src/components/terminal/workspace-shell.tsx`) mounts once and swaps views
  in place via a `REGISTRY: Record<ViewId, ComponentType>`.
- **Workspace state:** Zustand store in `src/stores/workspace.ts` with
  `persist` middleware. Holds `activeView`, `symbol`, `timeframe`,
  `sidebarCollapsed`, `commandOpen`, `connection` state, saved workspaces, and
  `lastBacktestId`. Persisted to `localStorage` under `zterminal-workspace`
  (partialized — connection state is NOT persisted).
- **Strategy state:** Zustand store in `src/stores/strategy.ts`, persisted to
  `localStorage` under `zterminal-strategy`. Holds the ZS source, last compile
  result, params, last backtest result, and backtest config.
- **Views** (`src/components/views/*`): `chart`, `markets`, `strategy`,
  `backtester`, `orderflow`, plus secondary views (`calendar`, `alerts`,
  `research`, `portfolio`, `risk`, `journal`, `connections`, `settings`).
- **Terminal primitives** (`src/components/terminal/primitives.tsx`): `Panel`,
  `PanelHeader`, `SectionLabel`, `StatRow`, `SimulatedTag`, `Pill`.
- **Shell chrome:** `Sidebar`, `Topbar`, `CommandPalette`. Keyboard shortcuts:
  `?` opens the palette; `g c / g s / g b / g o / g m` jump to views.

## 2. Provider abstraction layer

All providers implement `MarketDataProvider` from `src/lib/market/provider.ts`:

```ts
interface MarketDataProvider {
  readonly id: ProviderId;            // "mock" | "rithmic-test" | "rithmic-prod" | "databento"
  readonly environment: Environment;  // "simulation" | "paper" | "live"
  state(): ConnectionState;
  contracts(): ContractMetadata[];
  bars(symbol, tf, fromMs, toMs): Promise<Bar[]>;
  subscribe(req, onEvent): () => void;
}
```

The Rithmic family additionally implements `IRithmicProvider`, which adds
`login()`, `heartbeat()`, `restoreSubscriptions()`, `validateSequence()`, and
`logout()` — the lifecycle required by the Rithmic R | Protocol API. See
`RITHMIC_INTEGRATION.md`.

| Provider                  | Status        | Environment |
|---------------------------|---------------|-------------|
| `MockMarketDataProvider`  | IMPLEMENTED   | simulation  |
| `MockRithmicProvider`     | IMPLEMENTED (via `MockLiveMarket` / socket service) — SIMULATED, satisfies `IRithmicProvider` for dev | simulation |
| `RithmicTestProvider`     | INTERFACE ONLY | simulation (Rithmic Test / Exchange Simulator) |
| `RithmicProductionProvider` | INTERFACE ONLY | live (requires authorization) |

Analytics and the UI never import provider-specific code — they consume the
normalized types from `src/lib/market/types.ts`.

## 3. Market-data pipeline

```
Exchange ──► Provider adapter ──► Normalizer ──► Event Bus ──► WebSocket ──► Frontend
```

- **Exchange:** CME / CBOT / COMEX / NYMEX / NASDAQ / NYSE / ICE.
- **Provider adapter:** Mock (in-process + socket.io service) or Rithmic
  (interface-only stub). Adapters normalize native messages into
  `TradeEvent | QuoteEvent | DepthEvent | MBOEvent | BarEvent`.
- **Normalizer:** Enforces the schema in `MARKET_DATA_SCHEMA.md` — UTC
  timestamps, monotonic per-symbol sequence numbers, tick-aligned prices,
  `provider` + `environment` + `symbol` + `exchange` on every event.
- **Event bus / streaming:** A dedicated socket.io mini-service
  (`mini-services/market-data/index.ts`) listens on port **3003**. The frontend
  connects via the gateway transform: `io("/?XTransformPort=3003")` — it never
  hits the port directly. The service emits `trade`, `quote`, `depth` events
  per subscribed symbol at ~6 ticks/sec, all labeled `environment:
  "simulation"`, `provider: "mock"`.
- **Frontend subscription:** `useMarketStream(symbol, opts)` hook in
  `src/hooks/use-market-stream.ts` manages a singleton socket, restores
  subscriptions on reconnect, batches trades on `requestAnimationFrame`, and
  surfaces connection state into the workspace store.

## 4. Session model

`src/lib/market/session.ts` centralizes all timezone logic. Internally
everything is UTC; sessions are classified in ET (EST offset, simplified DST —
production would use a full tz database). `classifySession("cme" | "equity",
utcMs)` returns `{ label: "overnight"|"pre"|"rth"|"post"|"closed", isRTH }`.
The mock provider uses `sessionVolMultiplier(t)` to shape the U-shaped
intraday volatility profile (peaks at 09:30 and 16:00 ET, trough midday).

## 5. Deterministic backtest engine

`src/lib/strategy/zs-runtime.ts` exposes `runStrategy(src, bars, cfg, params)`
returning a `BacktestResult`. The execution model is anti-look-ahead: a signal
on `bar[i]` is filled at `bar[i+1].open` adjusted by slippage and commission.
Identical inputs always produce identical trades — the result carries a
deterministic `hash`. See `BACKTESTING.md` and `STATISTICS.md`.

## 6. ZS strategy runtime

- **Compiler:** `src/lib/strategy/zs-compiler.ts` — tokenizer → recursive
  descent parser → AST walker that extracts `input.*` declarations, the
  `strategy("name", …)` title, and emits `ZSDiagnostic`s. Returns
  `ZSCompileResult { ok, inputs, diagnostics, name, ast }`.
- **Runtime:** `src/lib/strategy/zs-runtime.ts` — evaluates the AST bar-by-bar
  against the close/high/low/open/volume arrays. Top-level `var` assignments
  become lazy thunks `(i) => value` so series like `ema(close, Fast)` support
  lookback for `crossover`/`crossunder`. Indicators (`ema`, `sma`, `vwap`,
  `highest`, `lowest`, `atr`, `rsi`, `stdev`) are memoized per period.

## 7. API routes

All routes are `force-dynamic`. All responses that carry market data include
`provider`, `environment`, and `dataStatus: "SIMULATED"`.

| Route                          | Method | Purpose |
|--------------------------------|--------|---------|
| `/api/contracts`               | GET    | Contract metadata for the symbol universe |
| `/api/markets`                 | GET    | Watchlist snapshot (last daily bar change %) |
| `/api/bars?symbol=&tf=&to=&bars=` | GET | Deterministic historical OHLCV bars |
| `/api/strategy`                | POST   | Compile + validate ZS source; return inputs + diagnostics |
| `/api/backtest`                | POST   | Run deterministic backtest; return trades + metrics + hash |

## 8. Persistence

- **Client:** Zustand `persist` → `localStorage` for strategy source, params,
  backtest config, and saved workspaces.
- **Server:** Prisma + SQLite is configured (`prisma/schema.prisma`,
  `src/lib/db.ts`) but the terminal does not yet write to it. See
  `DATABASE.md` for the production persistence plan.

## 9. Boundaries

- The Rithmic adapter runs **server-side only**. Credentials never cross to the
  browser.
- The mock provider needs **no secrets** and is the default for all development.
- The socket.io mini-service is a separate Node process reachable only through
  the gateway transform port.
