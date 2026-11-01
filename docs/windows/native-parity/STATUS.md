# Windows native parity status

Updated 1 November 2026, Asia/Baku. **Phase 04 Store/scene/math parity slice and Strategy Process Harness fix verified headless; overall native parity remains PARTIAL.**

The user explicitly authorized automatic continuation through phases 03–08 while away, including autonomous verification. This supersedes the phase prompts' default stop-between-phases instruction. Native UI verification previously resumed in isolated storage. The user subsequently explicitly prohibited computer use: no further desktop input, window switching or screen capture. Continue source/build/headless tests and leave UI/device checks unverified. Live account deployment, vendor SDK/account eligibility and additional device/signing gates remain separate.

See [PHASE-02.md](PHASE-02.md) for changes, security tests, native welcome/keyboard/offline/Home/restart evidence and remaining live-auth gates. The default desktop commands now build WinUI; the older entrypoint and absent-account findings below are the preserved Phase 01 baseline, not claims about the updated source.

Phase 01 was documentation only. Phase 02 modifies the necessary native startup/account, Store and bounded server identity scope; no public deployment, signing or trade occurred.

## Paused checkpoint — resume here

The user said “stop for now to continue later.” Do not automatically continue, create reminders, or restart UI work. Computer use remains explicitly prohibited. Earlier automatic phase-continuation authorization can be used when the user asks to resume, subject to that prohibition.

Phase 04's first source slice now builds: versioned chart presentation in the canonical artifact store; workspace-scoped CAS apply/reset; transient preview/cancel source path; candles/OHLC bars/line/area; colors, grid, price line, crosshair, wick/border and volume controls; normal/log/percentage/inverted transforms; future space without invented observations. Non-positive log ranges and zero percentage bases are explicitly withheld. Settings preserve dataset/source identity. Confirmed Store writes are retained if a later chart projection/read fails.

Verification: 19 Rust `workstation-core` tests + 5 `zt-domain` tests; 36 chart-math assertions + 4 CTest targets (`native-account`, `chart-math`, `execution-vault-current-user`, `native-chart-boundary`); all 5 packaged Python process harnesses (`native_strategy_process_test.py`, `native_store_process_test.py`, `native_catalog_process_test.py`, `native_chart_settings_process_test.py`, `native_startup_process_test.py`); headless Direct3D renderer checks with no failures. Phase 04 Store/scene/math now includes all 22 web drawing types (`DrawingObject`), CAS `save_drawings`/`save_indicators`/`save_replay`, causal `sma`/`ema`/`rsi` evaluation in `native_scene`, and replay-cutoff filtering for bars, indicators, and drawing anchors. `native_strategy_process_test.py` `WinError 145` was root-caused to Windows `MAX_PATH` (`265` chars for `.meta` files under deep evidence paths) and fixed by keeping temporary store directories in short system temp while writing `results.json` to the evidence path. Headless renderer artifacts are generated texture readbacks, not desktop screen captures or UI acceptance. Final custom WinUI tab/dialog templates and settings interactions remain NOT TESTED.

Latest Phase 04 candidate: `C:\Users\aykhank\.codex\visualizations\2026\10\28\01a18282-2502-7322-b414-bc1194578ca4\phase04\product\Release\ZTerminal.exe`. Evidence and hashes: `phase04/checkpoint.json`, `build.txt`, `store-tests.txt`, `chart-build.txt`, `renderer-tests.txt`, `settings-process/results.json`, `offscreen-renders/`. Phase 03 candidates are historical and are described separately in PHASE-03.md.

On resume: review this first chart slice and remaining parity rows; continue Phase 04 drawing/indicator/replay/timeframe and explicit web/native document adapters, independent multi-chart contexts/linking/layouts, full customization/shortcuts/import/export. Do not declare Phase 04 complete from this candle/settings slice. Phases 05–08 have not been implemented in this continuation. Real identity deployment, Rithmic SDK/account eligibility, signing/clean-device and UI/device checks remain gated. Preserve dirty/staged work; no deployment, vendor contact or trading is authorized.

## Current Phase 03 work

See [PHASE-03.md](PHASE-03.md). Real paged catalogs, Unicode search/activity sorting, previews, source editing, lifecycle/recovery and persistent tabs are implemented. 16 Rust tests and packaged-adapter checks pass, including 1,000 metadata records. Earlier native journeys cover create/search/open/Home/rename/duplicate/restart and protected viewport saving. The user-directed visual correction builds in `phase03/brand-review-final/Release`; its final custom tab/dialog templates are not interactively verified. Phase 04 chart parity remains outstanding; proceed without computer use.

## Start here

- [BASELINE.json](BASELINE.json): initial checkout state, dirty-file hashes, native executable identities, measured workload, reference commit, runtime limits and source fingerprints.
- [WEB_NATIVE_PARITY.csv](WEB_NATIVE_PARITY.csv): 134 observable behavior rows. Full-file source references are keyed to either the pinned web commit or the hashed dirty native working tree; see baseline source fingerprints. Source inspection is explicitly separated from live verification.
- [ARCHITECTURE.md](ARCHITECTURE.md): active/diagnostic/compatibility paths, schema/store/IPC ownership, identity gaps and Rithmic gates.
- [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md): phases 02–08 mapped to current files, dependencies, acceptance cases and a representative performance protocol.
- [DESIGN.md](DESIGN.md): scoped factual design inventory and latest-image reconciliation. It does not declare a new global design authority or implement UI.

## Findings in risk order

1. **Persistence cannot represent parity yet.** Web workspace v3/chart v5 is substantially richer than native WorkspaceDocumentV2/ChartDocumentV3. Native `Store::validate` rejects indicators, drawings, replay, presentation and non-primary charts. Extend the existing canonical model and real validator/migrations before exposing those features. Do not create another store or silently discard unsupported fields.
2. **Multiple tabs/charts would share one renderer.** Existing C++ global scene/view/renderer and one WinUI `workspace` member need explicit per-chart/session ownership. A new TabView alone is unsafe for independent workspaces.
3. **Native identity is a design, not a service.** Native welcome/offline completion/Home/device exchange/token rotation/revocation are absent. The real web identity exists; native scoped exchange endpoints and callback custody must be implemented and verified separately. Account/provider credentials remain separate.
4. **Rithmic is externally gated.** Official current plugin guidance confirms the requested Pro route, but an eligible R|API+ kit, ABI/runtime/plugin examples, authorized test account, entitlements, conformance and redistribution terms were not supplied/located. Web R|Protocol placeholder code is not a local Pro plugin connector. No Rithmic connection occurred.
5. **Research backend is ahead of native UI.** Native strategy source persistence and exact CSV/cash conversion exist; Run/Cancel/report selection are explicit placeholders. Newer web synthetic research/indicator/analysis contracts need deliberate native mapping and real archive links.
6. **Entrypoint docs/commands disagree.** `desktop:dev/build` invoke Tauri; `desktop:native:*` build the Win32 diagnostic. Actual WinUI product is built through `apps/windows-host/scripts/build-winui.ps1`. Older entrypoint statements cannot guide acceptance safely.
7. **Native customization is not connected.** `ShowSettings` creates material/motion controls without apply/persistence handlers. Current web customization includes scoped styles, new-chart defaults, named templates, session revert, preference import/export and shortcut validation absent from this native checkout.

## Source and deployed reference

- Native checkout: `codex/auth-drawing-rebuild` / `80124f17ae500565fe4bb7a88ad44f4b693d4e02`, with **381 pre-existing changed/untracked files** (25 staged paths, 216 unstaged paths; counts can overlap). No reset, stash, blanket staging, branch switch or old clean checkout was used.
- Baseline collector correction: its first porcelain record initially lost a leading status space. That record was corrected only after exact original staged/unstaged diff hashes matched; the uncorrected manifest is retained as `initial-state-original.json`. No tracked source bytes changed during this correction.
- Web: freshly fetched `main` = `eef28dd4c0d4353b94d2afbbff6b252bfa5e4243`; [production run 40677788639](https://github.com/zephyriaa/zterminal/actions/runs/40677788639) has a successful Cloudflare deployment job. It was inspected via GitHub and extracted outside the native tree. Running Worker hash was not attested. CI success is not a native or live-feature acceptance result; the workflow also contains a non-fatal Python test command.
- Browser: reached live Workspaces dashboard and creation form. Existing saved records were visible; no web workspace was created, renamed, deleted or submitted. Chart/drawing/preferences/research/docking/shortcut journeys were inspected in pinned source only.
- Native artifact: `out/windows-app/Release/ZTerminal.exe`, SHA-256 `cfae00122f2d3442f1efbb41835cf1c13f59a9b2d8f48f4e5e55990bb200b95b`, 953,344 bytes, October 14 build, **NotSigned**. Packaged Store adapter SHA-256 `3fc393c6d620207633a7f2245055b5d232ce3f4ce616de327fabb752fe5dcd1b`. No rebuild proves correspondence to all dirty source bytes.

## Checks performed

| Scope | Result | Evidence / limitation |
|---|---|---|
| Initial preservation baseline | PASS | External `initial-state.json` records staged/unstaged diff hashes and 381 dirty path hashes before audit edits. Final preservation verification is in `evidence/audit-validation.json`. |
| Native actual empty window | PASS, narrowly | Correct executable path/PID/window; native-empty PNG and accessibility tree outside source. Truthful LOCAL DATA UNAVAILABLE, native chart surface and disconnected research messages. Not welcome/Home or loaded-chart acceptance. |
| Native create action | PARTIAL | Audit-only isolated store contains `Phase 01 audit fixture`, revision 1 after the UI click. Physical Escape stopped computer use before follow-up observation. No UI open/import/save/restart acceptance claimed. |
| Native chart math artifact | PASS | [chart-math.log](evidence/chart-math.txt): exact units, inverse/geometry, negative/zero values, timestamp/cutoff and malformed scene checks. Existing executable, not fresh-source build. |
| Native D3D chart artifact | PASS | [native-chart.log](evidence/native-chart.txt): composition/raster/navigation/cutoff/gap checks. Diagnostic fixture evidence, not full product interaction. |
| Store process artifact | PASS | [store-process.log](evidence/store-process.txt): eight separate-process persistence, retained-source, viewport, cutoff, stale/conflicting/interrupted-save and corruption checks. |
| Strategy process harness | PASS | Fixed on 1 November 2026: root cause of historical [first attempt](evidence/strategy-process.txt) / [retry](evidence/strategy-process-retry.txt) `WinError 145` was Windows `MAX_PATH` (`265` chars for `<store>\<64-char-sha256>\metadata\*.meta` when `TemporaryDirectory` was nested inside a deep evidence path). Using system temp for the transient store directory resolves cleanup and emits `status: Pass` (`adapterSha256: 325a66d60625423c04041302b08a4a9472a7917b174b11c1bf731cf1d9222f5d`). |
| Local cash contract | PASS | [local-cash.log](evidence/local-cash.txt): four current-source Python tests on installed embedded runtime, including independent next-open accounting and exact revision/range/precision rejection. Native Run UI remains absent. |
| No web-wrapper boundary | PARTIAL | Sampled native module list includes WinUI/D3D11/D2D/DirectWrite and no WebView/chrome/electron/msedge module name match. This is one process snapshot, not exhaustive package/worker/startup-path proof. `Windows.Web.dll` alone is not a browser renderer. |
| Performance | PARTIAL | 527 ms process→HWND; one settled 10-second empty-dataset sample. See plan for hardware, private/working-set values and caveats. No Home/multi-chart/live replay/concurrent research or full origin-byte benchmark. |
| Rithmic integration | BLOCKED | No eligible kit/account entitlement verification or vendor session. Official source links and exact gates in architecture. |
| UI and device acceptance after Escape | NOT TESTED / deferred | User: “computer use requiring tasks can be done later.” No subsequent desktop/browser input was used. |
| Clean-machine package/signing/publication | NOT TESTED | No package created or published; existing WinUI executable is unsigned. |

The matrix currently has 1 PASS, 25 PARTIAL, 97 FAIL, 4 BLOCKED and 7 NOT TESTED rows. FAIL means the requested target behavior is missing in inspected native source, not necessarily a failing automated test. These unequal rows are **not a feature-completion percentage**. The strategy harness failure is separately identified above.

Audit-only validation passed: all 381 original dirty path contents, original staged/unstaged diff hashes, branch/HEAD, 86 source fingerprints, matrix structure and local document links were checked. A repository-wide `git diff --check` also reported pre-existing whitespace/line-ending findings in untouched files; these were not changed. The audit Markdown whitespace check passed.

## Decisions

- Preserve and extend the actual native WinUI/C++ renderer/Rust Store path; use Tauri only as historical/compatibility evidence.
- Keep low-frequency Store sidecars where adequate. Provider and frame events require long-lived local processing and batching, never a new process/full-document write per event.
- Keep one workspace authority, one market segment pipeline and linked immutable research artifacts. Use explicit versioned translation where contracts differ.
- Latest welcome/Home references supersede older visual composition requirements. Do not block independent work on old Figma access. Keep graphite/violet identity and approved Logo Kit v1 geometry.
- Web workspace tabs are browser-level isolation; native target requires independent in-app tabs with Home. Record this deliberate platform difference.
- Current web dashboard has real workspace summaries, not the illustration's separate studies gallery, thumbnails or community service. Do not fabricate cards/cloud badges/GEX.
- Default native data path remains local; no provider credentials/data through ZTerminal servers. Initial connector scope is market data only; no trades.

## Unfinished evidence and next actions

1. **Phase 02 has been implemented locally; Phase 03 is authorized next.** The user authorized automatic progression through phases 03–08. The following original Phase 01 next-action text is historical: Recheck baseline/HEAD/web reference and implement product command identity, native welcome/offline completion and real Home routing, then the bounded native account exchange. Do not start implementation from this plan alone.
2. In Phase 03/04, make canonical Store migrations and per-chart ownership explicit before tabs, drawings/studies/layout/customization.
3. Diagnose the strategy harness cleanup failure in its authorized test/fix scope. It repeats despite explicit SQLite connection closure in current source; do not assume the old open-connection diagnosis is still correct.
4. Obtain eligible SDK/API+ plugin docs/account/terms before SDK-dependent Phase 06 code. Independent supported public/local work need not wait for it when authorized.
5. Resume deferred UI checks when desktop interaction is wanted: loaded-chart import/navigation/save/restart, actual strategy editor/errors, web chart/customization/drawing/docking behavior, then welcome/Home/full research after implementation. Browser recordings remain off.

## Local evidence locations

Primary external evidence root:

`C:\Users\aykhank\.codex\visualizations\2026\10\28\01a18282-2502-7322-b414-bc1194578ca4\native-parity-audit`

It retains initial-state, pinned web-source archive extraction, deploy jobs/runs, native artifact identities, launch/hardware/module/resource snapshots, empty native screenshot/AX, web dashboard screenshot, isolated audit Store and test logs. Account-bearing web screenshot stays outside source. No credential values/private datasets were copied into these audit documents.

The audit-owned native window was left for later inspection, with only isolated `native-empty-store` state; the user's default native storage was not selected. The browser task tab was left on the creation form without submission. No later computer-use interaction or cleanup was attempted after the user's interruption.
