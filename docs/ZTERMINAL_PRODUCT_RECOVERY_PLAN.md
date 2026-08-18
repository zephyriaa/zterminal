# ZTerminal Product Recovery and Final-Form Plan

## Goal

Transform ZTerminal from its current chart-first recovery release into a **single, reliable, open-source financial research workstation**. The final product will retain the Vite/Express/tRPC Render runtime and its three-destination chart-first interaction model while restoring, through tested ports rather than a branch merge, the useful research, strategy, backtesting, provider, and protocol capabilities that remain on the unrelated `main` branch.

The product standard is deliberately higher than visual polish: a user must be able to move from **verified market context → stated hypothesis → constrained strategy definition → deterministic historical evaluation → reproducible evidence** without fabricated market data, hidden look-ahead, or implied execution capability.

> **Architecture decision already in force:** `render-hosted-research-terminal` is the production baseline. It is a Vite/React client with Express/tRPC services and the Render deployment. The unrelated Next.js/Prisma/Socket.IO `main` branch is a source of behaviors and tests, not a merge target. Every selected behavior will be ported behind a written contract, fixtures, and tests. No direct merge is permitted.

## Current Evidence and Planning Constraints

| Area | Verified present on canonical runtime | Material gap to close |
|---|---|---|
| User experience | Chart-first Canvas / Focus / Research interaction, three top-level destinations, native Lightweight Charts, study overlays, range controls, multi-symbol Gate.io input, and a premium visual shell | Focus is not sufficiently minimal; research is too shallow; command-driven secondary tools and mobile validation are missing |
| Data integrity | Bounded Gate.io candle requests, coverage disclosure, feature provenance/fingerprints, safe unavailable states, and no execution route | No normalized real-time trade/depth pipeline, stale-state contract, public readiness endpoint, or verified CVD/DOM/footprint capability |
| Research evaluation | Deterministic EMA20/50 + VWAP template, next-bar-open fills, simple FNV-1a run identity, and browser-local research drafts | No ZS strategy language, richer cost/metrics model, protocol controls, trade-marker workflow, or durable research evidence |
| Server API | `market.snapshot`, `market.bars`, `market.capabilities`, and authenticated draft endpoints through tRPC | No strategy compilation, backtest, contracts catalog, provider catalog, or readiness procedures |
| Operations | Render deployment, health endpoint, dependency overrides, TypeScript and Vitest gates | OAuth/database storage is unconfigured; no clear rate limiting, audit logging, CI enforcement, or production data-stream observability |
| Repository governance | A documented canonical-runtime ADR and release rollback history | Two divergent products remain; no port ledger, archival policy, or single-source release governance |

## Product Principles and Non-Negotiable Boundaries

The implementation will preserve a small top-level interface—**Chart, Research, Studies**—and move secondary capabilities into dismissible drawers or a command palette. It will not restore the legacy 13-tab sidebar. The chart must remain the dominant working surface, while Research becomes a split-pane, evidence-led workflow rather than a separate dashboard or a shallow form.

All user-facing market outputs must display provider, data status, coverage, timestamp basis, and limitations appropriate to the feature. Supported states are `LIVE`, `HISTORICAL`, `SIMULATED`, `STALE`, `DEGRADED`, `UNAVAILABLE`, and `DISCONNECTED`. Gate.io public data remains read-only; `execution: "disabled"` remains an inviolable health and product boundary. There will be no broker routing, order placement, hidden credentials in the browser, fabricated GEX, fabricated depth, synthetic order flow, or claims that a backtest establishes future performance.

The existing in-chart attribution removal remains compliant: the chart surface stays ZTerminal-branded, while the required public Lightweight Charts attribution is retained in the application footer.

## Workstreams and Release Sequence

### Phase 0 — Governance, Baseline, and Port Ledger

First, freeze the deployed production baseline as a tagged rollback point and make the Vite/Express/tRPC branch the only release source. Create a **port ledger** for every candidate module from `main`: source location, behavior contract, dependencies, fixture data, target module, test owner, license/provenance, and final user-facing location. The initial ledger must cover the ZS compiler/runtime, deterministic backtest model, Institutional Protocol Lab, Gate.io real-time adapter, capability catalog, mock provider, session engine, risk sizing, alerts, journal analytics, resampling validation, stores, and docs.

No implementation work will be copied until the port ledger identifies a portable, framework-independent contract. The legacy branch will remain read-only until the port ledger reaches release readiness; it will not be deleted. Once the canonical release demonstrably covers the required functions, convert it to an archived/reference branch with a clear README rather than silently leaving two competing products.

**Exit gate:** a signed-off feature-to-destination matrix proves that every useful legacy capability has one of three statuses: port now, defer with a defined external dependency, or remove with an evidence-backed reason.

### Phase 1 — Market Contracts, Provider Capability, and Operational Readiness

Strengthen the existing tRPC contracts rather than adding duplicate REST endpoints solely to mimic the unrelated application. Preserve `market.snapshot` and bounded `market.bars`; add typed procedures for `contracts.list`, `providers.list`, provider status, and authenticated capability discovery. Publish a concise API contract and map it to the client so the absence of old `/api/*` routes cannot be misinterpreted as absent functionality.

Implement a normalized provider boundary with a common event model for candles, ticker/BBO, trades, order-book snapshots, ordered deltas, contract metadata, and provider health. Add `/readyz` semantics that are intentionally non-ready when required provider state is unavailable or stale, while leaving `/healthz` limited to service health and execution-disabled status. Establish an explicit clock policy—UTC internally and named user/session timezones at presentation boundaries.

Before enabling any order-flow surface, run a provider verification spike against official Gate.io documentation and captured test fixtures. The spike must prove trade-side semantics, event ordering, snapshot-plus-delta reconciliation, stale detection, maximum supported depth, reconnect recovery, and exchange limitations. The current audit’s claim about CVD availability is a hypothesis to test, not a license to remove the gate prematurely.

**Exit gate:** contract tests demonstrate valid symbol, invalid symbol, partial historical coverage, provider timeout, reconnect/degraded status, readiness status, and provider catalog responses. Every returning value carries source, timestamp, coverage, and state.

### Phase 2 — Real-Time Data and Honest Order-Flow Layers

Add a server-side/public-feed real-time adapter appropriate to the verified Gate.io transport contract. It should centralize reconnect backoff, heartbeats, stale thresholds, subscription lifecycles, bounded buffers, and fan-out to authenticated or public read-only clients without exposing future credentials. Evaluate the production hosting behavior for long-lived connections and sleeping instances; if the current Render tier cannot meet the measured availability and latency requirement, document the requirement and present the hosting change as a separate user-approved operations decision.

Deliver CVD only after the Phase 1 evidence confirms exchange-reported side semantics. Compute it from verified trades, display its exact source and limitation, and separate any divergence cue as a labeled heuristic rather than a verified signal. Then port DOM, footprint, and Time & Sales incrementally: DOM as a right-scale popover with an expandable drawer, footprint as a chart sub-pane, and Time & Sales as a contextual drawer. Depth must use a snapshot-plus-sequenced-delta reconciliation model and fail visibly to `STALE`/`UNAVAILABLE` rather than manufacturing a ladder.

Retain GEX as disabled and rename it to **“Options-feed required (Deribit/CME/OPRA)”**. Add catalog-only provider entries and data contracts for options capability, but do not show strikes, Greeks, open interest, walls, flips, or GEX calculations until a licensed, verified options feed is connected.

**Exit gate:** recorded fixtures and browser tests prove CVD, DOM, footprint, and Time & Sales reflect real Gate.io events; disconnected or stale data is conspicuous; no unsupported order-flow or options claim can render as live.

### Phase 3 — Restore the Research Spine as a Chart-Context Drawer

Replace the shallow Research/Hypothesis implementation with a right-side Research drawer containing exactly three contextual tabs: **Hypothesis, Strategy, and Backtest**. Keep the chart visible and resizable at all times. Closing the drawer returns to full-width Canvas mode without destroying the current market context or verified result markers.

Port the Institutional Protocol Lab as framework-independent domain logic first. The Hypothesis tab will accept a retained rule source with citation/URL/DOI/PDF/pasted-text metadata, validate scope, extract entry/exit/sizing rules, preview data requirements, track a protocol queue, and create immutable baseline fingerprints. A baseline will lock only after explicit human approval. Any altered configuration or rule becomes a declared one-variable incremental experiment, never a silent re-run presented as a baseline.

Port the ZS language as a closed interpreter, not as arbitrary executable code. Preserve the tokenizer, recursive-descent parser, AST, diagnostics, typed inputs, safe built-ins, and strategy actions. Explicitly prohibit `eval`, `Function`, arbitrary imports, network access, file writes, shell access, broker credentials, and autonomous actions. Introduce `strategy.compile` as a validated tRPC contract, returning diagnostics and discovered inputs; use a lazy-loaded editor so the Chart path stays lean.

**Exit gate:** protocol and compiler contract tests pass against versioned fixtures; a user can produce a cited hypothesis, validate a safe ZS strategy, see diagnostics and input controls, and retain a deliberate human-approval boundary before a baseline can run.

### Phase 4 — Deterministic Backtesting and Evidence Presentation

Extend the existing deterministic template engine incrementally instead of discarding its tested next-bar-open behavior. Port the richer strategy runtime and result model behind a versioned execution contract: normalized and deduplicated bars; signal-on-close/fill-at-next-open; documented market-only fills; explicit commission, spread, slippage, tick size, multiplier, quantity, and capital; deterministic FNV-1a identity over source, parameters, data fingerprint, execution model, and costs.

Expose `backtest.run` through a protected, rate-limited tRPC procedure and move computationally heavy execution into a Web Worker or safe server job based on measured bar count and request cost. Return a reproducible evidence package: run ID/hash, engine version, complete data provenance, coverage, status, config, trades, equity, drawdown, monthly outcomes, and the documented metric set. Render the Backtest tab with metrics, equity, drawdown, virtualized trades, monthly outcomes, warnings, and visible `BASELINE · NO OPTIMIZATION` or `INCREMENTAL · ONE VARIABLE` classification. Overlay toggleable entry/exit markers on the chart.

The result will state that historical results are research evidence only and not proof of an edge. Walk-forward, Monte Carlo, parameter optimization, limit/stop simulation, and future-performance prediction will remain explicitly out of scope until separately designed and validated.

**Exit gate:** deterministic re-runs return identical hashes and trades; anti-look-ahead, costs, P&L, insufficient-data, provenance, marker placement, and baseline immutability tests pass; a long-window run does not block the interface.

### Phase 5 — Interaction Model, Secondary Drawers, and Accessibility

Refine the chart cockpit after the research spine is usable. Make Focus Mode truly minimal—chart, range control, and exit control only—with `Esc` as a reliable exit. Add a global command palette and keyboard map for Chart, Research, Studies, Focus, Markets, Alerts, and Risk; make it discoverable without adding a sidebar.

Implement secondary functionality as small, truthful overlays in this order: Markets (full Gate.io perpetual fuzzy search and favorites), Settings (theme, chart defaults, provider/connection status, keyboard map), Connections (provider state and a clearly labeled deterministic simulated development mode), Notifications, Risk sizing, persisted local alerts, and local trade-tagged journal data. Calendar will be hidden rather than shown as a placeholder until a suitable licensed provider is selected. Each surface will disclose whether state is local, authenticated/durable, session-only, simulated, or unavailable.

Add chart types, settings, future-bar projection, replay correctness, crosshair context, active studies, and trade marker controls only when their data and calculation contracts are defined. Ensure all transitions are drawer or state changes, not competing route changes. Validate desktop, laptop, ultrawide, tablet, and mobile layouts; mobile uses chart-first presentation and bottom-sheet drawers.

**Exit gate:** the three-destination navigation remains intact, chart area dominates by default, all relocated capability locations are discoverable through a drawer or palette, Focus Mode has no clutter, and responsive/browser-accessibility tests pass.

### Phase 6 — Persistence, Security, Observability, and Documentation

Before advertising cloud workspaces, make a persistence decision that matches the canonical runtime. The current Vite application uses Drizzle with no production database configured; therefore either provision a compatible managed database and retain the current ORM, or approve a separately tested migration. Do not simultaneously port Prisma, change ORM, and change storage engine. Define workspace ownership, migrations, backup/export, retention, and recovery first; keep browser-local drafts as an explicit fallback until the durable path is proven.

Configure OAuth and protected mutations only after the required production environment variables are available. Add per-user rate limits to expensive market, compile, and backtest procedures; production-origin CORS controls; CSRF verification for cookie-backed mutations; structured audit events for provider lifecycle, strategy saves, protocol approval, and backtest hashes; and secret handling that never places credentials in browser code. Ensure WebSocket/subscription authorization is validated before subscribing to future private or user-specific streams.

Publish methodology, provider limitations, study calculation rules, strategy-language reference, data-state semantics, deployment guidance, security boundaries, and the release/rollback policy under a public `/docs` surface. Maintain the compliant chart-library attribution in the footer.

**Exit gate:** durable state is not marked available until authenticated save/reload/export/restore tests pass; security tests cover rate limiting, mutation authorization, CORS/CSRF, unsafe runtime escapes, and log redaction; observability shows provider state and backtest events without secrets.

### Phase 7 — Performance, Quality Gates, and Controlled Release

Set measurable non-functional budgets only after baselining production and representative local hardware: initial chart readiness, chart frame responsiveness, 10,000-bar viewport behavior, long backtest latency, bundle size, memory, reconnect recovery, and mobile interaction. Memoize feature computations by data identity and parameters, virtualize large tables/ladders, code-split Research tooling, audit unused components/dependencies, and preserve current dependency hardening.

Build a quality pipeline around the canonical project’s actual commands—`pnpm check`, `pnpm test`, and `pnpm build`—then add a lint task and CI workflow that prevents release on failure. Extend testing with pure-domain, provider fixture, contract, component, browser end-to-end, security, accessibility, responsive, and production smoke suites. Every claim on the acceptance checklist needs a corresponding automated test or a captured, versioned manual verification artifact.

Release in reviewed vertical slices behind feature flags where a slice can alter data meaning or user trust. Each production deployment requires: passing CI, migration readiness where relevant, health and readiness checks, a public valid/invalid symbol smoke test, data-state validation, research/backtest reproducibility test, console-error review, rollback tag, and deployment record. Do not treat a deploy as proof of the feature’s correctness.

**Exit gate:** all relevant quality gates pass, production smoke tests have evidence, failure paths have honest UI states, and the rollback path is verified before broader release.

### Phase 8 — Freemium and Desktop Decisions (After the Core Is Trusted)

The open-source product should first make core market research, reproducible local strategies, and truthful historical evaluation accessible without payment. Only after the research workflow and durable account model are stable should the project define paid entitlements—for example, higher retained-history capacity, cloud workspace storage, shared protocols, additional verified providers, desktop distribution support, or advanced compute quotas. Entitlements must never gate correctness, falsify data availability, or obscure the execution-disabled boundary.

The existing Tauri wrapper will be evaluated against the final web app only after the browser version meets the release gates. Desktop build signing, auto-update, secure credential handling, and Windows distribution are a separate release plan, not an implicit side effect of the web rebuild.

## Verification Matrix

| Layer | Required evidence before release |
|---|---|
| Data adapters | Versioned Gate.io fixtures; valid/invalid symbol, bounded range, time alignment, partial coverage, timeout, reconnect, stale, and sequence-gap contract tests |
| Studies and order flow | Deterministic calculation tests; real-event fixtures; visible data state and methodology; unavailable-state tests for GEX and unsupported data |
| Compiler and protocol | Parser/AST/diagnostic fixtures; scope/citation validation; no-escape security tests; immutable baseline and one-variable incremental tests |
| Backtest | Determinism; no look-ahead; fill/cost/P&L correctness; provenance; insufficient data; marker alignment; worker non-blocking behavior |
| UI | Unit/component tests for drawers, focus behavior, market change, recovery states, accessibility, keyboard commands, and mobile bottom sheets |
| Security and persistence | Authorization, rate limit, CORS/CSRF, audit-log redaction, local/durable save and restore, export/backup tests |
| Production | Render build, health/readiness, verified data load, supported/unsupported symbol, drawer workflow, browser console, responsive screenshots, and rollback record |

## Decision Gates and Open Risks

| Decision or risk | Planned resolution before dependent work proceeds |
|---|---|
| Divergent branch histories | Preserve the deployed Vite branch as canonical; use a port ledger and contracts; never direct-merge `main` |
| Gate.io trade/depth semantics | Verify official transport documentation and capture fixtures before enabling CVD, DOM, footprint, or Time & Sales |
| Real-time connection reliability on current hosting tier | Measure connection persistence, cold-start behavior, and reconnect latency; seek explicit approval before any hosting-tier or cost change |
| Durable workspace storage | User must provide/configure database and OAuth environment values; choose a current-runtime-compatible storage path before claiming sync |
| GEX/options data | Remain unavailable until a real options feed, entitlement, schema, methodology, and attribution are approved |
| Strategy-runtime security | Keep ZS as a closed interpreter; add explicit no-eval/no-network/no-import tests before exposing compile/run capabilities |
| Freemium policy | Define product entitlements only after core trust and persistence; do not introduce billing or external payment operations in the recovery workstream |
| Calendar, alerts, and other secondary data | Integrate only an approved real provider or keep hidden/local with accurate state labels; no placeholder presentation as finished functionality |
| API automation / Manus API | No Manus API integration is needed for core market research. Treat it as a later optional assistant layer only, requiring explicit product scope, approval gates, and strict no-trading/no-credential boundaries |

## Assumptions

This plan assumes the current Render service remains the deployment target, Gate.io remains the initial public read-only provider, and the current Vite/Express/tRPC codebase is accessible for explicit ports. It assumes no database or OAuth production credentials have yet been supplied, no options provider entitlement exists, no brokerage/execution capability is requested, and the existing public charting-library attribution remains in place outside the canvas. Any of those changes would trigger a focused design review before implementation.

## Definition of Done

ZTerminal is not considered final merely because it looks premium or because a feature has a button. It is final only when the canonical deployed codebase is singular and governed; the chart-first interaction stays simple; every restored research workflow is contextual and testable; every data claim is sourced, status-labeled, and bounded; strategy evaluation is deterministic and non-executing; unavailable capabilities remain visibly unavailable; persistent user data has real ownership and recovery; security and operations are measurable; and the full release evidence meets the verification matrix above.

The implementation will proceed through small reviewed vertical slices in the phase order above, with no artificial deadline and no production change outside an approved release gate.
