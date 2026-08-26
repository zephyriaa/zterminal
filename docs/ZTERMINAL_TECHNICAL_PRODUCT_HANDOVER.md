# ZTerminal Technical and Product Handover

**Prepared by:** Manus AI

**Date:** 2026-08-26

**Repository:** `zephyriaa/zterminal`

**Baseline inspected:** `main` at `24c1d36859b2e43349b1b6a917c438ce580857dd` — `24c1d36 fix: use conventional Windows installer`

**Scope:** A factual, documentation-only handover. Claims identify code/contract evidence; deployment facts not provable from the repository are marked **UNKNOWN — requires verification**.

> **Status vocabulary.** **Functional** means source evidence plus direct test/build/smoke evidence. **Partial** means a component exists but an essential dependency or product capability is absent. **Mocked** means simulation only when explicitly selected and labelled. **Deprecated** means retained only to fail clearly or support an internal legacy path. **Missing** means no supported implementation was found. “Production path” means code supports the path; it does not independently prove the current live host is configured or healthy.

## 1. Project Overview

ZTerminal is an evolving, **research-first market-terminal codebase**. Its present implementation combines a browser workstation for charting and read-only market/research interfaces with a Windows-local Track B native vertical slice intended to keep local scenes, local history, and bounded calculations on the user’s machine. The product is not an order-execution platform and must not invent missing market data. [1] [2]

| Topic | Current factual state |
|---|---|
| Problem addressed | Code and product contracts position it as an affordable, chart-first market-research workstation. The exact commercial positioning and target persona are **UNKNOWN — requires verification**; source does not supply a validated product brief. [1] |
| Target users | Users who want read-only market/chart/research tooling are implied by the workspace, research, risk, and journal code. Specific user segments, entitlement model, and usage metrics are **UNKNOWN — requires verification**. |
| Supported platforms | Browser web; Windows 10/11 native private installer. No native Android/iOS/React Native project exists. [2] [3] |
| Browser URLs | `/` is the landing page and `/terminal` is the browser workstation. The user reports `https://zterminal.onrender.com`; current Render/DNS/TLS status is **UNKNOWN — requires verification**. [4] |
| Product tracks | **Track B:** C++20 Win32/D3D11 native host + Rust local sidecars, intended Windows direction. **Track A:** internal hosted Tauri WebView wrapper, legacy/experimental. **Web:** Next.js landing and browser terminal. [1] [2] [5] |
| Production status | Web deployment code exists; private Windows installer smoke passed in isolation. Public Windows distribution, trusted signing, broker execution, cloud sync, research execution, and mobile are not production capabilities. [3] [6] |

### Concise architecture

```text
Browser user ──► Next.js / and /terminal ───────┐
                    │ HTTP routes               │ same-origin Socket.IO
                    ▼                           ▼
              Next API routes             Node market gateway
              (auth/cloud/research        Gate.io default; Binance optional;
               are gated)                 mock only when explicit
                    │                           │
     configured external Research API?          └── read-only upstream provider paths
     (otherwise HTTP 503)

Windows Track B ─► ZTerminalWindowsHost.exe (Win32/D3D11)
                    ├─ local scene/catalog/workspace Rust helpers
                    ├─ bounded local Monte Carlo helper
                    └─ internal opt-in ingest helper
                  Normal startup: no provider, cloud, broker, or fabricated data.
```

The web production container starts a Next standalone server, the gateway, and Caddy together. Caddy keeps browser Socket.IO same-origin and proxies internal gateway paths to port 3003. [7] [8]

## 2. Complete Repository Structure

Generated directories (`node_modules`, `.next`, Rust `target`, installer `out`) are not source of truth and are excluded from this map. Every tracked top-level path is listed below; the detailed rows identify whether it is active, legacy, or only supporting material.

| Path | Purpose and important contents | Active status / modification safety |
|---|---|---|
| `.github/workflows` | `quality.yml`, internal hosted-preview workflow, and internal test-signing workflow. | Active CI definitions, but Tauri workflows are legacy/Track A relative to Track B. Modify only with release-boundary review. [9] |
| `apps/windows-host` | Track B CMake host, C++ source, Inno definition, PowerShell build/sign/smoke scripts. | Active native Windows vertical slice. Do not remove sidecars/installer ownership paths casually. [2] [3] |
| `apps/zt-*` | Rust executables for local scene, catalog, workspace, Monte Carlo, offline import, direct ingest. | Active native helpers; direct ingest is internal only. [2] |
| `assets` | Project image/design assets. | Supporting assets; inspect references before removal. |
| `crates` | `zt-protocol`, `zt-core`, `zt-storage`, `zt-adapters`. | Active shared Rust local engine. [10] |
| `db` | Repository database/support files separate from Prisma/research directories. | Inspect consumers before modification; production use is **UNKNOWN — requires verification**. |
| `desktop` | Vite desktop shell configuration. | Legacy/Track A support, not Track B native product. [11] |
| `docs` | Product/deployment/Windows contracts and this handover. | Active documentation. `docs/windows` is architecturally important. [1] [3] |
| `examples` | Example artifacts/support material. | Non-runtime; confirm before deletion. |
| `mini-services/market-data` | Node Socket.IO market gateway, order books, provider adapters. | Active web market-data service. [12] |
| `packages` | Shared/support package area. | Inspect imports before modification; no standalone published package was verified. |
| `prisma` | `schema.prisma` and migrations for main web schema. | Active schema source; deployed persistence is not proven. [13] |
| `public` | Static web assets copied into Next standalone output. | Active web asset source. |
| `research` | FastAPI API, Rust research core, Postgres schema, Python SDK, local compose. | Partial research control plane; no enabled executor. [14] [15] |
| `scripts` | Web production entrypoint. | Active deployment helper. [8] |
| `src` | Next App Router routes, UI, hooks, domain, libraries, stores. | Active browser application. [4] [16] |
| `src-tauri` | Track A Tauri configuration/source/icons, including hosted preview config. | Legacy/internal hosted wrapper. Android/iOS icons are not a mobile app. [5] |
| `tests` | TypeScript node-test suite and supporting runtime checks. | Active deterministic tests; no browser E2E project found. [11] |
| `Cargo.toml`, `Cargo.lock` | Rust workspace, local crates/apps, release profile. | Active. Unsafe code forbidden workspace-wide. [10] |
| `package.json`, `package-lock.json`, `bun.lock` | JavaScript scripts/dependency locks. | `npm` is the CI/runtime path; Bun lock exists but no verified Bun workflow. [11] |
| `Dockerfile`, `Caddyfile`, `railway.json` | Web/gateway container and proxy; Railway configuration. | Active deployment code. Render configuration is not present. [7] [8] |
| `next.config.ts`, `tailwind.config.ts`, `postcss.config.mjs`, `tsconfig.json`, `eslint.config.mjs`, `components.json` | Web build/style/type/lint/UI configuration. | Active web configuration. [11] |
| `README.md`, `README_GITHUB_ORIGINAL.md`, `worklog.md`, `LICENSE` | Project/support documentation and license. | Read before changing public claims/license. |
| `verify-*.png`, `zterminal.png` | Historical visual verification/image assets. | Supporting evidence; not current source-of-truth UI specification. |

### Important source subtrees

| Subtree | Principal files | Responsibility |
|---|---|---|
| `src/app` | `page.tsx`, `terminal/page.tsx`, API route directories, docs/download pages | Landing, terminal route, public/internal HTTP boundary. [4] |
| `src/components/terminal` | `reference-chart-workspace.tsx`, `terminal-chart.tsx`, `indicators-browser.tsx` | Main browser workstation, canvas chart, indicator UI. [16] [17] |
| `src/components/views` | `python-strategy-view.tsx` and auxiliary views | Browser research/strategy interface; execution is gated. [18] |
| `src/hooks` | `use-market-stream.ts` | Singleton browser Socket.IO connection/subscription lifecycle. [19] |
| `src/stores` | `workspace.ts` | Zustand browser local persistence and opportunistic cloud handoff. [20] |
| `src/lib/market` | Gate.io/Binance normalization, contracts, capabilities, order-flow calculations | Data transport/types/calculations; catalogue is not runtime proof. [12] [21] |
| `src/lib/releases` | `windows-release.ts` | Strict, currently unused public Windows-release metadata gate. [22] |
| `research/api/app` | `main.py`, `service.py`, `models.py`, `policy.py`, `worker.py`, `postgres_store.py` | Research V2 API/control plane, policy, durable-queue adapter, fail-closed worker. [14] [15] |
| `apps/windows-host/src` | `main.cpp` plus bridge C++ files | Native host window/render/local sidecar coordination. [2] |

## 3. Tech Stack

| Technology | Version / configuration observed | Purpose / location | Status and caveats |
|---|---|---|---|
| TypeScript | `^5` | Next UI/routes, gateway, tests. [11] | Active. |
| Next.js | declared `^16.1.1`; verified build installed 16.3.0 from lock resolution | App Router, API routes, standalone build. [11] | Active web framework. |
| React | `^19.0.0` | Browser components/workstation. [11] | Active. |
| Tailwind CSS | `^4` plus `tw-animate-css` | Styling; Radix/shadcn-style component stack. [11] | Active. |
| Zustand | `^5.0.6` | Browser workspace state and local persistence. [20] | Active; cloud write is gated. |
| Canvas 2D | Browser native Canvas, no third-party chart engine found | `TerminalChart` rendering/interactions. [17] | Active custom chart renderer. |
| Socket.IO | `^4.8.3` client/server | Browser-to-gateway real-time stream. [12] [19] | Active web transport. |
| Prisma | `^6.11.1` | Main web schema/client, SQLite datasource. [13] | Schema exists; durable production DB is unverified. |
| Auth.js / NextAuth | `^4.24.11`, Prisma adapter, Google provider | Gated Google/database session path. [23] | Not active without secrets/durability flags. |
| Node/tsx | Node process; `tsx ^4.23.12` | Gateway and test execution. [11] | Active web service tooling. |
| Caddy | Installed in Docker runtime | Reverse proxy for Next/gateway. [7] [8] | Active container topology. |
| Docker | Root `Dockerfile` | Web/gateway production image. [7] | Active code path; host provider configuration unknown. |
| Rust | Edition 2021 workspace | Protocol/core/storage/adapters/local tools/research core. [10] | Active local engine; `unsafe_code` forbidden. |
| C++20 / Win32 / D3D11 | CMake target with D3D11/DXGI/D2D/DWrite | Track B Windows host. [2] | Functional vertical slice, not complete desktop parity. |
| Python | FastAPI/Pydantic; requirements pin FastAPI 0.115.6, Uvicorn 0.34.0, Pydantic 2.10.4, asyncpg 0.30.0 | Research API/control plane. [14] | User-code executor absent. |
| PostgreSQL 16 | Research compose/schema | Optional durable research queue/store. [15] | Deployment is unknown. |
| SQLite | Prisma datasource | Main web development/schema persistence. [13] | Multi-user/cloud durability not proven. |
| Inno Setup | Local compiler discovered by script | Conventional private Windows installer. [3] | Not bootstrapped or CI-built. |
| Tauri 2 / Vite 7 | package dependencies/config | Track A hosted preview. [5] [11] | Legacy/internal relative to Track B. |

There is **no mobile framework**, no native chart SDK, no verified analytics/monitoring platform, no verified scheduler/background-job service, and no verified AI-provider integration. Dependencies such as legacy Tauri, Vite desktop support, and an old ZS compiler remain for compatibility/retirement tests and should not be mistaken for the active intended product path. [5] [24]

## 4. Architecture

### Client, server, state, storage, and event flow

The browser loads `/terminal`, which renders the floating workstation. Browser UI uses component-local state plus a persisted Zustand store. `useMarketStream` creates one Socket.IO client per browser runtime, reconnects indefinitely, resubscribes tracked symbols, batches trade updates into animation frames, and polls gateway health every two seconds. The store persists a limited workspace envelope locally and fires a cloud POST without treating success as guaranteed. [16] [19] [20]

Historical bars come from a Next API route. Live trade/quote/depth/derivatives/liquidation events arrive from the gateway. The gateway holds subscriptions in memory and reads external provider streams; it can use Gate.io, an optional Binance path, or explicit mock mode. Caddy sends external `/socket.io`, health, and contract traffic to this gateway, while all other browser traffic goes to Next. [8] [12]

The native Track B host is explicitly separate. It uses local process-sidecars instead of unsafe FFI. On normal startup, no provider connection, authentication, cloud synchronization, account setup, or network ingestion is opened. Local segments are verified and bounded; unavailable local data is presented as unavailable. [1] [2] [10]

| Architecture concern | Current state |
|---|---|
| Authentication / authorization | Auth.js Google/database sessions are code-gated by private configuration. No roles/ACL system was found. [23] |
| Background jobs | No active general scheduler/worker service was found. Research job records are a separate gated Postgres path. [14] [15] |
| Caching | `/api/bars` has 15-second in-memory cache; gateway keeps in-memory subscriptions/order-book state; browser retains limited arrays. No shared cache/Redis found. [12] [25] |
| Persistence | Browser localStorage; Prisma SQLite schema; separate research Postgres schema; native local storage/journal. Actual production persistence configuration is **UNKNOWN — requires verification**. [10] [13] [20] |
| Event processing | Gateway provider events → normalized Socket.IO events → hook subscriber maps → UI/store. Native local calculations are one-shot bounded sidecar operations. [12] [19] |
| Scheduled jobs | **Missing.** No deployed scheduled job/config was found. |

## 5. Web Application

| Route/screen | Components/data/APIs | Status and limitations |
|---|---|---|
| `/` | Landing components in `src/components/landing`; Next page. | **Production path, deployment unverified.** It is distinct from `/terminal`. [4] |
| `/terminal` chart workstation | `FloatingWorkstationShell` → reference workspace → canvas chart; `/api/bars`, browser Socket.IO, local Zustand state. | **Functional / partial.** Floating browser panels, charts, local settings, indicators, strategy/calendar/context panels exist. They are browser UI, not native Track B windows. [16] [17] |
| Market/symbol interfaces | Static contracts/capabilities and gateway contract projection. | **Partial.** Current browser state forces BTCUSDT but upstream/default naming differs between Binance/Gate.io. [12] [20] [21] |
| Indicators | `indicators-browser.tsx` and custom canvas study calculations. | **Functional local studies; partial Python/Pine path.** No automatic TradingView protected-script import/execution. [17] [26] |
| Order-flow workspace | Order-flow libraries plus live gateway inputs. | **Partial/source-dependent.** Must withhold unavailable L2/trade/OI inputs; no verified full DOM/institutional feed. [27] |
| Calendar/context | Workspace panels. | **Withheld/placeholder where source unavailable.** Economic events must not be fabricated. [16] |
| Python strategy view | Python/Pine editor; `/api/research/...` proxy. | **Partial.** Validation/conversion UI exists; queue button is intentionally disabled until worker/SQL/Rust health exists. [18] [14] |
| Backtesting UI | Browser research/backtester affordances. | **Deprecated/partial.** Legacy ZS endpoint returns 410; no browser backtest execution path is enabled. [24] [28] |
| Account/auth/cloud UI | Auth components/store/cloud route. | **Gated.** Google login and durable cloud sync need verified configuration. [20] [23] |
| GEX/options | No verified source/API/component calculation found. | **Missing.** A UI label is not implementation evidence. |
| Watchlists/alerts/risk/journal | Domain/schema/UI affordances. | **Partial or schema capability only.** Do not claim durable multi-user behavior without enabled cloud/database paths. [13] |

The primary current UX risk is that several panels expose a product concept before its data source/execution system is verified. User-facing labels must continue to distinguish `LIVE`, `SIMULATED`, `UNAVAILABLE`, `STALE`, and `DEGRADED`; no local/browser fallback may manufacture data. [12] [25]

## 6. Mobile Application

**Status: Missing / not started.** No Expo, React Native, Android Gradle project, iOS Xcode project, mobile navigation tree, mobile API client, native mobile WebSocket client, or mobile build pipeline exists. `src-tauri/icons/android` and `src-tauri/icons/ios` are packaging icon assets for Tauri and do not constitute a mobile application. [5]

| Requested mobile topic | Current evidence |
|---|---|
| Framework/project structure/navigation/screens | No mobile project found. |
| Auth/API/WebSocket implementation | No mobile-specific implementation found. |
| Chart implementation | Browser canvas chart accepts touch/pinch gestures, but it is not a native mobile chart. [17] |
| Android/iOS build process | Missing. |
| Shared components | Browser TypeScript components may be conceptually reusable but are not a proven mobile shared package. |
| Known issue | Treat browser responsiveness as browser UX only; do not represent it as native mobile support. |

## 7. Charting System

The active browser chart is a custom Canvas 2D implementation in `src/components/terminal/terminal-chart.tsx`; no external charting library is used. It loads 600 historical bars through `/api/bars`, then updates the most recent candle from a bounded live-trade stream. It stores at most 2,000 bars and rejects implausible live placeholder ratios rather than corrupting verified history. [17]

| Chart concern | Current implementation |
|---|---|
| Initialization / render | `ResizeObserver` measures the panel; Canvas respects device pixel ratio up to 2; drawing is scheduled with `requestAnimationFrame`. [17] |
| Candle modes | Candles, OHLC bars, line, and area. [17] |
| Timeframe / symbol | Workspace selects a `Timeframe`; chart requests the current symbol/timeframe; store migrations force BTCUSDT and supported presets. [17] [20] |
| Time navigation | Plot drag pans virtual timeline; bottom axis drag/scroll changes visible-bar count, bounded 30–400; right-side future padding is bounded. [17] |
| Price navigation | Right price axis drag/wheel zooms price; Alt/middle drag pans price; price offset/zoom are bounded. [17] |
| Touch | Single-touch drag, pinch time zoom, and pinch price-axis zoom; canvas uses `touch-none`. [17] |
| Crosshair | Canvas crosshair with OHLCV tooltip; returns selected bar via callback. [17] |
| Replay | Local replay cutoff, previous/play/next controls, 350 ms step interval over loaded bars only. [17] |
| Drawings | Trade markers can be rendered if provided. No generalized drawing-object persistence/toolkit was found. [17] |
| Realtime | `useMarketStream` feeds latest trade; hook batches updates via RAF. Availability depends on gateway/provider. [17] [19] |
| Synchronization | No multi-chart synchronization/persisted drawing synchronization was verified. |

### Indicators

| Indicator | Calculation/input/rendering | Status / limitation |
|---|---|---|
| Session VWAP | Typical price × bar volume cumulative by chart-timezone day; resets on day boundary; canvas dashed line. | **Functional.** Depends on loaded bar volume; not exchange session profile. [17] |
| EMA20 / EMA50 | Standard recurrence over closes; canvas overlays. | **Functional.** Fixed toggles. [17] |
| Volume | Candle volume bars in lower pane. | **Functional.** Uses OHLCV `v`; no verification of provider semantics. [17] |
| Custom EMA/SMA/WMA/VWMA | Close series, or close×volume for VWMA; period/color/visibility. | **Functional locally.** Browser calculations only. [17] [26] |
| Bollinger | SMA plus population standard deviation, configurable multiplier. | **Functional locally.** No separate panel support found. [17] |
| Donchian | Rolling high/low extrema. | **Functional locally.** No external data required beyond bars. [17] |
| Python/Pine derived indicators | Intended through validated isolated research job. | **Unavailable end-to-end.** Protected third-party scripts are not fetched/executed. [18] [26] |

Known chart gaps are generalized drawing tools, multi-panel indicator architecture, documented performance profiling, verified provider consistency, and full native Track B chart parity. These are not hidden by the interactive canvas features that do exist.

## 8. Market Data System

| Dataset/provider | Ingestion and normalization | Cache/storage/downstream | State and failure behavior |
|---|---|---|---|
| Gate.io OHLCV | `/api/bars` normalizes Gate.io futures candle responses; `/api/markets` reads futures ticker data. | Bars route keeps 15-second in-memory cache; chart consumes bars. | **Real when request succeeds; cached; otherwise unavailable.** Up to 1,000 bars; no synthetic fallback. [25] [29] |
| Gate.io real-time | Gateway default mode; provider WebSocket processing emits trade, quote, depth events. | In-memory gateway books/subscriptions; browser hook/UI. | **Real only while gateway/provider healthy.** Reports state, not fake data. [12] |
| Binance history/real-time | Adapter/order-book and optional gateway path; derivative/liquidation event types supported. | In-memory/consumer state. | **Partial.** Source implementation is not evidence of deployed configuration. [12] [30] |
| Explicit mock | Gateway `MARKET_PROVIDER=mock`; bars mock request/provider. | Synthetic local process output; browser labels simulation. | **Mocked only.** Never live. [12] [25] |
| Provider catalogue | Gate.io, Binance, Bybit, OKX, MEXC metadata. | UI capability display. | Bybit/OKX/MEXC are **catalogued**, not active integrations. [21] |
| Trade tape | Observed gateway trade events. | Browser hook; deterministic order-flow functions. | **Real only if provider supplies live stream.** [12] [27] |
| Level 2/order book | Gateway Gate/Binance order-book bridges and depth events. | In-memory order books → browser. | **Partial/source dependent.** Do not call it a verified full DOM. [12] [30] |
| Delta/CVD/footprint | Derived locally from observed classified trades. | Calculation library/UI consumer. | **Derived**, never substitute for absent trade sides. [27] |
| OI/funding/derivatives | Event types/adapter paths. | Browser hook retains bounded derivatives history. | **Partial/source dependent.** Missing values stay unavailable. [12] [19] |
| Options/GEX | No verified source or pipeline. | None. | **Missing.** |

The gateway has exponential contract-discovery retry up to 30 seconds and browser reconnection is infinite with 1–8 second backoff. This persistent web behavior must remain isolated from the native host’s normal no-network local-first behavior. [12] [19]

## 9. Order-Flow System

`src/lib/market/order-flow.ts` is a deterministic analytics library, not an exchange adapter, broker, or institutional signal engine. It accepts observed provider trades/L2/OI and produces transparent outputs. [27]

| Function | Exact current behavior | Status / limitation |
|---|---|---|
| Trade ingestion/classification | Consumes exchange-reported trade side where available; does not infer unobserved direction. | **Functional calculation.** Quality is bounded by upstream event fields. [27] |
| Trade tape | Filters/aggregates observed trade records without changing their side/price. | **Functional calculation.** No durable historical tape store found. [27] |
| Delta/CVD | Buckets aggressive buy/sell volumes and cumulative delta from observed sides. | **Derived.** Cannot operate truthfully without source sides. [27] |
| Footprint | Aggregates buy/sell volume and delta by price level. | **Derived.** No verified historical reconstruction pipeline. [27] |
| Book imbalance/microprice | Uses observed top-N L2 levels. | **Derived.** Not full DOM assurance. [27] |
| OI change | Compares observed OI; emits unavailable if absent. | **Partial/source-dependent.** [27] |
| Sweep/absorption | Produces inspectable research-event candidates with exact threshold/window/version metadata. | **Research candidate only**, not verified trade instruction. [27] |
| Candle sync/render/storage | No robust historical event-to-candle reconstruction or durable order-flow database was verified. | **Partial/Missing.** |

## 10. GEX / Options System

**Status: Missing.** No exchange/options source, option-chain API, expiry/strike model, gamma formula, aggregation, cache, chart layer, or update schedule was found in the inspected active source. The presence of UI language or a desired product direction is not evidence of GEX implementation. Any future GEX feature must explicitly distinguish exchange-provided contracts/Greeks from internally calculated estimates and must disclose inputs/assumptions.

## 11. Backtesting System

| Backtesting concern | Current state |
|---|---|
| Legacy ZS endpoint | `POST /api/backtest` returns HTTP 410 `ZS_BACKTEST_RETIRED`; it explicitly prevents old in-process JavaScript fallback. [28] |
| Strategy representation | Main Prisma schema can model `Strategy`, immutable `StrategyVersion`, source/structured definition, parameter/risk JSON strings, dataset link, source hash, and lineage. [13] |
| Data representation | Prisma `Dataset` captures provider/environment/symbols/timeframe/range/provenance/quality metadata; raw tick storage is out of scope. [13] |
| Run representation | `BacktestRun` schema can store deterministic hash, config, parameters, metrics, trade log, equity curve, validation/protocol metadata, and lineage. [13] |
| Research V2 queue | Requires validated artifact, non-degraded provider-labelled dataset manifest, next-bar policy, and durable Postgres. [14] [15] |
| Execution, fees, slippage, sizing, stops, targets, lifecycle | No enabled browser/API user-code execution or verified end-to-end engine result persistence was found. **Partial schema/core only.** |
| Results/chart visualization | Browser has research/backtester UI affordances and chart markers, but no verified end-to-end execution-to-results route. **Partial.** |

The Rust/local research code and historical helpers are distinct from an enabled web backtester. Do not describe a local bounded Monte Carlo sidecar as a general strategy-backtesting service. [2] [10]

## 12. Strategy / AI System

There is no verified LLM provider/API, prompt template, autonomous code-generation route, or active AI strategy generator. Main-schema names such as `GeneratedStrategyArtifact` express a data model, not an activated AI feature. [13]

| Capability | Current implementation | Status |
|---|---|---|
| Python editing/validation | Browser posts Python artifact request with runtime lock/rights attestation to research proxy. | **Partial; external API required.** [18] [14] |
| Pine conversion | Browser submits Pine text for conversion/review; protected scripts are not decompiled. | **Partial; review-only.** [18] [14] |
| Artifact policy | API validates allowed language/origin/rights/runtime and records diagnostics. | **Functional control-plane logic.** [14] |
| User-code execution | Worker validates declared isolation inputs; `execute_artifact` still raises `NotImplementedError`. | **Unavailable/fail-closed.** [15] |
| ZS compiler | Retired endpoint returns 410. Legacy compiler remains test/support code. | **Deprecated.** [24] |
| AI generation | No active provider or prompt flow found. | **Missing.** |

## 13. Database

### Main Prisma SQLite schema

The datasource is SQLite through `DATABASE_URL`. The schema is a capability contract, not proof of deployed database population, backups, durable cloud operation, or migration history beyond files in `prisma`. [13]

| Model(s) | Purpose, key fields, relationships/indexes | Current consumer/status |
|---|---|---|
| `User` | Identity: `id`, unique optional `email`, profile, timestamps; owns workspaces/accounts/sessions. | Auth schema; auth path gated. [13] |
| `Account` | OAuth account/token fields; belongs to `User`; unique `[provider, providerAccountId]`, user index. | Auth.js adapter only; never expose tokens to browser. [13] |
| `Session` | Opaque `sessionToken`, expiry, user relation; unique token/user index. | Auth.js database sessions if enabled. [13] |
| `VerificationToken` | Identifier/token/expiry; unique token and pair. | Auth.js support. [13] |
| `Post` | `title`, optional content, publication, author ID/timestamps. | **Legacy unused scaffold**; removal needs approved retention migration. [13] |
| `Workspace` | Optional owner, name/timestamps; parent of dataset/strategy/risk/alert/journal/backtest/audit/research/cloud records; owner index. | Core schema concept; browser cloud is gated. [13] |
| `CloudWorkspaceState` | Unique workspace payload/schema version/timestamps. | Gated durable cloud preferences. [13] [20] |
| `Strategy`, `StrategyVersion` | Versioned strategy identity/source/definition/parameter/risk/source hash/dataset/artifact/lineage; uniqueness and lookup indexes. | Schema support, legacy ZS endpoint retired, Python execution unavailable. [13] |
| `Dataset`, `DatasetImport` | Historical request/provenance/hash/quality/range metadata and import report. | Schema support; no verified production raw market-data store. [13] |
| `BacktestRun`, `VariableChange` | Determinism hash, config/results, validation/protocol metadata, lineage and one variable change record. | Schema support; no active web backtest execution. [13] |
| `ResearchSource`, `ResearchSourceExcerpt` | Citation/source text/hash/rights and reviewed excerpts. | Research/protocol schema. [13] |
| `RuleSpec`, `RuleSpecRevision`, `DataRequirementAssessment` | Reviewed rule flow, revisions, scope/data readiness. | Research/protocol schema. [13] |
| `GeneratedStrategyArtifact`, `ProtocolDecision` | Generated artifact metadata/approval/hash and protocol decision audit. | Data model; no verified AI provider. [13] |
| `RiskPlan` | Equity/exposure/risk limits and policy per workspace. | Research/planning metadata, not broker risk enforcement. [13] |
| `AlertDefinition` | Instrument/rule/context/cooldown metadata. | Evaluation/delivery/retry are worker concerns; no active worker proven. [13] |
| `JournalEntry` | Planned/actual trade journal fields, optional strategy/run links, performance context. | Journal data model, not execution record proof. [13] |
| `AuditEvent` | Redacted append-only-like action payload/entity metadata. | Payload must not contain secrets/broker credentials. [13] |

### Separate Research V2 Postgres schema

`research/db/schema.sql` defines `code_artifact`, `conversion_report`, `dataset_manifest`, `research_job`, `research_run`, and `validation_suite_run`, with artifact and queue indexes. It exists to support a durable research workflow distinct from the web Prisma SQLite schema. The actual database deployment is **UNKNOWN — requires verification**. [15]

## 14. APIs

No GraphQL endpoint or Next Server Action API was found. The table lists source-level contracts; authentication is “gated” where runtime condition is required.

| Method/path | Request and consumer | Response/error/current state |
|---|---|---|
| `GET /api` | No request body; basic app route. | `{ "message": "Hello, world!" }`; no stable service contract beyond source. [31] |
| `GET /api/bars` | Query includes `symbol`, `tf`, temporal/bars controls and explicit mock provider only when requested; chart consumes it. | `{ bars: [...] }` on provider success; bounded/cached Gate.io path; failure returns unavailable rather than synthetic live bars. [25] |
| `GET /api/markets` | Browser market snapshot. | Gate.io futures snapshot labelled `LIVE` or explicit `UNAVAILABLE`; source-dependent. [29] |
| `GET /api/contracts` | Browser/gateway projection. | Gateway contract result; dependency is local gateway readiness. [12] |
| `GET /api/providers` | Browser capability catalogue. | Static metadata; not provider health. [21] |
| `GET/POST /api/cloud/workspaces` | Browser workspace read/write, JSON saved-workspace envelope. | Requires enabled cloud sync, Google/auth, and durable storage; otherwise `503 CLOUD_SYNC_UNAVAILABLE`. [20] [23] |
| `GET/POST /api/auth/[...nextauth]` | Auth.js protocol routes. | Google/database-session path only if secrets/config conditions exist. [23] |
| `POST /api/research/[...path]` | Proxy of validation/conversion/job requests from Python strategy UI. | Forwards only to `RESEARCH_API_URL`; missing config returns `503 RESEARCH_API_UNAVAILABLE`, never local execution. [14] [18] |
| `POST /api/strategy` | Legacy ZS compile caller. | `410 ZS_COMPILATION_RETIRED`. [24] |
| `POST /api/backtest` | Legacy ZS backtest caller. | `410 ZS_BACKTEST_RETIRED`, `dataStatus: UNAVAILABLE`. [28] |
| `POST /api/connectors/rithmic` | Connector form; in-memory validation inputs. | Rate limited to five/minute; password cleared; always unavailable until official adapter/conformance. [32] |
| `GET /api/releases/windows` | Download pages. | Safe metadata only after `WINDOWS_RELEASE_PUBLISH_ENABLED=true`, valid signed manifest, allowed hosts; private Inno installer is not published here. [22] |
| `GET /healthz`, `GET /readyz`, `GET /contracts`, Socket.IO `/socket.io` | Caddy-proxied gateway HTTP/realtime interface. | Health vs source readiness/contract state; browser stream types are `trade`, `quote`, `depth`, `derivatives`, `liquidation`. [8] [12] |
| Python `GET /health` | Research service health. | Service-level health only; no execution guarantee. [14] |
| Python `POST /v1/artifacts/validate` | Validate research artifact. | Validation report/diagnostics per Pydantic models/policy. [14] |
| Python `POST /v1/pine/convert` | Pine conversion/review request. | Conversion report/draft; not protected-script execution. [14] |
| Python `POST /v1/jobs`, `GET /v1/jobs/{id}`, `POST /v1/jobs/{id}/cancel` | Durable research queue lifecycle. | Requires validated artifact/dataset/durable store; execution still unavailable. [14] [15] |

`ALLOWED_ORIGIN` supports CORS configuration at the gateway. The only explicitly observed route-level rate limit is Rithmic validation; broad API rate limiting, CSRF specifics, and public API authorization policy are **UNKNOWN — requires verification**. [12] [32]

## 15. Authentication & Security

| Security concern | Current evidence / rule |
|---|---|
| Authentication | Auth.js Google provider and Prisma database session adapter. Required configuration is gated; no real OAuth deployment asserted. [23] |
| Sessions | Server-side `Session` rows/opaque secure cookie intent; browser should not receive provider tokens. [13] |
| Authorization | No roles/permissions matrix found. Cloud route requires configuration/auth gating, but fine-grained authorization is **UNKNOWN — requires verification**. |
| Secrets | OAuth IDs/secrets, NextAuth/JWT secret, database URLs, research URL, and signing certificates must remain private. No values belong in source or this document. [3] [23] |
| Exchange/broker credentials | No broker storage path; Rithmic clears password and does not connect. [32] |
| Native data/privacy | Startup diagnostic is aggregated/no provider payload/account/credential data. [3] |
| CORS | Gateway uses `ALLOWED_ORIGIN`; production exact origin required. [12] |
| CSRF/encryption/security middleware | Next/Auth.js defaults may apply, but exact deployed CSRF/cookie/TLS headers and encryption-at-rest are **UNKNOWN — requires verification**. |
| External ingestion safety | Internal direct ingest must never run/retry without fresh user authorization. [1] [2] |

## 16. Environment Variables

Values must never be recorded. “Required” means required for that feature, not necessarily required for local build.

| Name | Required for | Where used / safe example |
|---|---|---|
| `MARKET_PROVIDER` | Gateway provider selection | Gateway; default `gateio`; `mock` is explicit simulation only. [8] |
| `MARKET_DATA_PORT` | Gateway bind port | Gateway/start script; example `3003`. [8] |
| `ALLOWED_ORIGIN` | Production gateway CORS | Exact HTTPS browser origin; `<HTTPS_ORIGIN>`. [12] |
| `MAX_SUBSCRIPTIONS_PER_CLIENT` | Gateway subscription bound | Market gateway policy. [12] |
| `GATEWAY_URL`, `MARKET_GATEWAY_URL` | Browser/gateway configuration paths | Source-observed names; deployed use **UNKNOWN — requires verification**. |
| `BINANCE_BOOK_DEPTH`, `BINANCE_DERIVATIVES_REFRESH_MS`, `BINANCE_FUTURES_REST_URL`, `BINANCE_FUTURES_WS_URL`, `BINANCE_STALE_AFTER_MS` | Optional Binance adapter | Optional provider tuning/endpoints. [12] |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google auth | `<OAUTH_CLIENT_ID>`, `<OAUTH_CLIENT_SECRET>`; never expose. [23] |
| `NEXTAUTH_SECRET`, `JWT_SECRET` | Auth/session signing | `<SECRET>`; one valid private configuration required. [23] |
| `CLOUD_SYNC_ENABLED` | Cloud workspace behavior | Literal `true` plus auth/durability requirements. [23] |
| `DATABASE_URL` | Prisma SQLite | `file:<LOCAL_DB_PATH>` for local schema work; production semantics unknown. [13] |
| `RESEARCH_API_URL` | Web-to-research proxy | `<PRIVATE_HTTPS_RESEARCH_API_URL>`; missing returns 503. [14] |
| `RESEARCH_DATABASE_URL` | Research durable Postgres store | `<POSTGRESQL_DSN>`; only Postgres plus asyncpg enables it. [15] |
| `RESEARCH_WORKER_ISOLATED` | Research worker | Must be explicitly true for any possible execution gate. [15] |
| `RESEARCH_WORKER_NETWORK_DISABLED`, `RESEARCH_WORKER_FILESYSTEM_READONLY`, `RESEARCH_WORKER_CHILD_PROCESS_DISABLED` | Research isolation | Must deny these capabilities. [15] |
| `RESEARCH_WORKER_CPU_SECONDS`, `RESEARCH_WORKER_MEMORY_MB`, `RESEARCH_WORKER_WALL_SECONDS` | Worker limits | Positive bounded resource limits. [15] |
| `WINDOWS_RELEASE_ALLOWED_HOSTS`, `WINDOWS_RELEASE_MANIFEST_JSON`, `WINDOWS_RELEASE_PUBLISH_ENABLED` | Public Windows metadata gate | Disabled by default; not current private installer release. [22] |
| `VERIFY_DURATION_MS` | Windows release verification path | Source-observed release gate configuration. [22] |
| `NODE_ENV`, `APP_PORT`, `PORT` | Web/container runtime | Next/server/Caddy process topology; examples `production`, `3000`, `8080`. [8] |

## 17. Deployment

The repository has a Docker/Caddy/Next/gateway deployment path and a Railway configuration. The user reports Render at `https://zterminal.onrender.com`; there is no `render.yaml`, and exact Render build/start commands, service class, disks, health check, DNS, SSL, logs, rollback process, and environment inventory are **UNKNOWN — requires verification**.

| Deployment layer | Current code | Status |
|---|---|---|
| Web build | Root Dockerfile builds Next standalone and includes public/static assets. [7] | Implemented. |
| Process topology | `scripts/start-production.sh` starts gateway (`tsx`), Next server on 3000, and Caddy; traps shut all down. [8] | Implemented. |
| Proxy | Caddy public port routes gateway paths to `127.0.0.1:3003`, all else to `127.0.0.1:3000`. [8] | Implemented. |
| Railway | `railway.json` points to root Docker/start path. [7] | Config present; active deploy unknown. |
| Render | User-reported domain only. | **UNKNOWN — requires verification.** |
| Research service | Separate Dockerfile/compose with Postgres 16 local definition. [15] | Local/dev definition; deployed service unknown. |
| Mobile deployment | No mobile project. | Missing. |
| Windows distribution | Private workspace installer only; no public GitHub release/Render download/updater. [3] | Private-only. |

There is no repository-proven rollback runbook. Treat container redeploy/previous image restoration as **UNKNOWN — requires verification** until documented by an authorized deployment owner.

## 18. Local Development

### Prerequisites

Install Node/npm, Rust/Cargo, and for native Windows work: Windows 10/11, MSVC Build Tools, CMake, Windows SDK, and a separately installed trusted Inno Setup compiler. Python research tests require the `research/api` package path and its dependencies. Exact version-management policy beyond manifests is **UNKNOWN — requires verification**.

```bash
# Web
npm ci
npm run db:generate
DATABASE_URL=file:./dev.db npx prisma migrate deploy
npm run typecheck
npm test
npm run lint
npm run build

# Development services in separate shells
npm run dev
npm run market-data

# Production-like web/gateway/proxy, after build
npm run start:production

# Rust workspace
cargo fmt --all -- --check
cargo test --workspace
cargo clippy --workspace --all-targets -- -D warnings

# Research tests (package root import path is required today)
cd research/api
PYTHONPATH="$PWD" pytest -q
```

```powershell
# Windows Track B; generator/version paths are machine-specific examples.
cmake -S apps/windows-host -B out/windows-host -G "Visual Studio 17 2022" -A x64
cmake --build out/windows-host --config Release --target ZTerminalWindowsHost
powershell -ExecutionPolicy Bypass -File .\apps\windows-host\scripts\build-private-installer.ps1
powershell -ExecutionPolicy Bypass -File .\apps\windows-host\scripts\run-conventional-installer-smoke.ps1
```

The installer wrapper validates seven payload files and locates Inno Setup itself; it does not download/bootstraps the compiler. Do not run internal direct ingestion merely to populate a local workspace. [2] [3]

## 19. Testing

| Suite/location | Command/current result | Coverage and omissions |
|---|---|---|
| TypeScript deterministic tests | `npm test` — **47 passed** during this handover | Market normalization/order books, domain core, protocol, order flow, release gate, hosted-preview policy. No live smoke script invoked. [11] [27] |
| TypeScript typecheck | `npm run typecheck` — **passed** | Static web/gateway type correctness. [11] |
| ESLint | `npm run lint` — **passed** | Repository linting. [11] |
| Next production build | `npm run build` — **passed** | Build and route generation; not a live provider/deployment test. [11] |
| Rust format/test/lint | `cargo fmt --all -- --check`, `cargo test --workspace`, `cargo clippy --workspace --all-targets -- -D warnings` — **passed** | Local engine/storage/adapters/sidecar contracts. [10] |
| Research API Python tests | `cd research/api && PYTHONPATH="$PWD" pytest -q` — **8 passed** | Policy, Pine conversion, jobs; does not execute user code. [14] [15] |
| Windows scripts | Numerous local scene/catalog/workspace/Monte Carlo/history/renderer/installer smokes. | Private installer smoke passed in isolated Windows 10 validation; not CI-integrated. [3] [6] |
| Browser/native UI E2E | No Playwright/Cypress/Selenium or full native UI E2E project found. | Missing. |
| Mobile | No project/tests. | Missing. |

The first root-level `pytest -q research/api/tests` attempt fails with `ModuleNotFoundError: app`; the documented package-root/PYTHONPATH invocation passed. This is test ergonomics debt, not evidence the research service is deployable.

## 20. Current Bugs

These are evidence-based current defects/risks. Reproduction describes a safe way to observe the issue; it does not instruct provider retries or public release.

| Severity/title | Reproduction / affected path | Probable cause, workaround, status |
|---|---|---|
| **Critical — Research code cannot execute** | Configure/queue a research job after validation; `research/api/app/worker.py`. | `execute_artifact` is unimplemented and isolation intentionally fails closed. Workaround: do not promise execution; keep queue disabled. **Open/intentional gate.** [15] |
| **Critical — No broker/order capability** | Inspect terminal/native/broker routes. | No execution adapter or order engine. Workaround: read-only/research positioning. **Open product gap.** [1] [32] |
| **High — Browser provider identity inconsistency** | Open persisted browser workspace versus gateway default; `src/stores/workspace.ts`, start script/gateway. | Store migration/default identifies Binance while production start defaults Gate.io. Workaround: surface real runtime provider/status and avoid venue claims. **Open.** [8] [12] [20] |
| **High — Private Windows installer is unsigned/private** | Inspect installer contract/Authenticode status. | No authorized code-signing certificate/public distribution decision. Workaround: private controlled testing only. **Open by design.** [3] |
| **High — Track B installer not in CI** | Inspect GitHub workflows. | Existing CI builds legacy Track A Tauri artifacts, not CMake/Inno Track B. Workaround: manual isolated smoke. **Open.** [9] |
| **High — Cloud auth/sync unavailable in ordinary deployment** | Call cloud endpoint without all gated config. | Deliberate auth/durability gate. Workaround: browser local workspace persistence. **Open/intentional.** [20] [23] |
| **Medium — Browser market panels can outpace sources** | Provider outage/missing L2/OI/calendar data. | UI/concepts exist while independent sources may not. Workaround: label/withhold unavailable data. **Open.** [16] [27] |
| **Medium — Research tests need manual PYTHONPATH** | Run tests from root. | No test configuration encodes package path. Workaround: Section 18 command. **Open.** |
| **Medium — No native/mobile complete UI test coverage** | Inspect test tooling. | No E2E project. Workaround: manual/PowerShell smoke only. **Open.** |

## 21. Technical Debt

| Debt | Why it matters | Priority / safe posture |
|---|---|---|
| Track A / Track B terminology and CI divergence | A hosted Tauri wrapper can be mistaken for the native Windows product. | Fix before public desktop communication/release. [5] [9] |
| Oversized browser workspace/chart components | Canvas/workstation code centralizes rendering, interaction, and UI wiring. | Refactor only under regression coverage; do not destabilize chart gestures. [16] [17] |
| Provider catalogue/default inconsistency | Makes display identity unreliable. | Fix before expanding providers or market claims. [12] [20] [21] |
| Cloud schema vs operational durability | SQLite model exists while durable multi-user operating model is unverified. | Resolve before enabling cloud sync/auth. [13] |
| Research control plane without executor | UI/API/schema can imply capability that worker intentionally lacks. | Resolve before enabling queue/action buttons. [14] [15] |
| Legacy ZS and hosted Tauri support | Necessary explicit retirement/internal-preview behavior but adds cognitive/dependency load. | Safe to postpone removal only after migration/release plan. [5] [24] |
| Inno compiler setup/Track B CI missing | Reproducible packaging depends on manual workstation tooling. | Fix before any wider installer distribution. [3] [9] |
| Browser gateway persistent retries vs native finite operations | Different architectural rules in same repository can be confused. | Preserve separation; do not copy web stream behavior into native startup. [1] [12] |
| No mobile project | No shared mobile abstraction/build/test path. | Treat as new product work, not a minor responsive change. |

## 22. Currently Unfinished Work

| Category / feature | Current implementation and files | Remaining blockers / expected final behavior |
|---|---|---|
| **Prototype — Track B native terminal** | `apps/windows-host` provides host/local scene/catalog/workspace/Monte Carlo sidecars and local unavailable overlay. [2] | Full native workstation/chart/data UX, accessibility, product workflows, proven performance, and distribution are unfinished. |
| **Partial — Python/Pine research** | Browser editor and FastAPI validation/conversion/job contracts; `worker.py` fails closed. [14] [15] [18] | Isolated executor, durable Postgres, Rust result handoff, worker lifecycle, result UI, provenance, operational monitoring. |
| **Partial — Cloud/auth** | Auth.js + Prisma models + browser cloud handoff. [13] [20] [23] | Owned OAuth app, secrets, durable DB/backups, authorization, consent/deletion/incident operations. |
| **Partial — web market data** | Gate default, Binance optional, mock explicit; browser chart/gateway. [12] [25] | One canonical provider/instrument, live deployment verification, health/observability, licensing/rate limits, full source coverage. |
| **Partial — order-flow analytics** | Deterministic calculations from observed data. [27] | Verified L2/trade/OI sources, historical storage/reconstruction, provenance/display calibration, user-tested rendering. |
| **Not started — GEX/options** | No pipeline/source. | Data source, contract model, formula/provenance/visualization requirements. |
| **Not started — mobile** | No app project. | Product scope, framework, navigation, chart/mobile performance, builds/tests/release. |
| **UI-only/schema capability — alerts/risk/journal/portfolio** | Models and view concepts exist. [13] | Durable workflows, evaluation/delivery/ownership, live data integrity; no execution claims. |
| **Private-only — Windows release** | Conventional Inno installer/isolated smoke complete. [3] [6] | Trusted signing, release channel, support policy, CI, upgrade/rollback UX, explicit public authorization. |

## 23. Previous Development Decisions to Preserve

| Decision | Reason/consequence | Preserve? |
|---|---|---|
| Track B local-first Windows product | Native normal startup must work as a responsive local workspace and must not fabricate data or open provider/cloud/broker paths. [1] [3] | **Yes.** Change only with explicit product/safety decision. |
| Fail closed for missing data | Gate/provider failures yield unavailable/degraded states; mock is explicit. [12] [25] | **Yes.** Do not introduce silent synthetic fallback. |
| Rust sidecars/process boundary | Local engine avoids unsafe FFI and bounds local operations. [2] [10] | **Yes**, unless a separately reviewed native integration changes it. |
| Research user-code isolation | Browser/Next/FastAPI process must not execute arbitrary strategy code. [14] [15] | **Yes.** Build a true isolated worker before execution. |
| Retirement of active ZS API | Explicit 410 prevents accidental old in-process behavior. [24] [28] | **Yes** until a controlled migration/replacement is complete. |
| Gated cloud/auth | Avoids claiming durable sync without OAuth/storage ownership. [20] [23] | **Yes.** |
| Private unsigned installer | Avoids false public trust/release claim without valid certificate/distribution decision. [3] | **Yes.** |
| Bounded destructive uninstall | Deletes only named ZTerminal-owned current-user roots after confirmation. [3] | **Yes.** |

Alternatives considered are generally **UNKNOWN — requires verification** unless recorded in the cited code/contracts. Do not invent rationale beyond those records.

## 24. Git / Version History

At start of documentation generation, branch `main` matched `origin/main`; the baseline tree was clean. The later documentation commit is recorded after final validation.

| Commit | Date UTC | Useful architectural milestone |
|---|---:|---|
| `24c1d36` | 2026-08-25 | Conventional Windows installer source/current baseline. |
| `3cb6f3f` | 2026-08-25 | Native local-workspace presentation. |
| `c54abbf` | 2026-08-25 | Native Windows installer registration. |
| `a110df0` | 2026-08-24 | Explicit native chart revisions. |
| `0f18621` | 2026-08-24 | Retained native chart vertex buffers. |
| `fcd87cf`, `66a0a2c` | 2026-08-24 | Local history/contiguous-history research. |
| `8c5ef62`, `453c982`, `6d115c1` | 2026-08-24 | Local workspace and bounded catalog capability. |

No unfinished feature branch was identified from the inspected `main` baseline. Remote branch topology beyond this branch is **UNKNOWN — requires verification**.

## 25. Third-Party Services

| Service | Purpose/API/auth/fallback | Dependency risk/state |
|---|---|---|
| Gate.io | Futures historical REST and gateway stream paths; no credential requirement evidenced for public market endpoints. | Default web source path; reachability/licensing/rate limits/live status unknown. Failure must become unavailable. [12] [25] |
| Binance | Optional history/order-book/derivatives gateway adapter. | Partial source integration; deployment and API terms/rates unknown. [12] [30] |
| Bybit/OKX/MEXC | Static provider catalogue entries. | Catalogued only; no active gateway proof. [21] |
| Google | Auth.js OAuth provider. | Requires private client ID/secret and owned consent/deployment. Not enabled by source alone. [23] |
| Render | User-reported host/domain. | Current configuration, pricing/free tier, DNS/SSL, logs, and operational status unknown. |
| Railway | `railway.json` configuration. | Actual use unknown. [7] |
| PostgreSQL | Research compose/durable queue schema. | Separate service needed; deployment, credentials, backups unknown. [15] |
| GitHub Actions | Quality/legacy preview/internal test-signing workflows. | Track B installer is not included. [9] |
| Inno Setup | Private native installer compiler. | Locally installed dependency; version/source trust must be managed by builder. [3] |
| Caddy | Container reverse proxy. | Internal topology dependency; host TLS policy unverified. [8] |

No active AI API, analytics, notification, cloud-object storage, payment/subscription, or broker service integration was verified.

## 26. Performance

Known code-level bounds include: browser chart retains at most 2,000 bars; native source bars 100,000; simulations 10,000; horizon 1,000; work items 1,000,000; local history segments 16; chart-scene candles 2,000; and local catalog entries 256. These are safety/resource bounds, **not measured performance guarantees**. [10] [17]

Existing optimizations include retained native vertex-buffer/explicit revision work, Canvas frame scheduling, device-pixel-ratio cap, browser trade batching with `requestAnimationFrame`, bounded subscriber arrays, local cache/catalog limits, and gateway subscription bounds. [19] [20]

| Potential bottleneck | Evidence/status |
|---|---|
| Browser chart/workspace renders | Complex custom canvas + floating UI; no profiler trace or latency budget. **UNKNOWN — requires verification.** [16] [17] |
| WebSocket reconnect/provider outages | Infinite browser reconnection and gateway retry can consume resources during outage. Needs operational observation. [12] [19] |
| Local Monte Carlo/history | Bounded by design; hardware/device throughput unmeasured. [10] |
| Database/cloud | SQLite schema and research Postgres design, but no load/concurrency/backup evidence. **UNKNOWN — requires verification.** [13] [15] |
| Mobile performance | No mobile app. |

## 27. Product / UX State

The browser workstation visibly prioritizes a floating chart/workspace approach. It has advanced chart gestures and local indicator controls, but its product surface exceeds its currently verified data/research capabilities. The native app is intentionally a local-data workspace rather than a web-terminal clone. [1] [16] [17]

| UX area | Current state and discrepancy from intended direction |
|---|---|
| Chart-first workflow | Functional browser chart, but no full native chart parity or universal drawing toolkit. [17] |
| Cognitive load | Numerous workstation panels exist; provider/data availability can be unclear without strict labels. |
| Symbol/provider UX | Inconsistent browser Binance default versus Gateway Gate.io default is confusing. [12] [20] |
| Indicator UX | Built-in/custom local calculations work; professional source/import workflow is incomplete. [17] [26] |
| Strategy UX | Editor validates/converts conditionally but cannot execute/queue full backtests. [18] [15] |
| Order-flow UX | Calculations exist but must not imply institutional/verified data coverage. [27] |
| Mobile UX | Browser touch gestures exist; native mobile application/navigation does not. [17] |
| Windows UX | Conventional private installer and local unavailable overlay are clearer than legacy installer behavior, but the native client remains a vertical slice. [3] [6] |

## 28. Gap Analysis Against Intended ZTerminal Direction

| Intended capability | Current state | Evidence-based gap |
|---|---|---|
| Chart-first professional workstation | **Partial** | Browser chart/workstation functional; native parity incomplete. [16] [17] |
| Affordable local-first Windows terminal | **Partial** | Local Track B host/install exists privately; full app/release/signing missing. [2] [3] |
| Real market data | **Partial** | Gate/Binance source paths exist, live deployment/configuration unverified; explicit mock exists. [12] [25] |
| Order-flow/CVD/delta/footprint | **Partial** | Deterministic calculations exist; verified source coverage/history/rendering incomplete. [27] |
| DOM/liquidity | **Partial** | L2 bridge/events exist; full DOM claim unverified. [12] [30] |
| Volume profile | **Partial** | Domain/core supports calculations; no verified end-user full workflow stated here. [10] |
| Crypto GEX/options | **Missing** | No source pipeline/calculation. |
| Derivatives analytics | **Partial** | Binance derivative/liquidation event paths; no proof configured/live. [12] |
| Backtesting | **Partial / gated** | Schema/control plane/local primitives exist; no enabled user-code execution end-to-end. [13] [15] |
| Strategy research | **Partial** | Validation/Pine conversion policy UI exists; execution unavailable. [14] [18] |
| Web application | **Functional / partial** | Active browser workstation and deployment path; production health unknown. [7] [16] |
| Mobile application | **Not started** | No project. |
| Minimal cognitive load | **Partial** | Floating design exists; panels/provider inconsistencies need product validation. |
| Research-first, not execution-first | **Functional boundary** | No broker/execution path; research fails closed. [1] [15] |

## 29. Recommended Next Steps

This is a prioritized roadmap grounded in current blocking dependencies, not a claim that the work is already approved.

1. **Protect correctness boundaries first.** Reconcile browser provider identity with runtime provider, preserve explicit mock/unavailable states, and add provider contract tests before expanding feeds. [12] [20]
2. **Establish Track B release engineering privately.** Add CI that builds CMake `ZTerminalWindowsHost`, creates an isolated Inno smoke artifact, and verifies it without publishing. Keep signing/distribution as a separately authorized decision. [2] [3] [9]
3. **Choose a single durable cloud/auth operating model before enabling it.** Establish database ownership, migrations, backups, OAuth consent/redirects, authorization, and support/deletion policies. [13] [23]
4. **Build a real isolated research executor before enabling backtest execution.** It must have explicit sandboxing, resource limits, durable Postgres state, result provenance, cancellation, and tested Rust-engine handoff. Do not run code in browser/Next/FastAPI process. [14] [15]
5. **Make order-flow data provenance visible.** Integrate only verified trade/L2/OI sources, with availability states, historical limitations, and no “institutional” claims absent evidence. [27]
6. **Advance native UX in a bounded stage.** Focus on local scene selection, chart navigation, indicators, diagnostics, and user-tested Windows 10/11 behavior before broad feature parity. [1] [2]
7. **Treat GEX/options and mobile as new projects.** Define data/source/rights/model first; do not add cosmetic UI placeholders. |
8. **Add E2E and operational tests.** Browser interaction tests, native UI flow tests, deployment health checks, and a documented research-test configuration should follow core correctness work. |

## 30. Handover Summary

### Current State

ZTerminal is a mixed web/native research-terminal repository. The browser workstation is the most feature-rich user surface. The intended Windows direction is a local-first Win32/D3D11 host with Rust sidecars, currently a private functional vertical slice. [1] [2]

### What Works

The current verified baseline includes browser canvas chart interactions and local studies; deterministic web tests; TypeScript type/lint/build checks; Rust format/test/clippy checks; research policy/Pine/job tests; local Rust storage/research helpers; and isolated private conventional-installer smoke behavior. [3] [6] [10] [17]

### What Does Not Work

No broker trading, authenticated durable cloud sync, production research execution, active legacy ZS execution, public Windows distribution/trusted signing, full native workstation parity, GEX/options pipeline, or mobile app exists. [3] [15] [24] [28]

### What Is Incomplete

Provider deployment verification, native UX breadth, Python/Pine execution pipeline, durable research queue/runtime, cloud/auth operations, professional order-flow data/history, CI for Track B packaging, and E2E coverage remain incomplete.

### What Is Mocked

Only explicit gateway/bars mock mode is simulated and must be labelled `SIMULATED`; it is never a live fallback. [12] [25]

### Biggest Technical Risks

The top risks are false live-data/provider claims, user-code execution without isolation, cloud/auth without durable ownership, mistaken Track A/Track B release communication, unsigned private installer distribution, and UI implying data/features that are only schema/placeholder/source-dependent. [1] [3] [15]

### Highest-Priority Work

First reconcile provider truthfulness, add private Track B CI/smoke, define durable auth/cloud ownership, and implement a genuine isolated research executor. Then improve verified order-flow sources/native UX; start GEX/mobile only after their foundations are defined.

### Important Files

Read first: `docs/windows/LOCAL_FIRST_PRODUCT_BOUNDARY.md`; `docs/windows/PRIVATE_WINDOWS_INSTALLER_CONTRACT.md`; `apps/windows-host/CMakeLists.txt`; `apps/windows-host/src/main.cpp`; `src/components/terminal/terminal-chart.tsx`; `src/components/terminal/reference-chart-workspace.tsx`; `mini-services/market-data/index.ts`; `src/hooks/use-market-stream.ts`; `src/stores/workspace.ts`; `research/api/app/{main,service,worker,postgres_store}.py`; `prisma/schema.prisma`; `scripts/start-production.sh`; `.github/workflows/quality.yml`.

### Important Commands

Use the commands in Section 18 to install, run, test, build, and smoke. Deployment to a host is deliberately not claimed reproducible until Render/Railway service configuration is verified. Private Windows installer build/smoke commands must remain private and must not be interpreted as release commands.

### Important External Dependencies

Gate.io default web data path, optional Binance adapter, Caddy/Docker container topology, user-reported Render host, optional Google OAuth, Prisma SQLite schema, optional research PostgreSQL, GitHub Actions, and local Inno Setup compiler are the important external dependencies. Their actual production configuration/state is not implied by this list.

## 31. Evidence, Unknowns, and Maintenance Rule

This document is a source-based handover, not a public operational attestation. Update it when provider/runtime defaults, native startup behavior, research execution, cloud auth/storage, installer ownership paths, CI/release pipeline, or public distribution state changes. Replace **UNKNOWN — requires verification** only with an authorized, dated verification record that does not expose secrets.

### Repository Evidence References

[1]: windows/LOCAL_FIRST_PRODUCT_BOUNDARY.md "Track B local-first product boundary"
[2]: ../apps/windows-host/CMakeLists.txt "Track B CMake host and Rust sidecar packaging"
[3]: windows/PRIVATE_WINDOWS_INSTALLER_CONTRACT.md "Private Windows installer contract"
[4]: ../src/app/terminal/page.tsx "Browser terminal route"
[5]: ../src-tauri/tauri.internal-hosted-preview.conf.json "Legacy internal hosted Tauri preview"
[6]: windows/benchmarks/windows-private-installer-smoke.json "Private Windows installer smoke evidence"
[7]: ../Dockerfile "Web production container"
[8]: ../scripts/start-production.sh "Web production startup"
[9]: ../.github/workflows/quality.yml "Quality and legacy Tauri CI"
[10]: ../Cargo.toml "Rust workspace, release profile, unsafe-code prohibition"
[11]: ../package.json "Root scripts and JavaScript dependencies"
[12]: ../mini-services/market-data/index.ts "Market gateway"
[13]: ../prisma/schema.prisma "Main Prisma schema"
[14]: ../research/api/app/main.py "Research API routes and control plane"
[15]: ../research/api/app/worker.py "Research worker isolation/execution gate"
[16]: ../src/components/terminal/reference-chart-workspace.tsx "Browser terminal workspace"
[17]: ../src/components/terminal/terminal-chart.tsx "Canvas chart implementation"
[18]: ../src/components/views/python-strategy-view.tsx "Python/Pine research browser UI"
[19]: ../src/hooks/use-market-stream.ts "Browser market stream hook"
[20]: ../src/stores/workspace.ts "Browser workspace state/persistence"
[21]: ../src/lib/market/capabilities.ts "Static provider catalogue"
[22]: ../src/lib/releases/windows-release.ts "Public Windows release gate"
[23]: ../src/lib/auth.ts "Auth.js/cloud configuration gate"
[24]: ../src/app/api/strategy/route.ts "Retired ZS compilation endpoint"
[25]: ../src/app/api/bars/route.ts "Historical bars and explicit mock route"
[26]: ../src/components/terminal/indicators-browser.tsx "Indicator browser"
[27]: ../src/lib/market/order-flow.ts "Order-flow calculation library"
[28]: ../src/app/api/backtest/route.ts "Retired ZS backtest endpoint"
[29]: ../src/app/api/markets/route.ts "Market snapshot route"
[30]: ../src/lib/market/binance.ts "Binance market adapter"
[31]: ../src/app/api/route.ts "Root API route"
[32]: ../src/app/api/connectors/rithmic/route.ts "Rithmic unavailable connector boundary"

### External references

No external source is used for implementation claims in this handover. The installer contract itself links official Microsoft and Inno Setup documentation for general current-user installer statements; its references should be consulted when packaging policy changes. [3]
