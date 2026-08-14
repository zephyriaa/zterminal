# ZTerminal Implementation Baseline Audit

**Status:** In progress. This document records verified observations made before implementation changes.

## Live-product observations — 2026-08-14

The public `https://zterminal.onrender.com` endpoint exposes a single-page terminal shell with navigation for Markets, Calendar, Alerts, Chart, Order Flow, Strategy Builder, Backtester, Research Lab, Portfolio, Risk, Journal, Connections, and Settings. The server-rendered public content describes the product as a quantitative research terminal and exposes no visible trade-execution control in the observed view.

A follow-up browser rendering attempt returned an empty `about:blank` document rather than the deployed page. Therefore, interactive live verification—including responsive behavior, network state, chart rendering, and individual route/view behavior—is **NOT VERIFIED** in the browser environment at this time. This does not supersede the repository-level implementation evidence recorded in the subsequent sections.

## Repository baseline — verified so far

| Area | Observation | Status |
|---|---|---|
| Frontend | Next.js 16 App Router, React 19, TypeScript, Tailwind CSS, shadcn/ui, Zustand, React Query, and Socket.IO client are declared in `package.json`. | Verified |
| Routing | The web app is a single root route with a client-side workspace shell that swaps terminal views. | Verified |
| Realtime | A dedicated Node/Socket.IO market-data gateway exists and uses a public, read-only Gate.io USDT perpetual feed in the default mode. | Verified |
| Simulation | The mock provider is deterministic for historical bars and explicitly labels mock data as simulated. | Verified |
| Strategy/backtesting | A custom ZS parser/runtime and deterministic backtest API are present. | Verified; full calculation integrity remains to be assessed |
| Persistence | Prisma is configured against SQLite, but only generic `User` and `Post` models exist and the application documentation states the terminal does not write product data to it. | Verified |
| Desktop | No Tauri project/configuration was found in the repository inventory. | Verified |
| Autonomous execution | The current Gate.io integration is documented and implemented as read-only public market data. The Rithmic form is approval-gated and returns unavailable. | Verified |

## Baseline quality checks

| Check | Result | Evidence / notes |
|---|---|---|
| Dependency installation | Completed with `npm ci --ignore-scripts`. | NPM reported 6 known dependency vulnerabilities: 4 moderate and 2 high. Exact advisories are pending `npm audit` review. |
| Prisma client generation | Passed with `npm run db:generate`. | Needed before TypeScript could resolve `PrismaClient`. |
| Typecheck | Passed after Prisma client generation. | `npm run typecheck` exited successfully. |
| Automated tests | Passed. | `npm test` passed 7 tests covering selected Gate.io normalization/order-book and strategy-language paths. |
| Lint | Failed. | ESLint reports 3 React-state/immutability errors in `orderflow-view.tsx` and `secondary-views.tsx`. |
| Production build | Not run because the combined lint/build command stopped on the lint failure. | Must rerun after stabilization fixes. |

No product code has been changed in this audit step.

## Sources

The statements in this document are based on the current repository at commit `a79912e` and the public deployment URL supplied by the project owner.

## Existing System Map

### Current runtime topology

```text
Browser
  └─ Next.js single-route workspace shell (`/`)
       ├─ REST route handlers (`/api/*`)
       └─ Socket.IO client (`/socket.io`, same origin in production)

Host process supervisor
  ├─ Next.js application process (port 3000)
  └─ Market-data gateway process (port 3003, intended as internal-only)
       └─ Public, read-only Gate.io USDT perpetual REST + WebSocket feeds

Optional local development mode
  └─ Deterministic mock market provider, explicitly marked `SIMULATED`

Prisma configuration
  └─ SQLite schema with generic `User` and `Post` models; no current product-domain access path
```

| Layer | Verified implementation | Current limitation / boundary |
|---|---|---|
| Web application | A Next.js 16 / React 19 / TypeScript single-page terminal in `src/app/page.tsx` and `src/components/terminal/workspace-shell.tsx`. | There are no dedicated URLs for user workflows, shareable deep links, route-level authorization, or route-specific loading/error boundaries. |
| UI components | Reusable terminal primitives plus chart, markets, strategy, backtester, order-flow, and secondary feature views. | Substantial financial logic and provisional data are still embedded in client views, especially risk, alerts, journal, portfolio, and research. |
| State | Zustand stores persist workspace, strategy source, parameters, local backtest result/configuration, and chart preferences in `localStorage`. | State is single-browser, unauthenticated, not durable across devices, and not auditable. |
| HTTP APIs | Read-only contracts, market snapshot, historical bars, strategy compilation, deterministic backtest, provider catalog, and a rate-limited Rithmic connection boundary are implemented. | No authenticated product API, resource ownership, persistence API, durable alert/journal/risk service, or order-execution API exists. |
| Realtime gateway | Socket.IO gateway establishes a public Gate.io market-data connection, manages subscriptions, buffers/rebuilds order books, retries connections, and emits `LIVE`, `STALE`, `DEGRADED`, `UNAVAILABLE`, or simulation states. | The gateway is a singleton process with in-memory subscriptions/state, has no client authentication, and is currently oriented to one public perpetual-feed integration. |
| Market-data domain | Normalized event and contract types support trades, quotes, depth, MBO, bars, contracts, connections, orders, executions, positions, and account snapshots. Gate.io adapter parses external data and mock provider is deterministic. | Historical bar model lacks provenance and quality fields at the entity level; no durable market-data store, provider entitlement model, exchange calendar service, corporate-action model, or data-quality ledger exists. |
| Analytics | Chart displays session VWAP and EMAs; order-flow view derives DOM, footprint, and CVD from current public trades/depth. | VWAP, ORB, profile, volatility, and regime are not independent, reusable domain services with tested input/output contracts. Public Gate.io depth is not a substitute for licensed MBO/order-flow coverage. |
| Strategy | A ZS custom strategy language has a tokenizer/parser/compiler and runtime. Strategies can expose parameters and issue runtime entries/exits. | Definitions are source text and browser-persisted only; no immutable strategy version, structured rule schema, validation artifact, dataset binding, ownership, or compatibility policy exists. |
| Backtesting | `POST /api/backtest` obtains historical Gate.io data and invokes a deterministic bar-by-bar runtime with next-bar-open fills, directional slippage, commission, trade log, equity, drawdown, and selected performance metrics. | Backtests are not persisted; no repeatable historical dataset snapshot/content hash, limit/stop/bracket fill simulation, spread application, multi-instrument/timeframe coordination, or robust validation workflow exists. Sharpe/Sortino annualization is explicitly only approximate for intraday bars. |
| Statistical validation | Basic profit/loss, drawdown, exposure, streak, Sharpe, Sortino, and Calmar calculations exist. | Monte Carlo, bootstrap, walk-forward, out-of-sample analysis, parameter sensitivity, regime segmentation, confidence intervals, and false-discovery safeguards are absent. |
| Risk | An illustrative client-side fixed-risk size calculator uses static contract metadata. | There is no independent server/domain risk engine, account policy, daily/weekly loss limit, correlation/exposure calculation, audit reason, or enforced trade-plan gate. |
| Alerts | The UI can create above/below alerts in React component state. | Alerts are session-only; no durable rule, evaluator, event bus, rate control, de-duplication, notification channel, status audit, or delivery retry exists. |
| Journal / performance | The UI records browser-memory free-text entries. | No trade import/recording service, journal schema, annotations, data linkage, theoretical-vs-actual performance analysis, or durable reporting exists. |
| Portfolio / brokers | A static simulated portfolio view is present. Gate.io integration is public/read-only. The Rithmic request form clears password and the server refuses operational connection. | There is no account/position ingestion, broker authorization, read-only account adapter, execution permission model, manual order-confirmation flow, or order routing. |
| Authentication / tenancy | `next-auth` is declared but no source references to it, `NextAuth`, or an authentication entry point were found. No database access outside Prisma setup was found. | All browser state and API access are currently unauthenticated and unscoped; production multi-user handling is absent. |
| Database / migrations | Prisma is configured for SQLite and has only `User` and `Post`. | There are no Prisma migration directories, product-domain tables, repository abstractions, backup/recovery controls, or production database design. |
| Desktop | No `src-tauri`, Tauri configuration, Cargo manifest, or native client implementation was found. | The required Windows desktop terminal is entirely missing. |
| Deployment / operations | Dockerfile, Caddyfile, Railway configuration, a two-process startup script, and `/healthz`/`/readyz` on the gateway are present. | No CI workflow was found. Environment template referenced by documentation is absent. Observability remains console-based; there is no structured logging, tracing, error reporting, metric collection, backup/restore automation, staging isolation evidence, or deployment rollback control. |

## Gap Analysis Against the Approved Architecture

| Target component | Assessment | Evidence-based gap and implementation implication |
|---|---|---|
| Shared domain core | Needs Refactor | Market and strategy types exist, but ownership is inconsistent and risk/journal/alert/validation entities are absent. Create a dependency-constrained domain layer before new product behavior. |
| Web terminal foundation | Partial | Existing dense workspace, command palette, keyboard navigation, charts, and status labels are useful foundations. Stabilize lint and improve workflow boundaries rather than rewrite the terminal shell. |
| Tauri Windows terminal | Missing | No desktop files exist. It must follow the shared-core/service boundaries after the web/domain foundation is stable; a wrapper to the Render URL is not acceptable. |
| Market-data gateway | Partial | Gate.io public read-only data and recovery logic are real; provider abstraction and richer event types exist. Add provider contracts, data-quality/freshness policy, persistence/caching, calendars, entitlement boundaries, and tested multi-provider lifecycle without presenting public depth as institutional order flow. |
| Historical data layer | Partial | Historical Gate.io bars are fetched and normalized but not versioned or stored. Introduce dataset records, quality flags, provenance, UTC/exchange-calendar semantics, cache persistence, and replay-safe retrieval. |
| Analytics services | Partial | Chart/order-flow calculations demonstrate product value but are presentation-coupled. Extract deterministic VWAP, ORB, profile, volatility, and regime modules with schemas and golden tests. |
| Strategy engine | Partial | ZS source compiler/runtime exists and should be preserved initially. Add structured strategy metadata, immutable version records, rule contracts, capability limits, migrations, and server-side ownership; do not replace the DSL indiscriminately. |
| Backtester | Partial | Deterministic next-bar-open logic, costs, trade logs, and metrics exist. Correctness gaps include incomplete fill types, inactive spread modeling, no dataset snapshot, no persistent result, and approximate intraday risk metrics. Expand only under strict golden, leakage, and realistic-fill tests. |
| Validation engine | Missing | No OOS, walk-forward, perturbation, bootstrap, Monte Carlo, sensitivity, or robustness artifacts exist. Build on persisted strategy/dataset/backtest contracts rather than directly in UI. |
| Risk engine | Missing | Current browser calculator is illustrative and has no policy enforcement. Replace with a pure, independently tested domain engine and audit-gated trade-plan evaluation. |
| Alerting | Missing | Component-state price thresholds do not constitute a service. Implement durable alert definitions, evaluator worker, deduplication/throttle, delivery adapters, status, and audit trail; never produce imperative trade directives. |
| Journal / performance | Missing | Session notes and static portfolio cannot supply a trade-review system. Add durable journal/trade models, imports/manual records, strategy/run linkage, annotations, and theoretical-vs-actual analysis. |
| Manual execution workflow | Missing | No order route is implemented, which correctly protects the current product. Build a permissioned trade-plan review and user-decision record first; retain execution disabled by default and defer any broker order routing until separately approved. |
| Identity / authorization | Missing | No code-level authentication or tenancy is implemented. Implement this before durable user data or credential/broker functions. |
| Security / operational controls | Needs Refactor | Rithmic boundary and explicit provider labels are positive. Critical gaps are lack of auth/authorization, broad default Socket.IO CORS when origin is unset, no CI, no secret scanning, no dependency remediation policy, no audit log, and no production-grade observability. |
| Data persistence | Missing | Generic SQLite placeholder schema is insufficient. Replace with migrations for product-domain entities and choose a production relational store before user data goes live. |

## Gating Defects and Risks Before Feature Development

| Priority | Finding | Impact | Required action |
|---|---|---|---|
| P0 | `npm run lint` currently fails with three React correctness violations. | The repository has no clean static-analysis baseline, and the combined production verification flow stops before building. | Repair the order-flow render-time mutation and state-derivation effects, then rerun lint, typecheck, tests, and build. |
| P0 | No authentication, authorization, or tenancy exists. | Durable strategy, journal, alert, broker, or account data would be globally exposed or unowned. | Establish identity/workspace/user-ownership boundaries before persisting product data. |
| P0 | No product-domain migrations or repository persistence exist. | Financial artifacts cannot be reliably preserved, reproduced, migrated, or recovered. | Introduce a migration-based schema and data-access boundary before durable features. |
| P0 | Dependency audit reports six production dependency vulnerabilities, including high-severity `js-yaml` and `sharp` paths. | Known supply-chain/security risk needs owner-reviewed remediation before production hardening. | Triage advisory reachability, update/pin compatible packages, and add automated dependency scanning; do not use force upgrades without compatibility verification. |
| P1 | Current backtests use live-provider historical responses but do not persist a content-addressed data snapshot. | Results cannot be fully reproduced if provider corrections, gaps, or pagination behavior change. | Add dataset/provenance/version records, integrity checks, and reproducibility contracts before validation features. |
| P1 | The current risk calculation runs inside a view and is labelled illustrative. | It cannot safely govern trade plans or user decision support. | Move calculations to a pure shared domain module with test vectors; enforce policy separately. |
| P1 | Socket gateway state and client subscriptions are in-process. | Horizontal scale or restart can lose subscriptions/state and may misrepresent feed continuity. | Design explicit reconnect/freshness contract, event/idempotency policy, and shared state only if actual deployment scale needs it. |
| P1 | Public market data is currently narrowly scoped to Gate.io USDT perpetuals. | Asset-class expansion, order flow, market depth, and redistributed data cannot be assumed. | Add provider capability/entitlement validation before adding product claims or UI controls. |
| P1 | No CI or staging/deployment evidence was found. | Regressions and insecure configuration can reach production without gates. | Add a workflow for lint/typecheck/tests/build/security scans, plus environment-specific config and deploy checks. |
| P2 | Secondary feature views contain sample/static/session-only data. | UI can overstate operational capability without explicit labels. | Preserve honest labels now; replace one workflow at a time after durable backend contracts are ready. |
| P2 | No Tauri implementation. | Windows-native value is unavailable. | Start only after shared web/domain/API contracts are stabilized; introduce native capabilities progressively. |

## Concrete Implementation Sequence

The implementation sequence below is binding for the first engineering increments. It follows **correctness → reliability → security → performance → UX → visual polish** and preserves working components where possible.

1. **Stabilization baseline.** Resolve the three lint errors without changing product behavior. Re-run lint, typecheck, deterministic tests, and production build. Add missing test coverage around the corrected calculations and capture the clean baseline.
2. **Foundation decision record.** Create architecture decision records for the monorepo/module boundary, identity/workspace model, production relational database, durable job/event model, and server-side secret/market-provider boundaries. Do not begin durable financial features before these decisions and migrations are accepted.
3. **Domain and persistence spine.** Add strongly typed domain contracts and migration-backed entities for workspace, instrument metadata, data dataset/provenance, strategy/version, backtest run/artifact, risk plan/evaluation, alert definition/delivery, trade plan, journal entry, and audit event. Keep existing ZS language and current REST/view surfaces compatible during the migration.
4. **Data-quality and analytics extraction.** Formalize historical/realtime data validation, freshness, UTC/exchange calendar semantics, provider capability disclosure, and cache/retention boundaries. Extract pure VWAP/ORB/profile/volatility/regime modules with documented inputs/outputs and golden tests before wiring user interfaces.
5. **Research and backtest hardening.** Persist reproducible strategy/dataset/backtest artifacts; add realistic fill-model expansion, tested performance-statistics definitions, and full provider provenance. Do not add validation until core backtest reproducibility passes golden, leakage, and fault tests.
6. **Validation, risk, alerts, and journal.** Implement the validation service followed by independent risk evaluation, durable contextual alerts, manual trade-plan approval records, journal capture, and strategy-edge-versus-trader-execution analytics. Execution remains disabled.
7. **Desktop client.** Add Tauri only when shared UI/domain/API boundaries are stable. Implement native secure storage, desktop notifications, workspace persistence, shortcuts, and window management under least privilege; no website wrapper and no local plaintext secrets.
8. **Production hardening.** Add CI/CD, environment promotion, structured logs/redaction, metrics, error reporting, backup/restore tests, load/failure tests, dependency remediation, and deployment health checks. Evaluate worker/runtime placement using observed capacity and realtime needs.

No functional product code will be changed until this assessment is reviewed as complete in the work log and the stabilization sequence begins.

## References

[1]: https://zterminal.onrender.com "ZTerminal public deployment"
[2]: https://github.com/zephyriaa/zterminal "ZTerminal source repository"

## Change Report — Stabilization Baseline

### What changed

The initial audit identified three lint errors that prevented the repository from reaching a clean production verification baseline. The order-flow cumulative bid depth is now derived immutably with a typed reducer. The alerts view no longer synchronizes the selected symbol through a render-adjacent effect; it resolves the valid active symbol only when an alert is created. The risk calculator now derives its default stop distance from the current instrument and only preserves a user-entered value for that same instrument, removing an unnecessary state-reset effect.

### Why

These changes correct React rendering and state-management violations without altering financial calculations, data providers, strategy semantics, execution behavior, or user permissions. They are intentionally narrow to preserve existing functionality while enabling the lint/typecheck/test/build quality gate.

| Files affected | Change type | Dependency impact |
|---|---|---|
| `src/components/views/orderflow-view.tsx` | Replaced render-time accumulator mutation with a typed immutable cumulative-depth derivation. | No package, API, provider, or data-model change. |
| `src/components/views/secondary-views.tsx` | Removed direct state updates from effects in Alerts and Risk; retained visible behavior through derived values/event-time validation. | No package, API, provider, or data-model change. |
| `docs/IMPLEMENTATION_BASELINE_AUDIT.md` | Added the existing-system map, gap analysis, implementation sequence, and this factual change record. | Documentation only. |

### Tests performed

| Check | Result |
|---|---|
| `npm run lint` | Passed. |
| `npm run typecheck` | Passed. |
| `npm test` | Passed: 7 tests, 0 failures. |
| `npm run build` | Passed: optimized Next.js production build and standalone asset-copy step completed. |

### Remaining risks

The stabilization pass does not resolve the architectural P0/P1 gaps recorded above: identity/authorization, product-domain persistence/migrations, CI, dependency remediation, durable data provenance, and independently tested financial-domain services remain outstanding. Browser-interactive live deployment verification is also still **NOT VERIFIED** because the browser renderer subsequently returned `about:blank`.

### Next implementation step

The next increment is the **shared core and persistence foundation**. It must introduce dependency boundaries and migration-backed product-domain entities before durable strategy, risk, alert, journal, validation, broker, or desktop functionality is added.

## Change Report — Shared Domain and Persistence Foundation

### What changed

A framework-independent `src/domain/` layer now defines reusable contracts for market observations, data provenance, regimes, trading setups, risk plans and evaluations, review-only trade plans, contextual alerts, journal entries, and performance comparisons. It includes pure services for fixed-risk sizing and trade-plan risk evaluation; session VWAP, opening range, OHLCV volume profile, volatility, and transparent regime classification; structured strategy-definition validation; deterministic bootstrap/Monte Carlo path resampling and purged walk-forward windows; contextual alert evaluation; and theoretical-versus-actual execution comparison.

The existing Risk view now delegates fixed-risk quantity calculation to this shared domain layer. Existing market providers, ZS compiler/runtime, strategy editor, backtester, UI navigation, and all execution-disabled behavior are retained unchanged.

The Prisma schema has been replaced with a migration-ready, additive product-domain design. It retains the unused legacy `Post` table solely to avoid destructive migration behavior against the existing local schema. The new schema adds workspace, immutable strategy version, dataset provenance, backtest artifact, risk plan, alert definition, journal, and redacted audit-event entities. It stores no broker credentials, API keys, tokens, or order-routing authority. The Prisma client no longer logs query payloads by default, and `.env.example` now documents safe non-secret runtime variables.

### Files and modules affected

| Area | Files | Purpose |
|---|---|---|
| Shared domain | `src/domain/models.ts`, `src/domain/risk/*`, `src/domain/analytics/market.ts`, `src/domain/strategy/schema.ts`, `src/domain/validation/resampling.ts`, `src/domain/alerts/evaluator.ts`, `src/domain/journal/performance.ts` | Isolate deterministic financial and workflow logic from React, HTTP, database, browser storage, and provider implementations. |
| Web UI | `src/components/views/secondary-views.tsx` | Use the shared fixed-risk sizing calculation while retaining the existing presentation and illustrative label. |
| Persistence | `prisma/schema.prisma`, `prisma/migrations/20260814115900_legacy_baseline/migration.sql`, `prisma/migrations/20260814120000_product_domain_foundation/migration.sql`, `prisma/migrations/migration_lock.toml` | Establish an additive, migration-tested foundation for durable artifacts. |
| Logging/configuration | `src/lib/db.ts`, `.env.example` | Avoid default query-payload logging and document non-secret local/deployment configuration. |
| Tests | `tests/domain-core.test.ts` | Cover risk, analytics, structured strategy validation, resampling, alerts, and journal-performance comparison. |
| Architecture record | `docs/ADR-0001-SHARED-DOMAIN-CORE.md` | Define the shared-core boundary and explicit non-goals. |

### Verification performed

| Check | Result |
|---|---|
| Fresh-database migration deployment | Passed. Both legacy baseline and additive product-domain migrations applied successfully to an isolated temporary SQLite database. The tracked `db/custom.db` was not modified. |
| Prisma client generation | Passed. |
| Automated tests | Passed: 16 tests, 0 failures. Includes the new pure-domain coverage and the prior Gate.io/strategy tests. |
| Typecheck | Passed. |
| Lint | Passed. |
| Production build | Passed. |

### Remaining risks and next step

The schema is not yet connected to authenticated product APIs, and the current deployment must **not** apply the migrations until a deliberate production database backup, migration-history adoption plan, owner/tenant design, and staging rehearsal have been completed. The risk/alert/journal/validation modules are pure shared foundations; they do not yet create durable records, schedule alert evaluation, send notifications, execute trades, or expose new production UI flows.

The next increment should introduce a server-side application-service boundary with authenticated workspace ownership before wiring persisted strategies and backtest artifacts. It must not invent authentication credentials, make a broker connection, or enable execution.

## Change Report — Native Tauri Desktop Client

### What changed

A real Tauri v2 desktop project now lives in `src-tauri/` and bundles a separate local Vite frontend from `desktop/`. It does **not** load, iframe, or wrap the deployed web application. The desktop shell provides a resizable native window, keyboard-accessible command palette, local workspace preferences, a Risk view that imports the same fixed-risk sizing module as the web client, explicit connection/data-status placeholders, and a manual Trade Plan view that makes its absence of broker connectivity and order routing visible.

The native Rust command surface contains only `desktop_status`, which reports a fixed **execution disabled** security posture. It contains no broker integration, secret storage, filesystem access, credential handling, token handling, or order-routing command. The Tauri capability grants the main window only core defaults plus the specific global-shortcut permissions needed for `Ctrl/Cmd+Shift+P`; no broad filesystem, shell, or remote API permission is granted. Tauri's capability system is designed to constrain frontend exposure to native privileges, and its documentation advises defining capabilities per window with explicit permissions. [3] The updater is not configured because a signing key, authenticated release endpoint, and Windows release workflow do not yet exist; Tauri's updater requires signed artifacts and protects the private signing key. [4]

| Area | Files | Result |
|---|---|---|
| Local desktop frontend | `desktop/index.html`, `desktop/src/main.ts`, `desktop/vite.config.ts` | Bundled local terminal shell, palette, layout persistence, shared risk sizing, and visible execution-disabled status. |
| Native runtime | `src-tauri/Cargo.toml`, `src-tauri/build.rs`, `src-tauri/src/lib.rs`, `src-tauri/src/main.rs`, `src-tauri/tauri.conf.json` | Tauri v2 runtime with a narrow `desktop_status` command, resizable window, local Vite assets, and Windows NSIS/MSI packaging configuration. |
| Permission model | `src-tauri/capabilities/main.json` | Explicit main-window capability permits only global-shortcut registration/status/unregistration in addition to core defaults. |
| Brand asset | `src-tauri/icons/` | Standard native icon set generated deterministically from the existing ZTerminal mark; the existing brand artwork was not semantically changed. |
| Build configuration | `package.json`, `package-lock.json`, `eslint.config.mjs` | Added local desktop build/launch scripts, Tauri dependencies, Vite, and generated-artifact lint exclusions. |

### Verification performed

| Check | Result |
|---|---|
| Local desktop frontend build | Passed: Vite bundled the local desktop assets successfully. |
| Native Tauri compile check | Passed: `npm run tauri build -- --no-bundle` built the native Linux binary successfully after local toolchain/dependency setup. |
| Full web and desktop verification | Passed: 16 automated tests, TypeScript check, lint, web production build, local desktop build, and native compile check all completed successfully. |
| Windows installer | **NOT VERIFIED**: this Linux environment compiled the native implementation but did not build an NSIS/MSI artifact. A Windows CI runner remains required for signed installer verification and Windows WebView2 behavior. |

### Security and operational limitations

The native client currently stores only non-sensitive local workspace/calculation preferences in browser storage. It must not be presented as a credential vault, a broker workstation, a persistent alert runner, or a production order-routing client. The bundled CSP permits only the local bundle and the known ZTerminal HTTPS origin for future server API use; current desktop code does not fetch market data from it. Tauri's store plugin is intentionally not used for secrets because it persists an application file rather than establishing an OS-backed credential design. [5]

### Next implementation step

The next increment must harden the delivery and operating model: CI gates, dependency remediation, environment separation, structured/redacted observability, deployment health policy, migration rehearsal, and Windows build/signing design. Production API persistence and authentication remain prerequisites before durable desktop synchronization or account workflows.

## References

[3]: https://v2.tauri.app/security/capabilities/ "Tauri v2 capabilities documentation"
[4]: https://v2.tauri.app/plugin/updater/ "Tauri v2 updater documentation"
[5]: https://v2.tauri.app/plugin/store/ "Tauri v2 store plugin documentation"

## Change Report — Security, Delivery, and Operational Hardening

### What changed

The web build now enforces TypeScript correctness rather than ignoring build-time type errors, and React strict mode is enabled. Baseline HTTP response protections now prevent MIME sniffing, restrict framing to same-origin, limit referrer disclosure, remove unused browser permissions, and isolate the browsing context. The realtime gateway now permits deployed same-origin traffic by default while denying cross-origin browser access unless exact origins are configured. It also limits each client to 1–20 active symbol subscriptions, rejects unsupported event types, and emits only the event types each client explicitly requested.

The initial dependency audit reported six production vulnerabilities, including two high-severity paths. Source inspection confirmed that `@mdxeditor/editor`, `react-syntax-highlighter`, and `sharp` were direct but unused dependencies. They were removed rather than force-upgraded across breaking major versions. The resulting production dependency audit reports **zero vulnerabilities at the high threshold**.

A GitHub Actions workflow now runs locked dependency installation, Prisma generation, isolated fresh-database migration deployment, tests, typecheck, lint, web build, local desktop build, high-severity production audit, and production-audit artifact capture on pull requests, main-branch pushes, and manual dispatch. A Windows job creates unsigned NSIS/MSI artifacts and exposes them as workflow artifacts; signing and release publication are deliberately absent until a protected signing-key/release process is approved.

| Area | Files | Result |
|---|---|---|
| Web release gate | `next.config.ts` | Type errors fail builds; React strict mode and baseline response security headers are enabled. |
| Realtime gateway | `src/lib/market/gateway-policy.ts`, `mini-services/market-data/index.ts`, `tests/domain-core.test.ts` | Same-origin production traffic is allowed while unlisted cross-origin traffic is denied; subscriptions are capped/validated; event fan-out honors requested event types. |
| Dependency hygiene | `package.json`, `package-lock.json` | Removed three unused direct dependencies carrying the observed production advisories; high-threshold audit now passes. |
| CI / Windows artifact path | `.github/workflows/quality.yml` | Adds reproducible quality, migration, audit, and Windows desktop artifact gates. |
| Configuration / repository hygiene | `.env.example`, `.gitignore`, `eslint.config.mjs` | Documents required gateway variables and excludes generated web/native artifacts from version control and lint. |

### Verification performed

| Check | Result |
|---|---|
| Production dependency audit | Passed: `npm audit --omit=dev --audit-level=high` reported 0 vulnerabilities. |
| Fresh migration deployment | Passed: both migrations applied to an isolated temporary SQLite database. |
| Automated tests | Passed: 17 tests, 0 failures. Includes gateway origin and subscription-policy coverage. |
| Typecheck and lint | Passed. |
| Web production build | Passed with build-time TypeScript checking enabled. |
| Desktop bundle and native compile | Passed: local Vite bundle and native Tauri release compile check completed. |
| Change-set whitespace | Passed: `git diff --check` completed with no reported issue. |

### Remaining risks and required rollout gates

The workspace/domain persistence schema is migration-tested but has not been applied to the tracked development database or any deployment database. Before applying it outside an isolated database, create a backup, record migration-history adoption for the pre-existing `User`/`Post` schema, rehearse against a staging copy, and define the production database target. Authentication/tenant ownership, durable server APIs, worker-based alert evaluation, provider entitlement controls, structured remote logging/metrics, backup restoration drills, and signed Windows release builds are still **NOT VERIFIED** and must precede a production claim for those capabilities.

The current release remains deliberately execution-disabled. No broker secret, user secret, account credential, automatic order, or order-routing workflow was added.
