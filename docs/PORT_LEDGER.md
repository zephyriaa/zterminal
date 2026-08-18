# ZTerminal Port Ledger

**Canonical runtime:** `render-hosted-research-terminal` / Vite + React + Express + tRPC

**Rollback baseline:** `release/premium-attribution-baseline-20260818` → `b6ebef0f4a3d912beeac54bd26ff44e4e4b4e51a`

**Legacy source:** `origin/main` (unrelated history; read-only source of portable behavior)

> **Rule:** This ledger is the required bridge between the two independently rooted applications. An item may be ported only after its behavior contract, dependencies, fixtures, target location, test owner, and final presentation state are all identified. No direct branch merge is permitted.

## Disposition Legend

| Status | Meaning |
|---|---|
| `PORT NOW` | Portable, high-value, and not dependent on unprovided infrastructure or entitlement. |
| `VERIFY THEN PORT` | Requires a provider/protocol/security evidence spike before any product claim. |
| `DEFER — EXTERNAL` | Requires a database, OAuth configuration, provider entitlement, hosting decision, or operational input not presently available. |
| `DEFER — POST-CORE` | Valid product capability, deliberately sequenced after the evidence-led chart/research core. |
| `REMOVE / RELOCATE` | Legacy navigation or presentation removed; useful domain behavior must be moved to a canvas-adjacent drawer, palette action, or study layer. |

## Feature-to-Destination Matrix

| Legacy source and candidate behavior | Contract to preserve | Canonical target | Required fixture / test | Final product location | Status |
|---|---|---|---|---|---|
| `src/lib/strategy/zs-compiler.ts` | Closed tokenizer, parser, AST, diagnostics, typed `input` discovery; no arbitrary execution | `shared/strategy/zsCompiler.ts` and `server/strategy/compile.ts`; `strategy.compile` tRPC procedure | Valid/invalid source, deterministic diagnostics, declared input fixtures, no unsafe syntax acceptance | Research drawer → **Strategy** | `PORT NOW` |
| `src/lib/strategy/zs-runtime.ts` | Deterministic series evaluation and strategy actions; no network/import/shell/files/eval | `shared/strategy/zsRuntime.ts`, callable only from backtest worker/service | Anti-look-ahead, forbidden capability scan, indicator/series fixtures, same input = same output | Research drawer → **Backtest** | `PORT NOW` |
| `src/app/api/backtest/route.ts` and backtest domain behavior | Validated historical evaluation request/response; explicit market-only assumptions | `server/routers.ts` → protected `backtest.run` | Schema failure, rate limit, provenance, insufficient data, deterministic run identity | Research drawer → **Backtest** | `PORT NOW` |
| `src/domain/protocol/types.ts`, `policy.ts`, `generation.ts`, `data-assessment.ts` | Citation/scope checks, baseline fingerprinting, approval gate, incremental experiment rule | `shared/protocol/*`, `server/protocol/*`; research artifacts contract | Citation type, scope rejection, fingerprint immutability, approval and one-variable fixtures | Research drawer → **Hypothesis** | `PORT NOW` |
| `src/stores/institutional-protocol.ts` | Protocol queue and user-visible stage transitions | Canonical workspace state with local fallback, server persistence only when configured | Reducer/migration tests and local restoration test | Research drawer → **Hypothesis** | `PORT NOW` |
| `src/lib/market/gateio.ts` | Symbol, interval, candle, contract normalization; bounded upsert semantics | Extend `server/marketContracts.ts` / `server/marketData.ts` | Gate REST payload fixtures, invalid decimals, contract conversion, duplicate-bar upsert | Shared market layer | `PORT NOW` |
| `src/lib/market/provider.ts`, `types.ts`, `gateway-policy.ts` | Normalized provider capability/status/event boundaries | `shared/market/providerContracts.ts`, `server/providers/*` | State transitions, event schema validation, safe unsupported provider responses | Settings → Connections and chart status | `PORT NOW` |
| `src/lib/market/capabilities.ts` | Capability catalog: active vs catalogued vs blocked providers | `shared/market/providerCatalog.ts`; `market.providers` tRPC query | Catalog snapshot and no-active-claim tests | Settings → Connections; Studies explanatory surfaces | `PORT NOW` |
| `src/hooks/use-market-stream.ts` | Reconnect/backoff and render batching behavior | `client/src/hooks/useMarketStream.ts`; backed by verified canonical stream contract | Reconnect, sequence gap, subscription cleanup, stale-state UI tests | Chart data lifecycle | `VERIFY THEN PORT` |
| Gate.io trade / order-book WebSocket adapter | Exchange-side aggressor semantics, snapshot + ordered deltas, bounded buffering, stale detection | `server/providers/gateioRealtime.ts` and a broadcast boundary | Captured public events, snapshot/delta reconciliation, gap, timeout, reconnect fixtures | CVD / DOM / Footprint / Time & Sales | `VERIFY THEN PORT` |
| `src/components/views/orderflow-view.tsx` | User needs underlying DOM, footprint, CVD, tape context—not a standalone dashboard | New study-specific components; no direct view port | Browser visual and data-state tests tied to verified source fixtures | Studies drawer, right-scale popover/drawer, sub-pane, contextual drawer | `REMOVE / RELOCATE` |
| `src/lib/market/mock-provider.ts`, `rng.ts` | Deterministic, clearly labeled offline simulated data | `server/providers/mockProvider.ts`, client development-only toggle | Same seed = same series, no accidental `LIVE` label, production-guard test | Settings → Connections (development mode) | `PORT NOW` |
| `src/lib/market/session.ts` | Session classification and timeframe alignment | `shared/market/session.ts` after timezone/DST contract review | ET/DST/date boundary/session fixture tests | Studies → Sessions | `VERIFY THEN PORT` |
| `src/domain/risk/sizing.ts` / `engine.ts` | Fixed-risk sizing calculation inputs and results | `shared/risk/sizing.ts` | Zero/invalid stop, multiplier, size boundary tests | Command palette → Risk drawer | `PORT NOW` |
| `src/domain/alerts/evaluator.ts` | Deterministic alert-rule evaluation | `shared/alerts/evaluator.ts` | Crossing, invalid rule, dedupe, persistent local state tests | Command palette → Alerts drawer | `PORT NOW` |
| `src/domain/journal/performance.ts` | Execution-versus-theoretical comparison and journal analytics | `shared/journal/performance.ts` | Direction, partial fields, P&L comparison fixtures | Command palette → Journal drawer | `DEFER — POST-CORE` |
| `src/domain/analytics/market.ts` | Market analytics helpers | `shared/analytics/market.ts` | Pure function fixtures and source lineage checks | Research / Studies context | `DEFER — POST-CORE` |
| `src/domain/validation/resampling.ts` | Bootstrap, Monte Carlo, and walk-forward helpers | No target until a separately designed research-validation release | Correctness tests plus clear result limitations | Future research-validation release | `DEFER — POST-CORE` |
| `src/app/api/bars`, `contracts`, `markets`, `providers`, `strategy`, `backtest` | Functional API concepts, not Next route shape | Typed tRPC contracts; document their path and public/protected status | Contract integration suite | Internal API contract documentation | `REMOVE / RELOCATE` |
| `src/lib/market/contracts.ts` | Contract metadata model | `shared/market/contracts.ts` compatible with existing `marketContracts.ts` | Perpetual vs dated-future fixture tests | Market and backtest configuration | `PORT NOW` |
| `src/lib/db.ts`, Prisma schema and protocol records | Durable user-owned workspace, protocol, run, and artifact persistence | Extend existing Drizzle schema; maintain browser-local fallback until configured | Migration, auth ownership, export/restore, rollback tests | Authenticated Research workspace | `DEFER — EXTERNAL` |
| `src/components/terminal/command-palette.tsx` | Fuzzy route/action/symbol discovery | Adapt primitives to existing UI and accessible keyboard behavior | Keyboard, focus trap, command routing, mobile tests | Global command palette | `PORT NOW` |
| `src/components/terminal/code-editor.tsx` | Contextual source editing | Lazy-loaded research code editor or accessible textarea fallback | Load, edit, diagnostics, read-only baseline tests | Research drawer → Strategy | `PORT NOW` |
| `src/components/views/markets-view.tsx` | Multi-market discovery behavior | New compact Markets drawer; preserve existing preset/custom input | Search/load/favorite/local persistence tests | Command palette → Markets drawer | `PORT NOW` |
| `src/components/views/secondary-views.tsx` | Secondary navigation concepts | Split into narrowly scoped drawers; exclude placeholders | Every drawer must have a truthful state and no fake provider data | Palette / settings / notifications | `REMOVE / RELOCATE` |
| `src-tauri/*` | Desktop wrapper structure | Separate desktop compatibility branch after browser core passes | Build, signing, secure storage, update flow tests | Post-core desktop release | `DEFER — POST-CORE` |
| Legacy docs and roadmap | Methodology, limitations, architecture, security, deployment context | Curated documentation build from canonical files | Link checker, source annotation, public content review | `/docs` | `PORT NOW` |
| Legacy test suites | Domain and market behavioral assertions | Port/adapt to Vitest and canonical contracts | CI test manifest with migrated assertion evidence | CI and release gates | `PORT NOW` |

## Approved Removal and Relocation Decisions

| Legacy or current surface | Decision | Rationale |
|---|---|---|
| 13-tab sidebar | Remove from final form | It conflicts with the approved three-destination chart-first interaction model. |
| Standalone Order Flow view | Relocate | Data surfaces belong at chart context: CVD as study, DOM as right-scale popover/drawer, footprint as sub-pane, tape as contextual drawer. |
| Persistent legacy right-side context rail | Relocate | Crosshair context and drawers provide the function without consuming chart area. |
| Current shallow two-field Hypothesis Lab | Replace | It cannot meet the cited, immutable, reproducible protocol boundary. |
| GEX as active study | Keep unavailable and reframe | Gate.io public perpetual data cannot truthfully yield options-derived GEX. |
| Placeholder calendar/event rows | Hide until sourced | A static or illustrative surface must not appear finished. |
| Session-only alerts | Keep explicitly local or defer | They must persist accurately before being presented as a product capability. |
| Repository binaries and duplicate locks | Audit before removal | Clean only after dependency and documentation provenance has been verified. |

## Port Execution Rules

1. A port starts with a target contract and versioned fixture, not UI copy-paste.
2. Each port uses its own logical commit and is reviewed against this ledger.
3. Pure logic moves before rendering. Framework-specific UI is rewritten for the canonical drawer model.
4. A legacy behavior with undeclared data source, entitlement, or clock semantics remains unavailable until verified.
5. No `eval`, `Function`, dynamic import of user text, arbitrary fetch, arbitrary module import, file system access, shell access, or trading action may be introduced through strategy/research functionality.
6. Every final user-facing state declares local/durable, simulated/live/historical/stale/degraded/unavailable status as applicable.
7. The release tag above remains the tested rollback point until a later release has equivalent rollback evidence.

## Phase 0 Completion Criteria

- [x] Canonical production baseline tagged on GitHub.
- [x] Dedicated recovery branch created from the tagged baseline.
- [x] Direct merge prohibition confirmed from unrelated histories.
- [x] Feature-to-destination port ledger created.
- [ ] Legacy modules are individually source-reviewed before their port begins.
- [ ] Ledger decisions are represented in the issue/release tracker and tied to vertical-slice commits.
- [ ] The ledger and approved recovery plan are committed to the recovery branch.
