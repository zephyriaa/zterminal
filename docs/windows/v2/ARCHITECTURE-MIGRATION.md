# Baseline components, dependencies and migration

Milestone 0 only, 11 October 2026. Governed by `../V2-PRODUCT-BUILD-PROMPT.md`. Continue bundled Tauri 2 + React + Rust, then a Rust-brokered Python worker. Win32/D3D/WinUI remains separate research. No renderer switch, new dependency, web migration, deployment, signing or publication is authorized here.

## Inspected implementation

| Component / source | Existing behavior and ownership | V2 reuse / missing work |
|---|---|---|
| `apps/workstation/main.tsx`, `workstation.tsx`, `style.css`, `vite.config.ts` | Separate local React entry, explicit platform, transient busy/error/dirty/range state; Segoe UI/blue presentation, fixed workspace sidebar | Preserve launch/create/import/save/restore. Entire V2 chrome/type/material/navigation/docking absent. No embedded design screenshot or synthetic feed. |
| `src/lib/workstation-platform.ts` | Seven typed invokes: list/restore/open/create/save/import/scene; TypeScript projection, no account/provider effects | Keep boundary; extend versioned bounded commands rather than creating another storage authority. Projection is partial, not generated full V2 schema. |
| `src/components/terminal/observed-history-chart.tsx` | Lightweight Charts candlesticks; UTC milliseconds→seconds; supplied observed bars; range dirty only after pointer/wheel | Reuse renderer. No accepted V2 colors/fonts, study/drawing/volume/replay/options or chart semantic controls. Recreates chart on data/range changes. Pointer delivery alone does not prove crosshair correctness. |
| `src-tauri/src/lib.rs`, `commands.rs`, `capabilities/main.json` | Per-user Store in mutex; bundled main-window URL gate; remote/other window rejected; seven commands; no process/network/Python command | Rust remains validation/persistence owner. Strings are unversioned errors; calls synchronous under global mutex; detached command authority needs narrow design before adding windows. |
| `src-tauri/tauri.conf.json` | Local `out/workstation`; CSP self/IPC; decorated native window 1440×900 with 1024×680 minimum; unsigned NSIS configured with online WebView2 bootstrapper | Preserve default local bundle. Minimum size conflicts with 911×512/683×384 work areas. Window/DPI/install policies need acceptance. |
| `src-tauri/workstation-core/src/lib.rs` | SQLite schema 1, WAL/FULL, optimistic revisions, content SHA-256, chart/workspace references, last selection; strict CSV; immutable segments and bounded 2k scenes | Extend via explicit migrations preserving originals. Dataset is **Phase 1 Dataset v1**, not DatasetManifestV3. No strategy/run/preferences/layout repository. Existing validator rejects indicators/drawings/replay/presentation. |
| `crates/zt-domain/src/lib.rs` | WorkspaceDocumentV2, ChartDocumentV3, DatasetManifestV3, StrategyRevisionV2, ExperimentRunV2, ReplayClock; identity/hash/coverage/state validation | Commit adopted prerequisite as-is; no V2 behavioral completeness implied. Binding/converter and relationship/state-machine tests still required. See review below. |
| `zt-core`, `zt-protocol`, `zt-storage` | Strict sequence/observed aggregation/segment codec; bounded scenes; immutable segment storage/catalog/journal | Reuse validation/scene primitives. Storage FNV is not authentication; workstation adds SHA. Full-source repeated integrity checks and 100k import ceiling require measured scaling plan. |
| `zt-adapters`, offline/direct ingest and local scene/catalog/workspace CLI apps | Public normalization, persistence/readiness and standalone ingest/bridges | Existing Binance aggregate-trade decoder accepts Spot only; provider enums are not perpetual feature completion. Standalone direct-public ingestion is not a workstation connection. Need verified historical Spot/perpetual metadata, marks/funding. |
| `zt-risk`, `zt-execution`, paper CLI | Caller-input risk gate, quote-driven paper journal, live-disabled boundary | Keep isolated; uncommitted risk edits excluded. Does not supply the required versioned perpetual simulator or broker authority. |
| `research/desktop/{server,controller,child,archive,engine,analytics,process_limits}.py` | Paired loopback origin/Host authentication for web helper; immutable captured request; one active job; bounded subprocess/outputs; archive/recovery; seeded closed-trade bootstrap | Reuse math/archive semantics through explicit compatibility adapter. Same-user Python can access filesystem/network/credentials despite environment scrubbing and Job Objects. Rust desktop broker/isolation/queue absent. Never reuse helper token in renderer. |
| `src/lib/local-research/{contracts,client,dataset,drafts,evidence}.ts`, research store | Web helper contracts, provider dataset checks, revisions/drafts/evidence UI | Legacy Dataset/ResearchResult/config/version 1 is not new native V3/V2. Defaults include Gate provider and old simulation semantics; no silent rebadging or numerical re-interpretation. |
| `src/stores/workspace.ts`, `src/lib/workspace-payload.ts`, chart workspace snapshot/layout | Web local/cloud ownership, persisted store v5; cloud envelope v1/v2, validated web chart references | Preserve web API/auth/provider/cloud behavior. Explicit converters with golden fixtures before native import/export; local-folder move must not migrate cloud ownership. |
| Web shell/sidebar/Dockview/editor/UI primitives | Rich web product with server/account/provider lifecycle | Reuse controlled presentation and semantics via platform adapter. Do not mount terminal/auth/query/provider effects in desktop. |
| `src/lib/chart/{contracts,lightweight-adapter,workspace-snapshot}.ts`, `drawings/{contracts,geometry,coordinates,snapping,primitive}.ts`, `indicators/evaluators.ts`; drawing toolbar/inspector/objects/interaction layer and indicators browser | Existing web ChartDocument schema 5, semantic anchors, projection/snapping, styles, studies, ReplaySession and chart adapter | Reuse pure geometry/evaluation and controlled UI through explicit converters; web schema 5 is not Rust ChartDocumentV3/ReplayClock. Existing richer web tool list does not automatically become approved V2 tool scope. |
| `research-editor.tsx`, `code-editor.tsx`, `research-report.tsx`, `research-workbench.tsx`, report dialog | Existing web editor/Monaco and helper-driven evidence flows | Extract presentation only with explicit local repositories/broker. Source revisions/results and account/helper effects must not be transplanted implicitly. |
| `apps/windows-host` native Win32/D3D/WinUI and scripts | Real renderer and local Rust bridges, fixture/performance research; current WinUI files partly uncommitted | Separate track. Historical benchmark results do not establish complete V2 product parity or Tauri installation. No native source changes in M0. |
| `artifacts/figma-rebuild/revision-v2` | Semantic DOM compositions, actual fonts/logo/Lucide, synthetic design values, navigation scenarios | Reference only, never a runtime implementation. Snapshot archived because the directory is ignored by Git. Current 33 export correct; sources differ in header product label. |
| Hosted preview config/workflows, legacy web desktop launch/sync files | Explicitly remote preview and retained compatibility route; old launch target broken | Retain and label; exclude from offline acceptance. No cleanup in M0. |
| Quality/Windows/deployment workflows | Web tests/build; separate Windows build; production workflow tolerates Python errors and audit threshold uses `|| true` | Reproducible local baseline does not establish deployed end-to-end behavior; release gates must actually enforce failures in later scope. No workflow/deployment edits. |

## Dependency inventory

The exact locked dependency graph is in the existing root `package-lock.json`, `Cargo.lock`, `src-tauri/Cargo.lock`, and `src-tauri/workstation-core/Cargo.lock`. Their hashes and relevant installed versions are in `dependency-inventory.json`. No package version was changed or added by M0. The adopted domain crate adds only existing `serde` and `serde_json` to workspace locking.

| Dependency group | Present dependency / purpose | Desktop treatment |
|---|---|---|
| Local UI | React/React DOM 19, Vite 7, TypeScript 5 | Bundle locally; keep Vite entry separate from Next. |
| Desktop | Tauri API/CLI 2, Rust tauri/tauri-build 2, Windows WebView2 | Explicit local main capability; runtime installation/offline distribution unaccepted. |
| Chart/dock | lightweight-charts 5; dockview-react/core 8; dnd-kit; react-resizable-panels | Reuse controlled components. Dock libraries installed but not imported by Phase 1. Retain chart attribution/license requirements. |
| Editor | Monaco 0.55.1 + React wrapper 4.7.0; prepared local vendor assets | Local language/editor assets must be bundled and exercised offline; Phase 1 editor absent. |
| Controls/icons | Radix UI family, Lucide, cmdk, React Hook Form, Zod, Tailwind | Existing packages; names/focus/error semantics need V2 contract checks; no emoji substitutes. |
| State/motion | Zustand, React Query, Framer Motion, GSAP, Lenis | Use only where already justified; avoid web server effects and decorative movement in reduced mode. |
| Web-only | Next 16.3.6, NextAuth, Prisma/PostgreSQL, Socket.IO, OpenNext AWS/Cloudflare | Preserve routes/auth/deployment. Never bundle account/server services into the local shell. |
| Rust persistence | rusqlite 0.31 (bundled SQLite), sha2 0.10, rust_decimal, serde/json; tempfile tests | Rust validation/repository authority; exact increments retained. |
| Rust data | protocol/core/storage/adapters; live transport dependencies in lock | Reuse observations/coverage; provider ownership explicit. No networking capability in Phase 1 shell. |
| Python | Prepared Python 3.12, vectorbt 0.28.1, NumPy/pandas/Numba, analytics and process limits; lock exists locally | Bundle/runtime policy needs decision. Current helper executes with local user permissions. Local uncommitted requirements edits excluded. |
| Fonts/assets | Exact Geist and Geist Mono WOFF2 (normal variable 100–900), Lucide SVG paths, discrete Z logo | Source font hashes frozen; Figma style names/weights and notices pending. Phase 1 currently uses system fonts. |

Install output reports 22 vulnerabilities (2 moderate, 19 high, 1 critical); see captured lock installation log and audit evidence. This is a dependency baseline, not an authorization for broad upgrades. Investigate reachability and update with web/desktop regression evidence in a separate reviewed change.

Production-only audit reports 14 advisories (2 moderate, 11 high, 1 critical); it is recorded independently from the full install count in `evidence/production-dependency-audit.json`.

## V2 component families

All are raw source/capture compositions; shared Figma instance/variable integration is unverified at current quota. Existing web equivalents are reuse candidates, not permission to copy account/server effects.

The parent `artifacts/figma-rebuild/HANDOFF.md` and `design-system-state.json` were also inspected. `legacy-design-system-inventory.json` retains every earlier component/master, variable/style, page and 35-screen node ID. Those records use Inter/JetBrains Mono, #9B6BFF and an editor-first/WinUI sequence. Their geometry, tokens and architecture are superseded by current V2 and the governing brief. Earlier button/input/tab/nav/status/toggle/material masters are reuse candidates after explicit Geist/Violet conversion and review, not currently accepted V2 instances. Saved construction/finalization requests must not be replayed into the populated file. They are preserved under `legacy/` in the design source archive for traceability.

| Family | Required V2 variants | Existing reuse candidate / gate |
|---|---|---|
| Windows chrome/header | Native caption, instrument/workspace, utilities, compact/expanded | Tauri decorations + controlled web shell; OS-region capture policy pending |
| Research navigation | Expanded 194/rail 42, selected/hover/focus/unavailable/local libraries | ResearchSidebar; earlier Figma compositions need library propagation review |
| Dock groups/tabs | Active/inactive, dirty, focus/restore/detach/redock/close/resize | Dockview organization; native presentation ownership/multiwindow authority pending |
| Toolbar/icon button | Default/hover/pressed/focus/disabled, named Lucide | Existing UI primitives; menu contents and states missing |
| Actions/fields/selectors | Primary/secondary/error/loading/disabled, bounded inputs | Radix/input families; exact control states and selectors pending |
| Dataset/provider badge | Live/cached/stale/gap/unavailable with text/icon | Rust provenance/readiness + controlled display; design labels are example state only |
| Evidence tables/charts | Numeric alignment, row selection, empty/loading/error, real metrics | Existing reports/Lightweight Charts; details/empty sources unapproved |
| Dialog/inspector | Named title, focus trap/restore/Escape, scrolling/fixed footer | Radix or existing dialog; source focus loop does not prove native accessibility |
| Diagnostics/job row | Queued/running/cancelled/failed/interrupted/completed | ExperimentRunV2 projection + helper lifecycle adapter; no desktop job backend yet |
| Typography/material resources | Geist/Mono weights, tokens, spacing/radii, rich/reduced/opaque/motion | Source assets/hash verified; Figma style names/variables and composed contrast unaccepted |

## Domain prerequisite review

Commit `4040781` contains only the four prerequisite files. All five existing domain tests pass from a clean exported checkout. `deny_unknown_fields`, safe IDs, exact SHA reference shape, workspace duplicate/dangling-active checks, interval coverage accounting, replay boundary and completed-result-only publication are useful foundations. Missing-doc warnings are retained rather than rewriting user code in an audit.

Limitations requiring tests/design before consumers expand:

- Workspace and chart/reference relationship validity is enforced in the local Store, not all in the generic domain. Document references do not prove artifact type/existence/hash; repository must reopen and validate.
- Chart validation does not bind timeframe/replay/drawings to selected dataset or bound viewport to it. Indicator kinds are EMA/SMA/RSI only; V2 Volume configuration lacks a matching record. Adding study kinds requires a version/compatibility decision.
- Dataset metadata validates shapes, not source authenticity, symbol/product units, historical rule identity or mark/funding content. Partial funding boundaries without an artifact can pass generic validation; close that trust-boundary gap before perpetual execution.
- Replay permits neither `availableThrough == to` nor an explicit stopped/complete state and has no shared lifecycle enforcement; agree half-open boundary/rewind policy before M3.
- Run state validates final artifact presence, not allowed transitions, archive completeness, captured relationship compatibility or arbitrary-Python causality. Strategy references are shapes rather than an execution sandbox.
- Field/string/list bounds are uneven (e.g. gaps, descriptive metadata and diagnostic artifacts). Rust deserialization/resource limits and repository validation are still required. No new IPC may rely on generic shape validation alone.
- Phase 1 strict importer requires positive volume; web research validator permits zero volume. Resolve valid zero-volume treatment explicitly; do not silently change import semantics.

These do not invalidate the bounded current slice, whose Store rejects unsupported V2 fields. They prevent claiming the prerequisite alone implements research/provider/replay correctness.

## Migration sequence and rollback boundaries

1. **M0 prerequisite + audit:** commit exact domain membership/lock; export clean checkout; reproduce baseline; freeze review manifest, control contracts, failures and decisions. Gate stays blocked on design acceptance.
2. **M1 shell:** bundle verified fonts/icons and accepted V2 components; materials/navigation/initial appearance via adapters. Preserve existing seven-command slice. Add presentation settings with versioned migration and original backup. Screenshot overlays at fixed native-client conditions; no invented runtime data.
3. **M2 documents/docking:** introduce presentation artifacts independently of document/draft ownership; local libraries and drafts/revisions; windows authority, dirty close/redock, safe monitor restore. Explicit schema migration and backup/rollback; no cloud ownership migration.
4. **M3 data/charts:** migrate Dataset v1 to V3 with explicit `csv` user-declared origin/UTC/units; reject unknown product rather than infer Spot/Futures from labels. Golden converters preserve original bytes and chart reference. Formats/provider metadata/history/marks/funding, drawings/studies and one replay cursor follow capability contracts. Grow retained-history support beyond import ceiling without unbounded rendering.
5. **M4 research:** add Rust repositories for captured strategy/config/runtime/run documents; broker and isolation policy, queue/cancel/restart; versioned spot and isolated-margin perpetual simulation. Legacy web results remain immutable under their original engine model. No code execution until preflight/capture/isolation gates pass.
6. **M5 evidence:** read completed archives, numerical reports/trades/provenance, compatible comparison, seeded closed-trade bootstrap, actual picker exports and remaining settings. Each menu item and control row gains a meaningful executed test.
7. **M6 Windows quality:** Narrator/keyboard/IME/contrast, every DPI/monitor arrangement, crash/disk/service failure, 10k/100k/1m input/performance distributions. Resolve all critical/major defects; use native captures and approved masks only.
8. **M7 unsigned distribution:** runtime/fonts/icons/worker/assets inventory and notices/SBOM; Win10/11 clean/offline install/upgrade/uninstall/data retention and WebView2 policy. Signing/publication separate authorization.

For every migration: create an original backup before transformation; validate referenced artifacts; optimistic/transactional commit; explicit failure without pretending saved; retain originals on rejection. Unknown newer versions fail closed. Rollback must open the retained original with its original engine, not overwrite V2 data with a legacy interpretation.
