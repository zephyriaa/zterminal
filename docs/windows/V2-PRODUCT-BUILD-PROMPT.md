# ZTerminal Windows — V2 product plan and master prompt

Prepared 11 October 2026. This is a future implementation brief, not authorization to deploy, publish, sign, execute trades, or modify production secrets.

## How to use this brief

Give the coding agent access to the complete repository and this file. Supply the original V2 frame exports, not compressed chat previews, and the Figma link. Start with the master prompt below and milestone 0 only. Then dispatch milestones in order using the continuation prompt. Keep one implementation chat and an up-to-date repository handoff. A fresh agent must read the handoff, current diff, tests and accepted design baseline before coding.

Do not reward claimed completion: inspect the working Windows executable and the parity/behavior evidence at each gate. In a reference review, say precisely which control, state or measurement is wrong; that becomes a tracked defect. A text response, screenshot, web preview, or successful build alone does not establish a complete desktop product.

## Master prompt

You are the principal Windows desktop, Rust, TypeScript, product UI and verification engineer for ZTerminal, repository `zephyriaa/zterminal`, located at `C:/Users/aykhank/Desktop/Others/Projects/ZT`.

Your goal is a complete, locally installed Windows research workstation matching the accepted **V2 Design Revision** at its reference sizes, with every in-scope visible control connected to real, tested behavior. Preserve ZTerminal's local-first ownership, reproducible research, honest data availability, security and deployed web behavior. Continue the existing tested desktop foundation instead of creating another competing application.

Treat pixel parity, behavioral completeness, data correctness and Windows reliability as separate acceptance gates. The goal is complete only when all pass. Work on the milestone requested in the current message; report its evidence and stop at the milestone boundary. Do not silently expand scope or claim that one passing gate proves the others.

### 1. Inspect the current repository and accepted references

Read repository AGENTS.md and applicable skills. Before Next.js changes, read the relevant installed guides under `node_modules/next/dist/docs/`. Record the current branch, working-tree baseline, existing commits, running services and test results. Preserve unrelated user work.

Read:

- `docs/windows/PHASE1-CONSOLIDATION.md`
- `docs/windows/WORKSTATION-VALIDATION.md`
- `docs/ADR-0004-institutional-research-workspace.md`
- `artifacts/figma-rebuild/revision-v2/HANDOFF.md`
- `artifacts/figma-rebuild/revision-v2/INTERACTION-CONTRACT.md`
- `artifacts/figma-rebuild/revision-v2/journey-capture-state.json`
- `artifacts/figma-rebuild/revision-v2/native-design-tokens.json`
- the source compositions, saved previews and subsequent design-status notes in that directory.

Figma file: `https://www.figma.com/design/VtIJq6WBPRJUUKtc4XvnxE`.

Core frames: main workstation 14:1080; focused research 16:1080; evidence 17:1080; preferences 18:1080; compact 19:1080; detached 20:1080; expanded 21:1080; maximized chart 22:1080.

Journey frames: launch 25:1080; library 26:1080; datasets 27:1080; import 28:1080; import rejection 29:1080; configuration 30:1080; jobs 31:1080; job diagnostics 32:1080; comparison 33:1080; robustness 34:1080; replay 35:1080; indicators 36:1080; runtime/storage 37:1080; recovery 38:1080; provenance 39:1080; instruments 40:1080; handoff 41:1080.

The saved handoff records that comparison frame 33:1080 contains the wrong diagnostics composition. It also records unreviewed captures and incomplete component/prototype work. Recheck present access and current contents. Do not treat old quota reports as current facts or use the defective frame as the implementation target. Use the correct saved comparison source to prepare a reviewed correction.

Freeze an accepted reference manifest with frame IDs, dimensions, exports, hashes, fonts, tokens, interactions, review status and approved exceptions. Resolve conflicting references explicitly: current accepted V2 frames take priority over the earlier 35-screen draft; use source-derived corrections only after review. New or missing design work belongs in Penpot at `https://design.penpot.app/`; preserve Figma as the existing reference. Do not create, migrate, edit or share design files beyond the current authorization. Present missing-state designs for review before freezing them. Do not let a Figma quota prevent unrelated backend work, but never call unreviewed visual work 1:1.

### 2. Preserve the selected architecture and define ownership

Continue locally bundled Tauri 2 + React, existing Rust domain/data/storage foundations, and the existing local Python research service through a tested desktop broker. The native Win32/Direct3D/WinUI renderer remains a separate research track. An architectural switch requires a written migration proposal and measured product-level evidence.

Bundle all application UI, fonts, icons and required runtime assets. Installed rendering, local chart inspection, saved documents and archived evidence must work without a hosted website or account. Network access is explicit and provider-specific; the app remains useful offline.

Rust owns validation, repositories, migrations, dataset identity, provider state, command authorization and credential references. React owns presentation and transient interaction state. A supervised Python worker owns only a captured research job. Keep presentation layout separate from research and dataset documents.

Adopt the existing versioned contracts: WorkspaceDocumentV2, ChartDocumentV3, DatasetManifestV3, StrategyRevisionV2, ExperimentRunV2 and ReplayClock. TypeScript/Python bindings are projections of these contracts. Provide explicit compatibility converters for existing web payloads; do not silently reinterpret them. First resolve the existing uncommitted `zt-domain` and workspace-manifest prerequisite through review and a coherent dependency commit. Do not include unrelated user edits.

Keep the Next.js product's routes, authentication, providers, storage ownership and deployment behavior intact. Extract shared components and semantics through platform adapters, without mounting server/account effects in the offline desktop shell.

### 3. Match V2 in every presentation detail

Measure the accepted frame and source geometry. Match hierarchy, alignment, spacing, panel proportions, typography, icons, strokes, radii, borders, shadows, glass tint/blur, separators, chart styling, tables, dialogs and every displayed control state. Do not substitute a generic dashboard, approximate visual theme, different font, emoji icon or full-screen image.

V2 baseline tokens, subject to verification against the accepted reference:

- Workspace #090A10; panels #14111D; plot #0B0A10; selection #B5A2E8; text #F0EFF5; muted #A8A2B5; market-up #34D399; market-down #FB7185.
- Geist interface typography and Geist Mono for code/numbers, using the real bundled weights and styles.
- 4 DIP spacing grid; prepared radii: controls 8 DIP, panels 12 DIP, dialogs 16 DIP; 2 DIP focus outline and offset.
- Expanded navigation 194 DIP; collapsed rail 42 DIP. The default chart occupies approximately 70% of the dock; context is upper-right, with Python/report tabs below. Measure exact split positions per frame instead of hard-coding every screen to one ratio.
- Glass is restricted to functional chrome, navigation, controls and dialogs. Chart, source, tables and evidence remain stable reading surfaces. Implement rich, reduced and opaque effects plus reduced motion. Functional transitions follow the accepted 120–200ms range.

Keep native Windows caption controls, snap, maximize/restore, taskbar behavior and keyboard conventions. Declare the reference Windows version, DPI, font files and capture method. Account for native frame differences explicitly; do not paint fake OS controls to hide discrepancies.

Verify logical 1366×768, 1440×900, 1920×1080 and detached 1024×680 arrangements. Test 100%, 150% and 200% scaling, including approximately 911×512 and 683×384 logical laptop work areas. Restore placements safely after monitor removal. Compact layouts use rail navigation, active dock tabs and inspectors; keep text readable and permit internal scrolling. Do not equate physical resolution with logical viewport size.

For fixed reference conditions, geometry and design tokens must match the accepted source; remaining visual differences require explicit review. Compare frame exports to actual application captures using overlays and diff images. Mask only specified dynamic data, timestamps, blinking cursors and approved OS-dependent regions. Never mask a misaligned panel, wrong button, missing state or typography difference. Test hover, focus, pressed, selected, disabled, loading, empty, error and recovery states. Dynamic prices and research values must come from actual inputs; design-example numbers are not runtime data.

### 4. Give every visible control a real contract

Create a control inventory before implementation. Every button, menu item, tab, icon, field, slider, shortcut, table action and gesture must record: reference location, accessible name, preconditions, command/service owner, state transition, persistence effect, success/failure behavior and acceptance test. Include controls that appear interactive but are currently static spans in the design source. Verify menus and their items, not just the button opening them.

Required journeys and behavior:

1. First launch, new/open/rename/duplicate/save workspace, recent/local library search and filters, recovered drafts and restart restoration. No account is required for local work.
2. Dock resize/reorder/tab selection, focus/maximize/restore, detach/redock/close, keyboard navigation, layouts and presets. Closing a presentation must not destroy its document or unsaved draft. Reset layout must preserve data.
3. Strict local import, original-file preservation, diagnostics, rejected-candidate review, coverage/source/hash inspection, dataset catalog search, selection and reopen. Support every approved selectable format; remove or obtain approval to change unsupported advertised formats rather than silently treating them as CSV. Preserve exact instrument/product/timezone/interval/units semantics.
4. Explicit public provider connection/disconnection, acknowledged subscription, historical retrieval/pagination/cancellation, rate limits and recovery. Support verified Binance Spot and USDT-perpetual identities needed by the accepted flows. Expose cached, stale, gap and unavailable states truthfully. Never synthesize missing bars or substitute another provider silently.
5. Chart instrument/timeframe selection, pan/zoom/crosshair/fit, timezone, chart options, supported drawing toolbar actions, drawing edit/delete/lock/visibility/undo/redo, indicator search/apply/edit/remove and volume panes. Persist semantic anchors and configuration with correct document ownership. Implement every tool shown in the accepted drawing/study inventory; no icon may simply open an informational placeholder.
6. Replay play/pause/step/speed/range/stop with one ReplayClock shared by chart, indicators and research. Future data must be unavailable across all these views until its replay boundary.
7. Python editor open/save/revisions, drafts, syntax highlighting, search, diagnostics, parameter/dataset/cost configuration, shortcut and Run locally. Capture immutable source, parameters, dataset, runtime and engine identity before queuing. Correctly support queued, running, cancelled, failed, interrupted and completed states with cancellation, bounded resources and restart recovery.
8. Reports with real equity/drawdown, metrics and undefined-metric explanations, trades, diagnostics, assumptions and complete provenance. Open a report only for an archived completed run; opening a draft opens source. Include comparison of compatible runs and explicit incompatibility handling.
9. Robustness uses documented, seeded resampling of closed-trade account returns with replacement. Export actual referenced evidence and diagnostics; imports/exports need real user-selected filesystem operations and visible failure handling.
10. All preferences pages shown in V2: appearance, material mode, reduced motion, density, chart grid/timezone, workspace, shortcuts, runtime and local storage. Changes must have the advertised effect and survive restart. Search and utility actions must route to real supported operations.

For spot research, preserve correct cash/fee/slippage and next-open execution semantics. For leveraged perpetual simulation, use a separately versioned isolated-margin model with long/short P&L, leverage/quantity limits, collateral, funding, mark prices, maintenance tiers, fees and liquidation. Missing required mark/funding coverage blocks the run. Explicit assumption models require selection and provenance; present-day rules are not historical facts. Do not relabel simulation as broker execution or silently alter legacy archived results. Prefix consistency checks may detect some lookahead; they do not prove arbitrary Python causal.

Unavailable runtime states may disable a control when its documented prerequisites are unmet, with a reason and recovery path. That is a functioning state, not permission to leave an in-scope feature permanently unimplemented. V2 contains planned/calendar/provider states: distinguish intentionally planned disabled entries from promised first-release capabilities in the accepted inventory. Resolve any scope/design contradiction before claiming completeness. AI, advanced order flow, options/GEX, cloud sync and broker execution remain separate roadmap items unless explicitly added to this scope. No fake success, synchronization, balances, depth, reports or progress.

### 5. Security, durability and correctness

Use narrowly authorized, bounded, versioned IPC with request/document identities, revisions, structured errors and cancellation. No arbitrary renderer-supplied filesystem paths or process execution. Reopen, verify references and handle corrupt/missing artifacts with an actionable error. Use atomic/transactional saves, optimistic revision checks, explicit migrations preserving originals, recovery and disk/quota policies. Distinguish unsaved, durably saved and archived states.

Never expose credentials to React or untrusted Python. Public-market workflows need no trading keys. Any future credential feature requires an isolated broker and tested access boundaries. Environment scrubbing and memory/time limits do not sandbox an arbitrary same-user Python process; prove the chosen filesystem/network/credential isolation before relying on it. Stage bounded job inputs, validate outputs and redact sensitive diagnostics.

No untested live trade execution. No automatic strategy execution on open, live orders, deployment, release publication, signing-credential changes, production-secret changes or external sharing. Prepare local unsigned packages and reviewable release evidence; public release actions require separate authorization.

### 6. Required implementation sequence and exit gates

| Milestone | Work | Required exit evidence |
| --- | --- | --- |
| 0 — Baseline | Verify current slice; reconcile domain prerequisite; freeze reviewed V2 references, exceptions and full control inventory | Clean-checkout build/test baseline, dependency/migration/risk documents, approved reference manifest, action-to-test map; unresolved designs explicitly identified |
| 1 — V2 shell | Exact typography/materials/chrome, navigation, reusable controls, main/compact/expanded/focused compositions and initial preferences | Actual Windows screenshot diffs and control-state checks; existing import/save/restart slice remains functional; no fake data added for visual presentation |
| 2 — Documents and docking | Full local libraries, drafts, layouts, presets, detached windows and recovery | Restart/crash/monitor-removal tests preserving documents, settings, drafts and placements; no cross-workspace leakage |
| 3 — Data and charts | Import/catalog, verified public data, instrument metadata, full accepted chart/drawing/study actions and replay | Coverage/precision/source/indicator/replay tests; recorded provider failure paths; offline inspection; screenshot/interaction parity |
| 4 — Research | Real editor/configuration, immutable revisions, supervised jobs and supported spot/perpetual simulation | End-to-end edit/configure/run/cancel/restart/report, numerical fixtures, resource and isolation checks, failed jobs never publish completed results |
| 5 — Evidence | Detailed reports/trades/provenance/comparison/robustness/export and remaining utility/preferences actions | Every approved control covered by a meaningful test; reproduce archived results from captured inputs; reviewed visual parity for every report/state |
| 6 — Windows quality | Keyboard/Narrator/IME/contrast, multi-DPI/monitor recovery, disk/service failures, long-session and concurrent-work performance | Complete visual/functional matrix; critical/major defects resolved; measured cold/warm startup, frame/input latency, memory and resource distributions on declared hardware |
| 7 — Distribution | Self-contained dependencies, WebView2 installation policy, unsigned package, upgrade/uninstall/data retention/update validation | Clean Windows 10/11 install/offline/upgrade/recovery evidence, notices/SBOM and release checklist; signing and publication remain separately authorized |

Use reviewable, test-backed commits. Prefer existing code, standard libraries, native controls and installed dependencies. Apply Ponytail to coding; it must not remove required details, validation or functionality. Use browser-harness for browser/WebView verification, preserving the user's recording-off preference. Use native Windows verification for OS-level behavior. Follow applicable Figma/Penpot/tool skills before their operations.

Maintain durable scope, reference, action, parity, test, risk and defect records under `docs/windows/v2/`. Keep these records useful and concise; do not create paperwork or parallel state systems without a concrete purpose. Preserve canonical types and proven paths. A broad rewrite needs an explicit replacement/migration plan.

Suggested performance goals, measured on a declared hardware tier: cold startup under 2s, warm startup under 1s and responsive 60 FPS chart interaction using bounded visible geometry while research runs separately. Confirm budgets at milestone 0; report distributions and environment, not one favorable observation. Long-history tests cover 10k/100k/1m input sizes without rendering all retained bars or weakening integrity/coverage checks. Separate debug smoke timings from release product performance.

### 7. Completion and reporting

Run the relevant unit/contract/integration checks, actual Windows journeys, visual comparisons, offline/restart/crash scenarios, installer/upgrade checks and web regression gates. Test fresh installation and restored/migrated data independently. Do not call the product complete while an accepted screen, active control, failure path or required check is missing.

At every milestone report: commit(s); implemented screens/actions; executable location; exact checks and results; reference-size screenshots/diffs; remaining mismatches; failures/blockers; preserved web behavior; and the next independently testable milestone. Keep a restart handoff so a new agent can continue from evidence. Pass/fail/blocked/not-run are distinct states. Work through routine authorized fixes without repeatedly asking for permission; design/scope changes and release authority require concrete review.

Begin with milestone 0 only. Audit first, create the reference/control/test plan and reviewable baseline, then report its gate. Do not begin later milestone implementation in this first dispatch.

## Continuation prompt — send after reviewing the prior milestone

Continue the ZTerminal Windows V2 goal under `docs/windows/V2-PRODUCT-BUILD-PROMPT.md`. Implement milestone [NUMBER — NAME] only. Read the current handoff, accepted references, defect/action inventories, commits and working-tree changes before editing. Resolve predecessor gate failures that affect this milestone. Preserve existing tested functionality and deployed web behavior. Match the accepted V2 frames and control states, wire real behavior, run the milestone's Windows/visual/data/security/regression checks and commit reviewable increments. Finish with evidence and remaining defects. Stop at this milestone's gate; do not deploy, publish, change secrets or proceed to the next milestone automatically.

## Final acceptance prompt — use an independent review chat when useful

Review the actual installed ZTerminal Windows application against `docs/windows/V2-PRODUCT-BUILD-PROMPT.md`, the frozen accepted V2 reference manifest and the complete control inventory. Treat prior completion claims as unverified. Check every accepted screen and control state, real data/research flows, persistence, offline/restart/crash recovery, accessibility, DPI/monitor behavior, worker isolation, installation/upgrade/uninstall, performance and preserved web behavior. Inspect reproducible test and screenshot-diff evidence, then independently exercise the critical journeys. Do not deploy or publish. Return a prioritized defect list with reproduction steps and references, plus a gate matrix marking PASS, FAIL, BLOCKED or NOT RUN. Recommend acceptance only when no required gate remains unresolved.
