# Native parity implementation plan

28 October 2026. Phase 01 deliverable only. Each later phase requires its own implementation prompt. No phase below has been started by this audit.

## Order and shared prerequisites

1. Preserve the dirty native checkout and retain the hashed baseline. Correct launch/build identity before anyone accepts a diagnostic as the product.
2. Establish versioned repository/session ownership needed by Home/tabs before multiple charts. Extend the existing Store; no second workspace database.
3. Resolve the web/native document and numeric mappings before persisting new chart features. Keep the pinned web ref in `BASELINE.json`; recheck deployment when beginning implementation and record any changed behavior.
4. Implement welcome/account and Home independently of SDK availability. Finish chart/research/provider work against truthful local fixtures and supported public sources, with real vendor acceptance as a separate gate.
5. Complete native interaction/performance/package evidence later. User deferred computer-use work; backend tests do not close those gates.

## Phase 02 — startup and account

**Files:** `apps/windows-host/winui/{App.xaml.cpp,MainWindow.xaml,MainWindow.xaml.cpp,MainWindow.xaml.h,App.xaml,native_store.h}`, WinUI project/manifest and `scripts/build-winui.ps1`; `src-tauri/workstation-core/src/{lib.rs,bin/zt-native-store.rs}` for durable onboarding/preferences as needed. Correct `package.json` routing and `docs/windows/NATIVE_DESKTOP_ENTRYPOINT.md` so the chosen command produces the WinUI product. Identity scope must use the current web identity/auth modules and schema from the pinned web tree, not this old checkout's missing/newer account components blindly.

- 02A: native welcome with the two exact actions, approved logo, native caption/focus, DPI/opaque fallback; durable explicit offline completion; real Home route with empty state; returning launch goes Home. Verify first launch/offline/restart/corrupt preference recovery on isolated Windows storage.
- 02B: existing identity service → owned callback/exchange → scoped revocable device session. Implement PKCE/state, atomic short-lived code consumption and secure custody. Test callback ownership, replay, wrong verifier/state, expiry, race, cancel and account switch. Browser-open alone never marks completion.
- 02C: build and runtime identity check; preserve local work across expiry/sign-out. Local tests and real deployed sign-in get separate evidence. Do not deploy identity changes without applicable release authorization.

**Acceptance:** actual first-open screenshot, offline-to-Home and process restart; real sign-in only after exchange service availability. Test failing/slow service without blocking eligible local work. Startup budget P1 below applies provisionally; first-present must be measured, not inferred from HWND.

## Phase 03 — dashboard and tabs

**Files:** native `MainWindow.*` and shell routing; existing `Store::{list,create,load,save,validate,commit}`, `Summary`, `zt-domain::WorkspaceDocumentV2` and linked strategy artifacts. Behavior reference: web `components/workspaces/dashboard.tsx`, `lib/workspaces/{model,storage,runtime,edit-lock,backup}.ts` at the pinned ref. Do not port React/DOM into the desktop UI.

- 03A: extend existing records with real catalog timestamps/study metadata and migrations; native cards/search/sort, empty/loading/error and truthful local/account availability. Build rename/duplicate/delete safeguards with revision ownership; existing name-only save is not the complete lifecycle.
- 03B: Home stays reachable; workspace tabs own independent document/scene/editor state. Define duplicate-open, unsaved-close and restart routing. Before simultaneous chart views, replace singleton presentation ownership with minimal per-chart state; do not let a global selected workspace overwrite another tab.
- 03C: generate real previews keyed by content revisions, lazy/cache bounded; test 1/100/1,000 records and stale/corrupt/missing previews. No subscription or Python job per card. Record measurable memory/disk policy after first implementation.

**Acceptance:** actual create/search/open/Home/rename/duplicate/delete/restart sequence; two independently changed workspaces retain their contents, selected tab and unsaved handling. Compare Home composition to supplied reference 2; image labels are illustrative. P2/P5 apply.

## Phase 04 — full workspace parity

**Files:** `apps/windows-host/src/{main.cpp,native_chart_host.h,chart_math.h}`, WinUI host/input and Store/domain contracts; `crates/{zt-core,zt-storage,zt-domain,zt-protocol}`. Web semantics: `lib/chart/{contracts,drawings/*,indicators/evaluators,workspace-snapshot}.ts`, chart/document/studies/multi-chart stores, `components/terminal/{terminal-chart,drawing-interaction-layer,chart-customization,terminal-preferences,terminal-shortcuts,multi-chart-grid}.tsx`, docking controller/layout and `lib/customization.ts`.

- 04A: versioned migrations/translations for all required chart settings, panes, drawings, study definitions, replay, instrument identity and layouts. Existing Store rejects these states; fix that contract before exposing controls. Shared fixtures compare exact instants/units/ownership and unsupported import behavior.
- 04B: native bars/line/area plus candles; normal/log/percentage/inverted scales, axis margins, future space, session gaps, timezone/DST labels, volume/pane resizing. Keep forward/inverse transforms consistent for render/hit/readout/export; preserve exact originals outside raster projection.
- 04C: all 22 declared web drawing types and create/select/move/edit/style/visibility/lock/delete/undo/redo/context behavior. Inspect actual UI consumer for every declared tool; a type's presence alone is insufficient. Persist instrument/timeframe/chart ownership and coordinate space. Port owned geometry, never third-party renderer internals.
- 04D: shipped built-in and saved Python study output behavior, pane placement and settings; replay play/pause/speed/cutoff, verified strategy/mark-price layers; truthful order-flow capability gates. Do not remove incomplete rows to narrow parity.
- 04E: native docking/resizing/layout presets, chart grid and explicit crosshair/symbol linking; keep timeframe/type independent where the web does. Current web supports 1/2h/2v/3/4 grids, not eight charts as an assumed shipped layout. Add eight-chart workload support only when the approved target requires it, otherwise measure it as unavailable.
- 04F: application appearance/text size/density/reduced motion, chart/workspace styles, new-chart defaults, named chart/indicator/layout templates, restore/revert/reset, preferences import/export and custom shortcut conflict validation. Honor active editor/IME/dialog focus. The eef28dd4 customization behavior is absent in the native checkout.
- 04G: clipboard/chart capture/export, accessibility and detached windows only where approved; recover placement on monitor/DPI changes. Native caption hit regions remain correct.

**Acceptance:** pinned web/native fixtures for semantic outputs plus actual native open→navigate→draw→study→customize→layout/tab switch→save→quit→reopen. Check linked and independent charts, missing/stale data and multiple DPI values. P3/P4; current chart artifact tests are foundations, not acceptance of these additions.

## Phase 05 — local research

**Files:** existing `research/desktop/{controller,child,engine,validation,archive,local_cash,research_analysis}.py`, process limits, native strategy/Store modules and WinUI research surfaces. Reference the newer web `ResearchWorkbench`, research report/analysis and indicator evaluation contracts at pinned ref.

- 05A: real editor/configuration/dataset/run selection, UTF-8/source-byte and unsaved/saved/run revision distinction; native runtime discovery without browser pairing. Keep current cash model labelled; explicitly map newer synthetic/indicator contracts instead of relabelling results.
- 05B: background bounded job supervision, stable job/run IDs, cancellation reaching the child, failure diagnostics, stale-result rejection and worker recovery. Reuse Controller/Job Object limits; no new sandbox claim.
- 05C: immutable source/parameters/dataset/range/engine identity and durable run references from workspace to existing archive; reports/curves/trades/compare from real archived outputs. Include supported validation/holdout/walk-forward/Monte Carlo behavior from web reference or leave its rows visibly incomplete.

**Acceptance:** deterministic known output through native UI, edit/rerun/compare, cancel long run, force worker failure, restart/reopen original archived report without originals or network. Charts remain responsive under background work. Source/data/result identity and no upload verified separately. Four cash-contract tests passed this audit; strategy process harness currently fails at fixture cleanup and needs diagnosis before counting that check. P4/P5.

## Phase 06 — local connectors / Rithmic

**Files:** `crates/zt-adapters`, `zt-protocol`, `zt-core`, `zt-storage`, existing direct-public-ingest/offline-import/scene workers; native connection UI and supervisor. Add the smallest SDK-specific adapter module only after actual kit inventory.

- 06A: canonical provider/environment/instrument/tick/quantity/capability/status contracts and futures metadata; shared subscriptions, local storage, bounded update batching, recovery/gap/stale states. Extend finite Binance Spot ingestion into an actual supervised lifecycle where authorized; a finite probe is not a persistent provider service.
- 06B: obtain/inspect eligible official R|API+ kit and test credentials; resolve ABI/bitness/runtime/plugin configuration/licensing before bindings. Choose in-process versus worker using the compatibility/crash-isolation criteria in `ARCHITECTURE.md`.
- 06C: requested Pro plugin connect/disconnect, instrument/quote/trade first; then independently entitled history/depth/MBO. No trading API actions. Provider credentials remain protected on PC.
- 06D: real authorized test session, Pro absent/plugins off/wrong system/login denial/entitlement denial/Pro exit/reconnect/subscription cleanup/shutdown. Compare normalized persisted/replayed events. Fixtures and real vendor evidence are separate.

**Acceptance:** independent public/local paths can pass while Rithmic is BLOCKED. Phase 06 as a whole cannot pass without required actual vendor integration. Pro startup/login is not connector SSO. P4/P6.

## Phase 07 — measurable local-first scaling

**Files:** provider/research supervisors, Store/SegmentStore/cache/replay paths, render scheduling, native HTTP/account/release clients introduced by prior phases, any approved sync implementation.

- 07A: inventory each native origin request by trigger/purpose/payload/retry; separate provider, ZTerminal and package CDN traffic. Verify no accidental web gateway or per-event full document sync.
- 07B: measure retained buffers, inactive-view rendering/subscriptions, disk policy and background research contention; optimize demonstrated costs. One source subscription can serve multiple semantically compatible charts.
- 07C: origins-unavailable launch/Home/open/local research; optional metadata sync only if already approved, with owner isolation, queued incremental revisions and conflict preservation. No new cloud service inferred from a card label.
- 07D: repeat performance protocol below; record raw samples/distributions and illustrative traffic demand with stated user/activity assumptions. No arbitrary scalability claim.

**Acceptance:** release-build workload matrix with startup/CPU/memory/frame/backlog/disk/origin bytes, network-loss recovery and explicit missing cases. Current audit's zero TCP connections is an instantaneous observation, not proof of zero requests/bytes. P1–P6.

## Phase 08 — acceptance and reviewable package

**Files:** existing WinUI/native build scripts/project and dependency list, native packaging/release scripts after actual inventory, all parity evidence/STATUS rows.

- 08A: complete deferred native journey and error/cancel/restart/offline tests; corrupt/locked/old-schema and crash recovery preserve bytes. Actual native welcome/Home/workspace/research/customization screenshots and process/module tree.
- 08B: clean supported Windows setup without checkout/dev toolchain; complete worker/CRT/AppSDK/Python/font/license dependencies, data outside program files, callback ownership, upgrades/uninstall. Build a local reviewable artifact through native paths; don't use Tauri preview packaging.
- 08C: Windows 10/11 where supported, DPI 100/125/150/200%, text scaling, keyboard/IME/high contrast/reduced motion, monitor changes, sleep/resume, GPU device loss/fallback. Label unavailable devices NOT TESTED.
- 08D: record exact dirty-source manifest/build configuration, artifact/package SHA-256, install instructions, signing status and limits. Existing WinUI executable is NotSigned. Signing/publication/vendor redistribution remain external authorization gates.

**Acceptance:** every required parity row has actual evidence or visible FAIL/BLOCKED/NOT TESTED status. Required blocked Rithmic or missing parity prevents whole-product completion. Stop at local package unless publication is separately authorized.

## Performance protocol and provisional budgets

Current device: Windows 11 Pro build 26200 x64; i5-1335U (12 logical processors), 8,216,215,552 bytes RAM, Intel UHD driver 32.0.101.7084. Existing October 14 Release artifacts were exercised, without rebuild. See `BASELINE.json` for hashes and raw measurements.

Audit observation: 527 ms process launch→nonzero HWND, **not first-present**. First resource sample: 167,141,376-byte working set / 128,655,360 private bytes, with creation/inspection effects possible. Settled 10,022 ms sample: zero CPU time at process timer resolution, 11,567,104-byte working set / 128,610,304 private bytes, foreground visibility uncontrolled. Working-set trimming explains why private commitment and visible workload must be reported separately; none of these accepts active charts. No cold-cache run, active chart UI benchmark, origin byte trace, GPU/VRAM trace or sustained ingestion was measured.

| Budget | Evidence-informed initial target; measurement required |
|---|---|
| P1 startup | Provisional ≤2 s warm first usable Home, ≤4 s cold. A 527 ms HWND on a thin shell leaves plausible headroom but does not validate Home. Separate process/window/first-present/catalog-ready times. |
| P2 Home | Provisional search result ≤100 ms after local catalog ready at 1,000 records; usable first page ≤500 ms, lazy previews. No current native Home baseline; recalibrate after 03A before optimizing. |
| P3 render/input | Provisional 60 Hz target: active chart frame p95 ≤16.7 ms, p99 ≤33.3 ms, input→visible p95 ≤50 ms at 1/4 charts on this hardware. These are goals, not measured guarantees. Native 8-chart case is unavailable. |
| P4 ingestion/jobs | Queue must be bounded and disclose loss/backlog. Initial goal no sustained backlog growth during 30-min measured-rate replay, recover declared snapshot/gap state after reconnect; native cancel acknowledges ≤1 s and child ends ≤5 s. Rates come from actual eligible source observations, not invented feed speed. |
| P5 resources/storage | Initial empty/Home private commitment ceiling 256 MiB and steady idle ≤1% total-machine CPU, based on current ~123 MiB private commitment and quiet sample; active charts/research get separate empirical limits. Measure VRAM and per-chart deltas before setting active memory limits. Source bounds: import 8 MiB/100k bars, source 256k bytes, params 16,384 bytes; no unbounded preview cache. |
| P6 origins | Market-data/research payload bytes to ZTerminal origins must be zero by architecture. Account/entitlement/release/explicit sync request and byte budgets must follow actual validity/trigger rules; no numerical control-plane budget is validated yet. |

For each build/workload, record exact artifact hash, flags, Windows/hardware/driver/DPI, power state/visibility, provider and dataset identity, retained/visible bars, active/hidden charts and research config. Avoid private data in shared logs.

1. Cold launch: first launch after reboot, caches not manually flushed; at least 5 samples across restarts when feasible. Warm: 10 launches of same build/data. Report median/p95 and all raw times; do not label a new process cold automatically.
2. Home: 1/100/1,000 real-schema isolated records; 1/4/8 chart cases where supported, 10k and 100k retained bars with explicit visible spans. Native 4/8 charts, Home and loaded UI are currently unavailable/deferred; existing C++ single-chart tests are not substitutes.
3. Replay/live: deterministic normalized event trace with documented rate and 2× replay stress; 30 minutes steady, then outage/gap/reconnect, provider exit, sleep/resume. Count produced/consumed/dropped events and queue high water, observed freshness/recovery. Never fabricate missing live data.
4. Research: same charts plus deterministic small and long jobs; record CPU/private memory/frame distribution/input latency, cancel cleanup, immutable output IDs and disk growth.
5. Origin loss: block only task-owned client requests via a test configuration or isolated test environment; do not change user's global firewall. Trace DNS/TCP/HTTP at the native process and supervised children, classify ZTerminal/provider/CDN, redact auth. Count requests and payload bytes over complete sessions. Instantaneous `Get-NetTCPConnection` cannot measure traffic.
6. Storage/endurance: measure data, SQLite WAL, archive, preview and log byte deltas, retention limits and failed-write recovery. Include process/module lifetime and worker cleanup, not just a quiet dashboard.

## External gates separate from local work

- **SDK/account:** eligible R|API+ kit, exact runtime/ABI/plugin docs, authorized test account and entitlements; conformance and redistribution evidence.
- **Identity service/release:** native exchange/session service implementation and applicable deployment authorization; live sign-in verification distinct from tests.
- **Signing/distribution:** real signing credentials, redistributable/license inventory and clean-machine test environment.
- **Deferred device evidence:** computer use, first-open/Home/full chart/research/restart journeys, additional Windows/GPU/DPI/monitor configurations. The user explicitly allowed these later; continue independent authorized code only when its phase arrives.

Next implementation action, only on receipt of Phase 02: revalidate baseline and product build command, implement native welcome/offline→Home routing and the minimum durable onboarding state; develop the bounded identity exchange in the same phase while keeping service-dependent acceptance explicit.
