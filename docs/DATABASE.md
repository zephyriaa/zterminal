# DATABASE

## 1. Current state

Z TERMINAL has **Prisma + SQLite** configured but does **not yet write to the
database**. The terminal currently runs on:

- **In-memory mock data** from the deterministic mock provider
  (`src/lib/market/mock-provider.ts`) and the socket.io mini-service
  (`mini-services/market-data/index.ts`).
- **`localStorage` persistence** via Zustand `persist` middleware for:
  - Strategy source (`stores/strategy.ts` → key `zterminal-strategy`)
  - Strategy params and backtest config (same store)
  - Saved workspaces, active symbol/timeframe, sidebar collapse
    (`stores/workspace.ts` → key `zterminal-workspace`)

The `persist` `partialize` functions deliberately exclude transient state
(connection state, last backtest result) — only stable user preferences and
authored content are persisted.

## 2. Prisma configuration

```prisma
generator client { provider = "prisma-client-js" }
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}
```

- **Client:** `src/lib/db.ts` exports a singleton `PrismaClient` (with
  `log: ['query']` in development) attached to `globalThis` to avoid hot-
  reload connection storms.
- **Schema:** `prisma/schema.prisma` currently contains the default Prisma
  scaffold (`User`, `Post`) — these are placeholders and are **not** used by
  the terminal. They will be replaced by the production models below.
- **Database file:** `db/custom.db` (path from `DATABASE_URL`).

## 3. Production persistence plan (roadmap)

When the terminal moves toward production persistence, the following entities
would live in SQLite (or a migrated target). This is **planned, not
implemented** — see `ROADMAP.md`.

### Strategies
Persist authored ZS source so it is shareable across devices and sessions
(localStorage is per-browser). Each strategy would store: id, name, source,
created/updated timestamps, and a content hash for change detection.

### Backtest runs
Every backtest result should be persisted with its **full config + hash** so a
run can be reproduced exactly. The deterministic hash in
`zs-runtime.ts` (FNV-1a over `src | cfg | params | barsCount`) makes a stored
run a first-class reproducible artifact:

```
BacktestRun {
  id           String   @id
  hash         String   @unique   // determinism key
  strategyId   String
  symbol       String
  timeframe    String
  from         Int                 // UTC ms
  to           Int
  config       String              // JSON-serialized BacktestConfig
  params       String              // JSON-serialized StrategyParams
  barsProcessed Int
  metrics      String              // JSON-serialized BacktestMetrics
  ranAt        DateTime
}
```

Storing the full config (commission, slippage, spread, tickSize/tickValue/
multiplier, positionSize, executionModel) alongside the hash means an audit can
re-derive the result from the source + bars, or replay it from storage.

### Journal entries
Trader journal entries tied to a symbol, session, and (optionally) a backtest
run — the foundation of the Journal view (Phase 9, scaffolded).

### Connection state
Persisted provider selection and last-known connection state so the terminal
restores the user's preferred environment on reload. (Note: **credentials**
are never persisted — see `SECURITY.md`.)

## 4. Migration path

1. Replace the placeholder `User` / `Post` models with the production models
   above (Strategy, BacktestRun, JournalEntry, ConnectionState).
2. Add a Prisma migration and a seed for the contract universe
   (`src/lib/market/contracts.ts` is the source of truth — contract metadata
   is intentionally NOT duplicated in the DB; it lives in code so it versions
   with the codebase).
3. Wire the `/api/strategy` and `/api/backtest` routes to persist runs and
   fetch prior runs by hash for reproducibility checks.
4. Keep `localStorage` for ephemeral UI preferences (sidebar collapse, command
   palette state) — these do not need server persistence.

## 5. What does NOT belong in the database

- **Contract metadata.** Lives in `src/lib/market/contracts.ts`. Code is the
  source of truth; metadata versions with the codebase.
- **Credentials.** Server-side environment secrets only — never persisted in
  the DB in plaintext, never logged. See `SECURITY.md`.
- **Mock data.** The deterministic mock provider regenerates bars on demand;
  there is no need to cache them.
- **Real-time tick history.** Streaming events are not persisted; only
  aggregated bars / backtest results are.
