# ZTerminal — full Figma-aligned native revision plan

14 October 2026 · Planning deliverable · Implementation paused

## Outcome

Deliver the ZTerminal research workstation represented by the V2 design: one connected place to **observe → investigate → code → test → compare → refine**. The main experience is an instrument-led chart with useful market context, an editable strategy, explicit research inputs and durable evidence. Workspace management supports that experience. A successful CSV demo or renderer test suite cannot accept the product.

The latest user review rejects the current native version as far from this goal. This plan replaces further R1 implementation as the current task. It proposes the complete sequence; it does not authorize automatic execution of later renderer or product milestones. The existing R1 product gate remains failed/incomplete.

## Authority and reference status

- Product purpose: [current GitHub README](https://github.com/zephyriaa/zterminal/blob/main/README.md), fetched again on 14 October. Its Windows architecture review is superseded by the user's later native-only instruction.
- Design: [Figma V2 file](https://www.figma.com/design/VtIJq6WBPRJUUKtc4XvnxE), page `3:3`; the 25 frames in `v2/reference-manifest.json` and additional saved V2 arrangements.
- Governing native brief: `V2-PRODUCT-BUILD-PROMPT.md`; renderer brief: `OWN-CHART-RENDERER-PLAN-PROMPT.md`; constraints: `LOCAL_FIRST_PRODUCT_BOUNDARY.md`.
- Behavior: `v2/ACTIONS.md`, `v2/control-inventory.csv`, saved V2 `INTERACTION-CONTRACT.md`, renderer `FEATURE-TEST-MATRIX.md` and existing domain contracts.

Fresh Figma verification on 14 October: `get_design_context` for `14:1080` returned sparse layer metadata, including native-caption layout, 194-DIP navigation, 871.5-DIP chart section and 373.5-DIP context/research section. It explicitly requires child context calls for high-fidelity details. The subsequent `get_screenshot` request failed with the connected Starter-plan tool-call limit. Full visual/style verification was therefore **Blocked**, not passed. Metadata access does not establish complete reference availability.

The saved manifest has 25 frames, one recorded original export (`33:1080`) and 24 missing originals. It is explicitly provisional and unapproved. The source census has 1,769 repeated control occurrences across 25 compositions and 11 additional arrangements, grouped into 31 action families. These are not 1,769 distinct implemented features. Menus, unseen states and original Figma descendants remain incomplete. The existing EX-M1-01 provisional-reference exception is limited to Milestone 1; it does not approve later screens or material redesign.

### Design preparation before presentation replacement

1. Obtain fresh screenshot and high-fidelity child context for every required frame. Record node ID, logical size, export hash, capture date, variables, text styles, icons/assets, bounds and review status. Preserve existing exports.
2. Compare originals with saved V2 sources. Resolve observed differences explicitly: for example, the fresh main-frame metadata says **Binance Futures**, while a saved control row says **Binance Spot**. Product identity must come from verified data; example text cannot override it.
3. Review missing menu items and empty/loading/error/recovery states. Use **Penpot** for new design work, linked back to the Figma frame and control contract. Keep existing Figma as the visual authority; no unapproved redesign.
4. Freeze an accepted frame/state manifest and native component specifications. Obtain concrete design review before treating new compositions as accepted. Missing references block their dependent visual gates; independent correctness work can proceed within its authorized milestone.
5. Exclude design review cards, scenario links and “DESIGN EXAMPLE” results from the installed product. Synthetic data exists only in isolated, visibly labelled TEST ONLY fixtures.

## What the revised application must look and feel like

Build the actual V2 hierarchy in native controls rather than adding more controls to the rejected demonstration layout:

- Native Windows caption behavior, then the instrument/provider header and a separate local workspace identity.
- Expanded research navigation at the reference 194 DIP; compact rail at 42 DIP. Destinations are Chart, Indicators, Strategy Developer, Research, Market Context and Settings, with truthful capability treatment for roadmap entries.
- A dominant chart group with document tabs, panel actions, timeframe/range controls, study/replay controls, drawing tools, accurate axes/readouts and a useful default zoom.
- Market context above the strategy/research dock on the right. Context explains the selected instrument, source, coverage, units and availability. It does not show irrelevant setup instructions after data is loaded.
- A real strategy editor and research controls connected to the same selected dataset and strategy revision. Results open durable evidence, not a decorative dashboard.
- Focused studio, maximized chart, detached group and compact layouts follow their individual frames. The main frame is approximately 70% chart / 30% context; that is not a universal fixed split.

The saved source proposes workspace `#090A10`, panels `#14111D`, plot `#0B0A10`, Violet selection `#B5A2E8`, text `#F0EFF5`, muted `#A8A2B5`, up `#34D399` and down `#FB7185`. Verify these against actual Figma variables before final acceptance. Reuse legitimate Geist/Geist Mono fonts, the Z mark and existing icon sources with notices. Define native text styles, 4-DIP spacing steps, control/panel/dialog radii and 2-DIP focus outlines from the accepted references.

Use restrained materials in chrome and controls, stable reading surfaces, rich/reduced/opaque modes and reduced motion. Preserve native snap, taskbar, maximize/restore, IME and accessibility conventions. Any necessary Windows-specific visual deviation must be recorded and reviewed.

Validate logical sizes 1366×768, 1440×900, 1920×1080 and detached 1024×680 at 100/150/200% scaling. Also cover small logical 911×512 and 683×384 arrangements. Collapse navigation, use tabs/overlays and internal scrolling rather than shrinking text. Test long instrument names, diagnostics, translated/long labels and off-screen restored windows.

## Architecture and reuse

| Responsibility | Existing foundation | Revision approach |
| --- | --- | --- |
| Windows presentation | `apps/windows-host/winui`, native host | Native WinUI controls, C++ geometry, D3D11 and DirectWrite. Rebuild compositions and component states here. |
| Chart geometry and input | `apps/windows-host/src/main.cpp`, `chart_math.h`, `native_chart_host.h` | Independently implemented renderer. Retain proven math and raster checks; expand original features through renderer gates. |
| Verified data and replay | `zt-core`, `zt-storage`, `zt-protocol`, `zt-domain` | Rust owns validation, exact units, availability, revisions, replay cutoffs and semantic documents. |
| Durable repository | `src-tauri/workstation-core` Store/native adapter | Reuse SQLite/artifact/import/revision logic through a narrow native interface. Its historical directory name does not require Tauri presentation. |
| Strategy documents | `strategy.rs`, `StrategyRevisionV2` | Retain exact source/parameter artifacts; add native editing, revision browsing, drafts and recovery. |
| Research execution | `research/desktop` controller, child, engine, validation, archive and local cash path | Bind the existing bounded local worker and archive. Add a native supervisor and durable workspace run references; preserve each model/version. |
| Studies/drawings/provider semantics | Existing ZTerminal-owned web/domain logic | Direct reuse where possible; verified ports or narrow bindings where platform-specific. Use independent fixtures to prove equivalence. |
| Deployed web | Existing Next.js workstation and current renderer | Preserve throughout native revision. Its later independent renderer backend has separate acceptance and migration gates. |

No new repository, WebView shell, charting dependency or research engine. Do not copy, translate, wrap or rename Lightweight Charts implementation. Audit provenance for every port; ZTerminal-owned consumers and domain logic may be reused, third-party implementation may not. Keep existing notices and investigate local/current GitHub licensing discrepancies before packaging.

### Shared contracts to connect before adding screens

- Versioned request/result envelope: request identity, workspace/document identity, expected revision, dataset/instrument identity, exact units, availability/cutoff and bounded payload. Validate before publishing a result to the UI; stale results cannot overwrite the current selection.
- `WorkspaceDocumentV2`, `ChartDocumentV3`, `DatasetManifestV3`, `StrategyRevisionV2`, `ExperimentRunV2` and one authoritative `ReplayClock`; adapters must preserve meaning rather than silently normalizing unsupported fields.
- Exact timestamps/prices/quantities remain exact at storage and domain boundaries. Floating-point projection is confined to rendering; UTC labels do not resolve named-zone/DST consumers.
- Workspace references connect dataset → chart → strategy revision → captured configuration/runtime/model → completed evidence. Captured run inputs stay immutable while the user continues editing.
- Separate presentation state from research truth: layout/window placement/selection/hover cannot mutate a dataset, source revision or archived run.
- UI capabilities come from actual service readiness. Distinguish missing prerequisites, transient unavailability and explicitly excluded roadmap features; no false “runtime ready,” “live,” “saved” or completed-report state.

## Complete screen and journey coverage

Every row includes normal, empty, loading, unavailable, error and recovery states where applicable. Persisted effects require a new-process restoration test. Read-only evidence rows must remain accurate and accessible without inventing actions.

| Figma reference | Required native result | Principal contracts / acceptance |
| --- | --- | --- |
| 14:1080 Main | Connected chart, context and strategy dock | A02/A10–A19; same dataset/source identities across panels; review composition |
| 16:1080 Studio | Editable strategy, configuration and run lifecycle | A16–A18; edit→capture→run→inspect→revise |
| 17:1080 Results | Actual overview, metrics, trades and charted evidence | A19/A31; independent expected values; undefined reasons |
| 18:1080 Preferences | Functional preference pages | A23–A27; real effects, precedence and restart |
| 19:1080 Compact | Readable compact workstation | A02/A05/A06; no clipped essential actions |
| 20:1080 Detached | Native detached group with redocking | A01/A05; close preserves unsaved documents; monitor removal |
| 21:1080 Expanded | Productive large-screen composition | A05/A06; measured split and legible content |
| 22:1080 Maximized chart | Focus chart and restore previous groups | A05/A06; unchanged document identities |
| 25:1080 Launch | Offline entry and truthful empty state | A03/A08; no account or invented live dataset required |
| 26:1080 Library | Real workspaces, strategies and archives | A03/A04; search/open/rename/duplicate/save-as |
| 27:1080 Datasets | Verified local catalog and coverage | A09; search/select/provenance/reopen retained bytes |
| 28:1080 Import | Picker, mapping, units, validation and commit | A07/A08; every declared format; cancel and bounded progress |
| 29:1080 Import rejection | Actionable issues and diagnostics export | A07/A08/A22; rejected import leaves originals/workspace intact |
| 30:1080 Configure | Dataset, period, capital, costs, sizing and model | A17; bounds/coverage validation; immutable capture |
| 31:1080 Jobs | Queue/running/cancel/retry/interrupted/completed | A18; actual worker state and bounded resources |
| 32:1080 Diagnostics | Useful failure details and recovery actions | A18/A22; no final metrics from failed/incomplete jobs |
| 33:1080 Comparison | Baseline/candidate and changed-variable evidence | A20; compatible identities or explicit incompatibility |
| 34:1080 Robustness | Seeded, documented analysis of retained inputs | A21; same seed reproducibility and actual export |
| 35:1080 Replay | Playback, step, speed, range and exit | A15; all consumers see one available prefix |
| 36:1080 Indicators | Search/add/edit/remove verified studies | A14; independent numeric fixtures and persisted parameters |
| 37:1080 Runtime/storage | Actual runtime and storage health | A26/A27; missing dependencies, repair and cleanup policy |
| 38:1080 Recovery | Draft/journal/artifact and placement recovery | A27; corrupt/newer/missing references preserved and explained |
| 39:1080 Provenance | Full source/data/config/runtime/model identities | A19/A22/A31; integrity and export verification |
| 40:1080 Instruments | Verified product discovery and source selection | A10; spot/perpetual separation; explicit connect/disconnect |
| 41:1080 Handoff | Design-review-only disposition | A30; retain reference, exclude review scenario UI from product |

Additional equity/drawdown, trade inspection, empty, material, mixed-monitor and small-logical arrangements need accepted references. Audit each menu item and keyboard command individually. The 31 action families in `v2/ACTIONS.md` remain the behavioral checklist; revise their old React/Tauri owner labels to the audited native owners without losing contracts or instance identities.

## Ordered implementation sequence

Use native product milestones P0–P7 below to distinguish them from renderer R0–R7. Each phase ends with its own reviewable result and gate; proceed only when its dependent gates pass and that phase is authorized. Visual approval is introduced early, not postponed until the engine work is finished.

| Phase | Deliverable and reviewable increments | Exit gate |
| --- | --- | --- |
| P0 — Reconcile baseline and freeze design | Preserve dirty tree/evidence; classify existing fixes; refreeze references, components, menus and scope; update native owners/reuse map and defects | Concrete screen/control/contract plan reviewed; missing references explicitly gated; actual baseline identities recorded |
| P1 — Native V2 shell and useful local slice | Build shared native components; implement main/compact composition with real workspace/dataset controls; complete R1 correctness and final-binary journey; review actual native composition | Launch→workspace→verified import/load→interaction→save→terminate→restart→restore; native input and product review pass; design status separate |
| P2 — Documents and docking | Library/search/rename/duplicate/save-as; drafts; tab groups, resize/reorder/focus/maximize/detach/redock; settings and recovery | Restart/conflict/crash/mixed-DPI/monitor removal preserve documents and layout; every shown panel action works |
| P3 — Data and complete chart workflows | Approved imports/catalog/provider metadata/history; owned scale/pane geometry; drawings, studies and shared replay; instrument/context screens | Feature matrix complete for declared native scope; numerical/temporal/native gesture/retention/provider-failure tests pass |
| P4 — Full local research loop | Real editor/search/revisions; explicit configuration; runtime discovery; supervised run/cancel/retry; immutable archive and workspace run references | Observe→investigate→code→test→save→close→reopen actual completed evidence on native installed candidate; failure/interruption checks |
| P5 — Evidence and refinement | Reports/trades/equity/drawdown/diagnostics/provenance; comparison; reproducible robustness; exports | Compare→change one declared variable→rerun→inspect; independently verified results/identities/exports |
| P6 — Native quality | Accessibility, IME, keyboard, material/motion/contrast, device/worker/storage recovery, performance and long-session fixes | Required visual/functional/numerical/recovery/performance gates pass on declared hardware; no critical/major defects |
| P7 — Local package validation | Exact dependency/version/notices manifest; local unsigned package; supported Windows install/upgrade/uninstall/data retention | Installed-binary offline journeys and migration checks pass; signing/public release remain separate |

### Renderer dependency lane

Retain R0 audit. Finish R1 correctness and useful native slice under its handoff. R2 scale/pane work and R3 feature work support P3; R4 reliability/performance supports P6; R5 is the native renderer acceptance gate. R6 independent web backend and R7 web migration follow native acceptance and explicit authorization. Preserve deployed web until its consumer matrix, precision/temporal/interaction tests and rollback gates pass. This full product plan does not execute R2–R7 or replace the web renderer.

### First concrete handoff: P0, then corrected P1

1. Inventory the current branch, index, unstaged/untracked changes and source hashes; preserve all existing work. Record the latest R1 tests and rejected product state as separate evidence.
2. Review the actual main/compact native composition against high-fidelity Figma when available, or an explicitly authorized provisional reference. Identify every missing/misplaced/wrong control, font, geometry and interaction. Prepare missing states in Penpot.
3. Freeze the P1 component map: caption/header, instrument and workspace identities, navigation, chart group/toolbars, dataset context, local workspace/library/import dialogs and status/failure feedback. Research features get genuine destinations/readiness states; later features are not claimed complete.
4. Fix P1 failures affecting that map and the R1 slice. Reproduce suspected corrupt-open UI state retention before changing it. Reconcile authoritative backend revision/status with Save and Open controls.
5. Verify held-drag Escape, focus loss, capture loss and resize using real native input. If automation cannot interrupt a held button, supply an appropriate native harness or record a concrete manual check; controller tests stay a separate category.
6. Profile the failed idle budget before optimizing. Instrument actual invalidation, frame production, waits and service polling; remove reproduced idle work without changing data/research behavior.
7. Build one final candidate, record hashes, repeat the full offline native journey on that exact identity, and review the visible product. Stop at its gate with remaining defects and a scoped P2 handoff.

## Storage, compatibility and migration

Keep a single authoritative repository. Introduce additive/versioned adapters and transactional migrations with verified backups. Test existing chart-only documents, strategy-enabled documents, older schema and unsupported newer schema. Never silently downgrade or rewrite unrecognized fields. Dry-run/report migrations before committing changes; interrupted migration must restore or leave a recoverable prior state.

Retain imported originals and normalized immutable artifacts independently of external paths. Charts and runs must reopen after the original imported file is removed. Optimistic revision conflicts, broken hashes, corrupt references, disk full, denied paths and interrupted saves must preserve the prior committed document and display a truthful failure. A success label requires durable completion, not a queued request.

Persist semantic viewport, chart/study/drawing configuration, strategy revisions, completed run references and layouts in their designated documents. Transient pointer hover and uncommitted configuration are not evidence. Recover drafts separately from saved source; opening a draft must never generate a report. Storage cleanup previews its exact effects and cannot delete referenced datasets or research evidence.

## Verification and acceptance

Maintain one row per frame/control contract/feature with **Pass / Fail / Blocked / Not Run**, build identity, exact check, expected result, actual result, evidence path and defect. A blocked visual reference cannot be converted into a pass through source similarity. Passing browser checks cannot accept Windows behavior.

| Evidence lane | Required checks |
| --- | --- |
| Design | Approved reference/style/assets; measured bounds and text; fixed-DPI native captures/diffs; native-specific exceptions reviewed; every required state |
| Mathematics/precision | Independent transform/zoom/scale fixtures; exact timestamp/price/quantity conversions; malformed/stale scene rejection; negative/zero/extreme/gapped inputs |
| Temporal | Closed-bar and next-open semantics; replay prefix across studies/readouts/research; future-data exclusion; DST consumer tests separately |
| Native input | Pointer/wheel/keyboard, axis vs plot hit areas, real capture interruption, Escape/focus/resize, tab order, dialog focus, IME and Narrator |
| Persistence | Actual new OS process; retained data without original file; conflicts, corrupt/missing references, interrupted writes/migrations, draft and window recovery |
| Research | Existing engine/model equivalence; independently expected fills/costs/sizing/metrics; captured immutable source/data/config/runtime; cancel/failure/interruption; no incomplete final metrics |
| Raster/device | Lossless chart fixtures, measured text/clipping/panes, future-data raster equivalence, device loss/recreation and mixed DPI; JPEG inspection is not a golden |
| Regression | Relevant Rust/Python/native suites; preserved web checks through browser-harness with recordings off; production data and unrelated working-tree preservation |
| Distribution | Exact installed executable/dependencies; clean supported OS; offline launch; update interruption/rollback; uninstall data policy; unsigned vs signed status |

Three mandatory end-to-end journeys:

1. **Local ownership:** launch → workspace → verified import/load → chart interaction → save → terminate → restart → exact restored data/viewport, after removing only the TEST ONLY original.
2. **Research:** same workspace → study/edit strategy → choose verified data and explicit assumptions → capture revision → run existing local engine → inspect genuine report → save → restart → verify source, inputs and evidence identities.
3. **Refinement:** select completed baseline → change one declared variable → new captured run → compare compatible evidence → seeded robustness → export → independently verify files → reopen original baseline unchanged.

Run cancellation/failure/conflict/corruption cases alongside each journey. Do not accept a happy-path recording as proof of durability or numerical correctness.

## Performance budgets and current failures

Retain R0's declared baseline and budgets; revise only with a recorded measurement and rationale. Baseline is the inspected Windows 11 i5-1335U / Intel UHD / approximately 8 GB RAM / 60-Hz display, with exact environment in `out/renderer-r1-oct14/environment.json`.

| Budget | Acceptance protocol |
| --- | --- |
| Interactive frame work | CPU+GPU p95 ≤16.7 ms at 60 Hz; report p50/p95/p99, late/dropped displayed frames |
| Displayed input latency | p95 <50 ms, separately measured from geometry and Present submission |
| CPU allocation | Projection/layout/geometry p95 ≤4 ms; backend submission p95 ≤4 ms, within overall frame budget |
| Idle | Median ≤1% of one logical core over 60 s; no unnecessary render/data-read/process-launch cycle |
| Renderer/presentation memory | Incremental ceiling 256 MiB excluding retained storage/worker; after 5-min warm-up, 30-min growth ≤10 MiB and resource counts plateau |
| Workloads | 10k/100k/1m retained, 600/2,000 visible; required studies/drawings; historical and live follow; 1,000 updates/s bounded 5-s burst |
| Repetition/contention | ≥20 meaningful cold/warm samples per workload; repeat with one captured existing research job in a separate process |

14 October measurements do **not** meet acceptance: static hidden render-and-Present per-run p95 distributions span roughly 17.4–49.1 ms across four workloads; several cold geometry distributions exceed 4 ms. A separate visible idle sample measured median 9.37% of one core, above the 1% target. Conditions were not fully controlled, and the idle cause is not established. Actual displayed latency, CPU/GPU split, 1m-input workload, sustained memory plateau and concurrent-research interaction remain Not Run. Zero reported Present failures is a useful diagnostic, not proof of 60 FPS.

## Scope decisions and risk register

| Risk / decision | Required treatment and exit |
| --- | --- |
| Product drifts into another demonstration | Review main/studio/results together against the README loop; accept real native workflows, not component counts |
| Missing originals/menu/state designs | Obtain context/exports and reviewed state contracts; dependent original-parity gates remain Blocked |
| Dirty tree and overlapping prior work | Snapshot index/diffs/untracked identities; scoped patches/commits only; no blanket staging/reset or speculative deletion |
| Wrong source/product identity | Verified spot/perpetual/provider metadata at every boundary; fail closed on unsupported contract/coverage |
| Perpetual research scope | Do not treat spot cash as futures. First-release perpetual promises require verified funding/mark/margin/maintenance/liquidation inputs and model gates; otherwise explicitly separate scope |
| Python trust boundary | Existing same-user Python is trusted code with user permissions, not a sandbox. Reuse bounded process lifecycle; verify any new isolation before claiming it |
| Precision/replay/DST defects | Preserve exact units and one clock; independent temporal fixtures; keep named-zone/DST consumer defects open |
| Revision/schema/artifact loss | Expected revisions, verified hashes, additive contracts, backup/migration/recovery tests and durable-success rules |
| Engine duplication or third-party contamination | Provenance/reuse map for ports; retain existing models; no Lightweight Charts implementation reuse or substituted engine |
| Performance regressions | Measure final candidate on declared hardware; profile before optimizing; keep failed budgets visible |
| Missing native automation | Identify unsupported gestures/device/monitor controls; build narrow harness support or concrete manual checks; never substitute browser evidence |
| Roadmap ambiguity | Calendar/AI/order flow/options/GEX/cloud/broker require explicit scope and verified data/services before enablement; disabled explanation is not completion of a promised feature |
| Packaging/license mismatch | Reconcile actual notices/license/version/dependencies before local package; public signing/release requires separate authorization |

## Current evidence and implementation pause

Current branch is `codex/auth-drawing-rebuild`, HEAD `80124f17ae500565fe4bb7a88ad44f4b693d4e02`. Extensive staged, unstaged and untracked work predates this plan; R1/source changes remain uncommitted. Planning does not reset or accept them.

14 October R1 component evidence exists under `out/renderer-r1-oct14`: native mathematical/raster checks, 24 math checks, 10 Store checks, 43 Rust regression checks, 8 cross-process checks, 204 web unit checks, typecheck/build and lint with 11 warnings. The actual native import/interact/save/remove-original/restart journey was exercised on candidate SHA-256 `DCC5D26BD44F890B459333577D30A22D405F9E4A678F89672C70F19F5DC98557`. A later instrumentation candidate has identity `CFAE00122F2D3442F1EFBB41835CF1C13F59A9B2D8F48F4E5E55990BB200B95B`; its full journey was not repeated. Preserve raw logs for exact commands and limitations. These are inherited development results, not checks newly executed by this planning task or full product acceptance.

| Gate at this handoff | Status |
| --- | --- |
| Current product/design acceptance | **Fail / incomplete** — user rejected the version |
| Original-Figma parity | **Blocked** — incomplete high-fidelity references and approval |
| R1 component correctness | Passing scoped evidence exists; does not accept product or final binary |
| Final-candidate full native journey | **Not Run** for the later instrumentation binary |
| Actual held-drag interruptions | **Not Run**; controller checks are separate |
| Performance | **Fail** for measured proxy/idle budgets; displayed-latency and broader gates **Not Run** |
| Complete native research/comparison/refinement journey | **Not Run / incomplete implementation** |
| Publication, deployment, credentials, live execution | Outside this plan; none authorized |

## Work discipline and definition of complete

Use Ponytail for coding, Penpot for required new design, browser-harness with recordings off for browser verification and native checks for Windows. Keep increments small and reviewable: components/composition, contract adapter, connected workflow, failure/recovery, then evidence. Record exact commands, failures and executable/adapter identities; keep old failed evidence. Commit only authorized scoped files after inspecting index and unrelated changes. Do not promise dates until references, defects and native integration are decomposed and sized; phase gates define the sequence now.

ZTerminal is complete for the accepted scope only when the approved V2 compositions and control states exist in the native application, the entire README research loop works with genuine data/evidence, persisted documents survive process and failure journeys, independent correctness and native quality budgets pass, and the deployed web remains preserved. No required gate may be hidden behind a screenshot, a green unit suite, an unimplemented enabled control or a changed golden.

The next executable task is **P0 baseline/design reconciliation**, followed by a separately authorized **corrected P1 native V2 slice**. Stop at each gate. Do not deploy, publish, change credentials or execute live trades.
