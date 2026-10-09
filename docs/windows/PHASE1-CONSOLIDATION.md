# Windows consolidation: Phase 1

Decision date: 2026-10-09. Scope: launch → local workspace → verified local import → chart interaction → save → process restart → restore. No deployment, publication, signing, production secrets, or trading authorization.

## ADR: locally bundled Tauri 2 workstation (B)

Choose B. Ship a separate Vite/React bundle with Tauri-owned storage and narrowly scoped commands. Never use a hosted URL as its production frontend. Preserve Next.js web routes, providers, authentication, cloud workspace behavior, and deployment independently. Reuse the installed chart renderer and normalized Bar shape through a platform-neutral chart component; do not mount the web terminal, whose provider and account lifecycle assumes a server.

A has useful D3D11 rendering, persistent vertex buffers, local segment navigation, and Rust subprocess bridges. `apps/windows-host/src/main.cpp` creates hardware/WARP devices, accepts explicit local scenes, and contains an explicit fixture mode. `winui/MainWindow.xaml.cpp` wires pointer input and a 16ms timer to that renderer; it is uncommitted baseline work. The recorded fixture and local scene benchmarks under `docs/windows/benchmarks` are historical evidence, not fresh product comparisons. No measured end-to-end product advantage over B was found. A requires an independent implementation of workspace editing, import UX, document ownership, recovery, accessibility, and packaging. Retain it for bounded rendering/performance experiments.

B costs: a new local frontend entry point; storage/IPC adaptation; explicit migration of web document semantics; WebView2 installation and memory cost; chart parity verification. It avoids rebuilding every web interaction in C++/WinUI. Do not silently migrate cloud/account data into device-owned workspaces. The existing `zt-domain::WorkspaceDocumentV2` and `ChartDocumentV3` are the canonical desktop documents; TypeScript is an IPC projection, not a second persistence authority. Existing web SavedWorkspace payloads remain a compatibility contract pending an explicit converter.

## Source-verified component inventory

| Component | Classification | Source evidence / implication |
| --- | --- | --- |
| Win32/D3D host | Useful research implementation | `apps/windows-host/src/main.cpp`: real D3D11, WARP fallback, fixture flag, pointer navigation, local bridges. No full product acceptance established. |
| WinUI shell | Prototype / user baseline | `apps/windows-host/winui/MainWindow.xaml.cpp`: SwapChainPanel, input, timer, layout. Not a canonical persistence owner. |
| Rust data engine | Reusable | `crates/zt-core/src/lib.rs`: sequence validation, observed-only aggregation, segment codec, bounded 2,000-candle scenes; degraded sources withheld. |
| Rust storage | Reusable with limits | `crates/zt-storage/src/lib.rs`: immutable segments, FNV integrity, bounded catalog and journal. Not SQLite despite old future-migration comments. FNV is not authentication. |
| Rust protocol/adapters | Reusable | `zt-protocol` carries provider/environment/status; `zt-adapters` normalizes public input. Fixture provenance must never become product data. |
| Rust domain | Canonical candidate adopted | `crates/zt-domain/src/lib.rs`: validated versioned workspace/chart/dataset documents and SHA references. Entire crate is untracked in the initial user working tree; new commits require this baseline prerequisite. |
| Tauri shell | Incorrectly wired | `src-tauri/tauri.conf.json`: remote frontendDist; `src/lib.rs`: global shortcut + database state; commands previously dashboard/sync only. |
| Tauri database | Mock / redundant | `src-tauri/src/db.rs`: open_in_memory, hard-coded workspaces/studies; no persisted chart/data. `trigger_sync` merely updates SQL strings. Replace in local shell. |
| Desktop launch page | Broken navigation | `src/app/desktop/launch/page.tsx` pushes `/desktop/dashboard`; no corresponding route exists. New bundled entry removes this path from workstation startup. Legacy web page remains for compatibility. |
| Web terminal/chart | Production-useful, platform coupled | `terminal-chart.tsx` uses historical provider fetch + dedup; `reference-chart-workspace.tsx` and workspace store own rich web interactions. Do not transplant provider/account effects into offline UI. |
| Web CSV importer | Unsuitable for verified import | `src/lib/market/dataset-importer.ts` skips malformed rows, repairs OHLC, defaults/clamps volume, deduplicates. Desktop must reject invalid input instead. |
| Web workspace storage | Useful web contract | `src/stores/workspace.ts`: Zustand persisted v5, local/cloud ownership; `workspace-payload.ts`: validated cloud envelope v1/v2. Not interchangeable with native opaque numeric journal IDs. |
| Python helper | Useful research service, separate lifecycle | `research/desktop/server.py`: loopback Host/origin gate + paired tokens; `controller.py`: captured jobs, scrubbed environment + resource limits; `child.py`: executes supplied strategy code. Resource limits are not a credential/filesystem sandbox. Do not expose secrets or add worker execution in this slice. |
| Native build/installation | Useful separate track | `build-native.ps1`: CMake/VS release; installer scripts build Inno Setup + smoke checks. Does not validate a Tauri workstation installer. |
| Windows hosted preview workflows | Redundant legacy preview | `internal-windows-preview.yml` / `internal-windows-test-signing.yml` explicitly fetch hosted terminal then package a remote shell. Keep separate from local product and never use as local acceptance. |
| Quality / production workflows | Web checks | `quality.yml`: tests/typecheck/lint/build; audit threshold uses `|| true`. Production workflow has tolerated Python failures. Neither proves Windows local restart/offline/install. |

## Dependency and ownership map

```text
Next.js web → web stores/providers → server APIs → Prisma/cloud/auth
                              ↘ existing paired research helper → bounded Python child

Bundled React workstation → WorkstationPlatform → Tauri commands (local main window only)
                                              → local core → zt-domain documents
                                                           → SQLite WAL metadata/artifacts
                                                           → zt-core codec/scene → zt-storage immutable segments
Native Win32/WinUI research → subprocess bridges → same Rust core/storage primitives
```

Rust owns document validation, import validation, integrity, revisions, atomic save and last-opened identity. UI owns transient busy/error state and unsaved viewport intent. No credentials, remote requests, trading, synchronization, or Python access exist in the Phase 1 adapter. Imports are user-supplied historical observations, structurally validated and content-hashed; that does not authenticate their exchange origin.

## Migration sequence

1. Commit audit and acceptance specification without touching user baseline.
2. Introduce testable local storage core: transactional schema migration, canonical references, strict CSV import, engine-backed scenes, revision conflicts, integrity withholding. Empty old in-memory records have no durable data to migrate. Refuse unknown newer schema versions.
3. Bundle workstation frontend; replace Tauri startup/commands; extract a platform-neutral chart and explicit IPC adapter. No Next.js changes.
4. Execute storage, chart/browser, native startup, restart, offline, web regression, and build checks. Commit coherent tested increments. Record failures, prerequisites and measurements.
5. Only after this slice passes: explicit web/native document converters, richer chart tools, Rust-brokered Python lifecycle and credential isolation. Retain native renderer benchmarks for comparative testing.
6. Installation: isolated unsigned NSIS build, clean-user install/relaunch, upgrade preservation, uninstall retention, WebView2 offline prerequisite. Publication/signing/deployment require separate authorization.

## Risk register

| Risk | Mitigation / acceptance gate |
| --- | --- |
| Existing dirty tree includes manifests/locks/WinUI/domain | Preserve baseline; stage only owned edits; explicitly record domain prerequisite. No reset or accidental baseline commits. |
| Domain schema differs from deployed web snapshots | Desktop adopts domain; web unchanged; converters deferred and required before cross-platform import. |
| Arbitrary CSV provenance/units | Strict bounded import, explicit symbol/tick/quantity units, SHA exact bytes, show imported historical label, no provider authenticity claim. |
| Float → tick conversion | Reject non-finite, non-positive and non-representable prices/volume; never round invalid units into valid bars. |
| Corruption / partial save / stale UI write | Hash artifacts on read, transaction + optimistic revisions, withhold corrupt data; commit last-opened only with saved workspace. |
| Segment file crash between artifact and SQL writes | Immutable orphan may remain; no false success; previously committed workspace remains authoritative. Cleanup deferred. |
| Python child is untrusted code | No worker launch or credential path in slice; future broker must enforce isolation beyond environment scrubbing. |
| Hosted preview accidentally treated as release | Default config local; legacy commands explicitly labelled; no hosted deployment workflow changes. |
| WebView2 runtime absent offline | Offline installer prerequisite gate; existing runtime required for executable smoke. No claim of offline installation without testing. |
| Web regressions / chart differences | Preserve deployed routes; run web suite/typecheck/build; browser gestures + actual Windows inspection. |
| Product performance unknown | Measure import/save/restore and built asset size; separate research fixture metrics from product measurements. |

## Phase 1 acceptance tests (specified before implementation)

- Fresh launch presents empty local workspace list and truthful unavailable history; no account, sync, trade or synthetic feed affordance.
- Create/open a named workspace. Strict CSV requires `t,o,h,l,c,v`, UTC epoch milliseconds, ordered contiguous closed candles, explicit tick/quantity increment; malformed OHLC, duplicate/gap/future/oversize/nonrepresentable input fails atomically.
- Imported bytes and normalized immutable segment have persisted integrity checks. Reload uses existing core scene contract, limits scene size and never requests a remote fallback.
- Pan, wheel zoom, crosshair and reset work; save records the visible time range and workspace identity. Unsaved changes are visible; failures never become success messages.
- Save commits document references and last-opened identity together. Restart with a new process/connection restores name, dataset and viewport without source file or network.
- Competing stale revision fails without losing committed content; unknown schema and corrupt/missing artifact fail with diagnostic, never fabricated data.
- Fresh schema migration is idempotent; a newer version is rejected without downgrade. Invalid import leaves no workspace reference.
- Local commands cannot execute trades, workers, arbitrary processes, network requests or access renderer-supplied filesystem paths. Remote windows have no workstation capability.
- Windows executable builds against bundled frontend. Browser regression observes gesture/save/reopen through adapter; native smoke confirms actual bundled startup. Installer and upgrade checks must be reported independently.
- Existing web tests, typecheck, lint and release build remain checks. Record actual results and baseline failures separately.

Implementation and validation results will be appended after execution. This document is a decision/specification, not a claim that the gates already pass.
