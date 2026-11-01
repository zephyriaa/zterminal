# ZTerminal-owned chart renderer — plan and goal prompts

Prepared 11 October 2026. This brief authorizes planning, not deployment, release publication or production changes. Dispatch one implementation milestone at a time. It complements `V2-PRODUCT-BUILD-PROMPT.md`; it does not restart the backtesting, provider or workstation projects.

## Objective and scope

Build an independently implemented ZTerminal chart renderer for the native Windows application, then a web backend that replaces Lightweight Charts after regression acceptance. Preserve ZTerminal's chart documents, indicator calculations, drawing semantics, replay, data provenance and research integrations. The goal is product independence and a reliable research surface, not removal of other projects' credits while retaining their implementation.

“From scratch” means original renderer implementation: no copying, translating, wrapping or renaming Lightweight Charts source. Existing ZTerminal-owned native rendering and domain code may be reused and improved after ownership/dependency inspection. Operating-system graphics/text APIs and appropriate general-purpose dependencies remain permitted with their licenses preserved. Do not introduce another charting engine as a substitute. If a future dependency is proposed, record its exact version, purpose, license and transitive obligations first.

The product follows README's observe → investigate → code → test → compare → refine loop. Rendering must preserve market truth, explicit assumptions and local evidence. Windows uses native controls and graphics, not WebView. The deployed web chart remains intact until its replacement passes. This project does not implement new backtesting models, broker execution, sync, provider expansion or a full workstation rewrite.

## Source-verified starting point

Recheck these facts at dispatch time; they are starting evidence, not completion claims:

- `apps/windows-host/src/main.cpp` already contains a D3D11 renderer, candle geometry, retained vertex buffers, bounded visible candles, crosshair, drag/zoom state, resize/device diagnostics and explicitly labelled diagnostic fixtures. Its current local `ChartCandle` carries OHLC doubles; this alone is insufficient for a complete timestamped multi-series chart.
- `apps/windows-host/src/native_chart_host.h` exposes initialize/render/resize, pointer, drag, zoom and scene-selection functions. `apps/windows-host/CMakeLists.txt` builds the native presentation library and local Rust scene/storage bridges. The native prototype is not a certified complete engine.
- `src/components/terminal/terminal-chart.tsx` and `src/lib/chart/lightweight-adapter.ts` use Lightweight Charts underneath ZTerminal semantics. Inspect all imports/consumers, including drawing/overlay primitives and the simple observed-history chart.
- `src/lib/chart/contracts.ts` currently declares web chart schema version **5**, chart settings V2, candles/bars/line/area, normal/logarithmic/percentage scales, panes and extensive drawing types. Rust `ChartDocumentV3` is a different contract; do not pretend these names imply identical versions or payloads.
- `src/lib/chart/drawings/{coordinates,geometry,snapping}.ts`, indicator evaluators, chart-data normalization, overlays and replay tests provide reusable behavior. Inspect imports to distinguish independent algorithms from third-party API adapters.
- Existing tests include chart-document/data, drawing geometry/engine/store, indicator evaluators/library and replay lookahead. Existing native scene/navigation/rendered-pixel scripts are useful foundations, not proofs of complete feature parity.

## Engineering plan and architecture

### A. Audit and freeze the actual behavior

Read README, native product boundary, renderer sources, chart contracts, data normalization, drawing interaction, overlays, indicators, replay and settings consumers. Record branch/commit/dirty baseline and preserve unrelated work. Compare local README with the current GitHub README if available; record differences rather than rewriting either. Respect installed Next.js guides before any Next code changes.

Produce one compact feature matrix: existing web behavior, native capability, approved V2 requirement, required first replacement behavior, implementation owner and meaningful test. Inspect source and actual UI rather than assuming every exported type is a working feature. Cover supported chart types, settings, scales, panes, drawing tools, indicators, trade/mark-price overlays, replay, exports, multi-chart synchronization and persistence. Unimplemented first-release capabilities cannot be silently removed or permanently disabled to obtain a pass. Future roadmap capabilities remain separate.

Inventory Lightweight Charts imports, types, CSS, plugins, documentation, dependencies and transitive coupling. Identify pure ZTerminal code versus library-bound primitives. Audit provenance of reusable code. Maintain the existing library's notices/link while any shipped consumer still uses it. Removing an npm dependency alone does not establish independence of adapted code.

### B. Keep the existing domain; replace rendering ownership

Use the existing Windows D3D11/WinUI integration first. Prefer a small extraction of renderer and pure geometry code from the current host over rewriting functioning device/window code. Rust retains verified data/storage/replay ownership. Choose ownership of portable geometry based on existing code and maintenance cost: Rust with a narrow native binding may share algorithms with a future WASM web backend; native C++ with equivalent TypeScript algorithms and shared fixtures may be the smaller correct first step. Record the decision and consequences in the audit. Do not migrate all C++ rendering to Rust or introduce WASM solely for conceptual uniformity.

Separate only the actual concerns: validated scene input, scales/layout, projected geometry and hit testing, backend drawing, host input/accessibility. Reuse canonical contracts; add the minimum internal render representation needed. No competing workspace/dataset model, general plugin framework, universal UI toolkit or speculative graphics abstraction.

Native backend: existing D3D11 composition/swap-chain path, native Windows text measurement/rendering (evaluate DirectWrite/Direct2D integration), proper clipping, premultiplied alpha where required, resource lifetime and device recovery. Web backend: choose Canvas 2D as the first implementation unless measured target workloads justify WebGL; use real bundled fonts and device-pixel-ratio scaling. Canvas and Direct3D may differ in glyph rasterization but must agree on semantic geometry and input outcomes. The web backend is for the existing web product, not a Windows WebView shell.

Version the render-scene boundary only when needed. Capture instrument/product identity, timestamps and units, exact price/quantity metadata, data revision, visible range, replay boundary, settings/panes, indicator outputs, drawings and availability. Verify native/web conversions with golden fixtures. Legacy web timestamp units and Rust epoch-ms units must not be mixed. Do not convert exact values to binary float before their validated calculation boundary; for rasterization project values relative to local origins and retain exact originals for labels/hit results. Do not pass large epoch values directly into f32 GPU geometry.

### C. Implement mathematically correct scales and layout

Specify forward/inverse price and time transforms, reference origins, coordinate spaces (data/logical bars/DIP/CSS pixels/physical pixels), clipping and tick generation. Pointer and rendered geometry use the same transforms. Define floating tolerances separately from tick/quantity exactness.

Handle empty and single-bar input, equal prices, doji/minimum visible bodies, small/large values, negative prices on linear scales, irregular timestamps, sessions, gaps, zero volume, invalid values and very narrow plots. Logarithmic scales reject or explicitly withhold nonpositive values; do not clamp or silently switch modes. Percentage scales declare a stable base and behavior for zero/invalid bases. Test inverted scales and asymmetric margins.

Time compression is an explicit presentation setting: a bar-index axis can compress gaps but must not manufacture timestamps, bars, continuity or indicator input. Preserve time anchors through gaps; display relevant availability/coverage warnings. Timezone changes affect labels, not stored instants. Test DST changes, session boundaries and timestamp precision. Future whitespace is layout space, not future observations.

Lay out price/time axes, collision-free labels, ticks, grid, pane separators and independent pane scales using actual font metrics. Resize, panel movement and DPI changes must preserve semantic viewport intent. Bundle approved Geist/Geist Mono assets and use approved V2 styling; prepare missing design states in Penpot rather than inventing approval.

### D. Draw and interact with real chart content

Draw candles/wicks/borders, OHLC bars, line/area and histogram/volume series required by the replacement matrix. Clip all content to its pane; keep axis hit regions separate. Build deterministic order: background/grid, series, approved overlays/drawings, selected handles, crosshair/labels and chrome. Handle sparse/null study values and warm-up without substituting zero or drawing through invalid gaps.

Implement cursor-anchored wheel zoom, pan, axis scale/scroll behavior, fit/reset, price/time crosshair labels, stable live-follow versus historical-inspection state, native capture/focus, Escape cancellation and keyboard equivalents. Account for pointer cancellation, focus loss, resizing during drag and detached windows. Prevent multi-chart synchronization feedback loops using existing workspace/chart identities; do not introduce a separate synchronization document.

Reuse ZTerminal drawing geometry/snapping and port library primitives to original backend commands. Persist time/price anchors, instrument/chart ownership, styles, visibility, locks and z-order. Test hit tolerance in logical display units across DPI, overlapping objects, edge clipping, editing, undo/redo, text editing and deletion. Position/risk-reward drawings are annotations, not orders.

Consume existing validated indicator/overlay outputs and markers, respecting replay and availability. Do not recalculate backtests inside the renderer. Audit which studies are replay-safe; future-derived output must not influence visible scales, labels, hit results or accessible descriptions. No fabricated depth, volume or research overlays.

### E. Bounded streaming, state and lifecycle

Retain full history in existing storage while selecting bounded visible geometry. Use indexed range selection and explicitly versioned/downsampled display summaries when zoomed out. OHLC reduction must retain first open, maximum high, minimum low, last close and valid volume sums with declared bucket/coverage semantics; never use display aggregation for research inputs. Preserve gap/null segments, selected extrema and drawing anchors. Define precise hover labels for aggregated buckets rather than pretending each represents a raw bar.

Apply append/update corrections by dataset revision; reject stale scene/job results after instrument/timeframe/workspace changes. Handle duplicates/out-of-order updates upstream without hiding errors. Invalidate caches on data, theme, viewport, pane, scale and replay changes. Coalesce paints, reuse buffers and release resources deterministically. Optimize only after profiling; no per-tick process launches or rereading complete history on each pointer move.

Persist viewport, settings, panes and drawings with existing storage, migrations and revision rules. A save state reflects durable completion. Reopen offline using verified retained data; source-file deletion must not destroy imported content. Handle corrupt references, interrupted writes, cancellation and device/browser-context recovery without false success.

## Debugging and verification strategy

Every substantive fix starts with the smallest reproduction and a failing meaningful check. Diagnose the owner before editing: data/units → scene revision → layout/transform → geometry → backend/resource → input/persistence. Fix the shared cause, then exercise sibling paths. Do not hide NaNs, clip errors, data gaps or resource failures by suppressing diagnostics.

Provide opt-in developer overlays for plot/axis/pane bounds, transforms, clip regions, primitive and hit-target IDs, data/replay revisions and actual visible counts. Keep diagnostics bounded and free of credentials/personal paths. Record deterministic viewport/input event sequences for replayable tests; browser-harness recordings remain off unless the user authorizes them. Test screenshot captures are separate artifacts, not permission to enable session recording.

Use D3D debug-layer/resource diagnostics where available and label missing developer dependencies honestly. Add a diagnostic path to deliberately exercise device recreation. For the web use browser-harness to check Canvas output, pointer/keyboard effects and console/resource errors; DOM assertions alone cannot establish rendered-chart correctness. Native controls require native input/accessibility testing, not a browser substitute.

### Required test layers

| Layer | Required checks |
| --- | --- |
| Pure mathematics | Price/time projection inverses; cursor zoom anchor; bounds/rounding; log/percentage/inverted scales; DST/gaps; tick labels; drawing geometry and hits; aggregation invariants |
| Contract/data | Explicit schema and unit conversion; precision; malformed/duplicate/nonfinite input; timestamps; immutable originals; revisions; provenance; unsupported scene rejection |
| Temporal integrity | Shared replay cutoff; future prices/indicator values do not change visible geometry/autoscale/crosshair/accessibility; rewind invalidates dependent state |
| Renderer output | Deterministic geometry goldens plus raster captures for empty/single/doji/gaps/volume/indicators/drawings/overlays/themes/panes; exact test fixture identity |
| Interaction | Pan/zoom/fit/axis actions; pointer cancellation; focus/keyboard; object edit/lock/undo; chart synchronization without loops; restart restoration |
| Lifecycle | Resize/minimize/restore/detach; 100/150/200% DPI; monitor removal; native device recreation; web DPR/container/font changes; repeated mount/unmount with no orphan listeners |
| Performance | Release CPU/GPU/input-to-present measurements with frame percentiles, visible counts and hardware; 10k/100k/1m retained bars; streaming bursts; long-session memory/resources |
| Product regression | Existing chart/drawing/indicator/replay tests, web typecheck/lint/build/tests, native clean build and real local import/save/restart; model behavior unchanged |

Use independently calculated expected values and hand-verifiable cases in addition to old-engine comparisons. Do not copy the implementation into tests or bless failing screenshot output as a new golden. Each backend has approved raster baselines for fixed OS/browser/fonts/DPI; semantic geometry is compared across backends. Mask only explicit dynamic/OS-dependent regions, never incorrect axes, fonts or missing controls. V2 missing original exports remain Blocked for original-Figma parity, even if source-based comparison passes.

Fixtures may be deterministic synthetic data clearly marked TEST ONLY and stored in isolated validation locations. Runtime product data must remain verified real inputs. Complete temporal/precision tests before introducing the replacement into an actual research path.

### Performance acceptance

Freeze target hardware and workload budgets during the audit, before choosing a graphics backend. Proposed initial interaction target: at 60 Hz, p95 frame work fits within 16.7 ms and input-to-present p95 is under 50 ms on the declared baseline device, while a representative local job runs separately. These are proposed budgets, not current achievements or universal guarantees. Record cold/warm runs and at least 20 repeated workload samples where appropriate; include p50/p95/p99, dropped frames, CPU/GPU time, memory, dataset size, visible count, viewport and environment.

Measure actual displayed-frame/input latency separately from vertex-build duration and Present submission. State instrumentation limits. Verify idle work is bounded, memory reaches a defined plateau during long runs, and device restoration works. Count live-follow and historical navigation separately. Higher-refresh targets follow measured capacity; do not claim 60 FPS from an average draw timer. Stop broadening tests once required checks pass unless new failures/changes warrant it.

## Milestones and acceptance gates

Renderer milestones R0–R7 are separate from Windows product milestones and README roadmap phases.

| Milestone | Deliverable | Exit gate |
| --- | --- | --- |
| R0 — Audit and renderer design | Reuse/provenance map, dependency inventory, replacement matrix, scale/scene contracts, native/web ownership decision, risk/migration plan and baseline | Native foundation builds/runs; actual web capability audited; budgets/reference conditions and meaningful tests defined; no product replacement |
| R1 — Correct native slice | Original axes/text/grid/candles/volume/transforms/crosshair/pan/zoom around verified local scenes; durable viewport | Native offline launch → workspace → verified import/load → interaction → save → process restart → restore; mathematical/precision/replay-cutoff tests and fixed captures |
| R2 — Native presentation completeness | Required series/scales/panes/themes/settings and labels | Approved replacement matrix for these features passes geometry, raster and interaction tests at reference sizes/DPI |
| R3 — Drawings and research overlays | Existing tools/studies/markers/replay/synchronized charts through original renderer | All existing supported semantics retained; temporal isolation, drawing editing/persistence and cross-chart tests pass |
| R4 — Native reliability/performance | Indexed/cached bounded scenes, measured optimizations, resource/device recovery and accessibility | Hardware budgets met or explicit failure; stress/recovery/long-session checks; no hidden integrity compromise |
| R5 — Independent web backend | Canvas-first candidate using same contracts, behavior and test fixtures | Local opt-in candidate passes all applicable web features, geometry/raster/input/DPR/accessibility tests; old production backend retained |
| R6 — Migration and removal | Reviewed web adapter replacement; persisted-document compatibility; actual consumer/dependency removal | Default local build uses owned backend; no imports/runtime bundles/copied implementation remain; full web/native regression passes; notices updated only for components actually removed; no deployment |
| R7 — Independent acceptance | Source/provenance audit and direct use of both renderers | Complete feature/action matrix, zero unresolved required correctness/security defects, visual/performance/recovery evidence, rollback/handoff; release remains separate |

### Risk register and migration sequence

| Risk | Mitigation |
| --- | --- |
| Native spike mistaken for complete engine | Establish actual build/run capabilities and missing axes/text/metadata; implement R1 first |
| Web schema 5 silently treated as Rust V3 | Explicit converters, preservation of originals and fixture-based migrations |
| Existing API coupling breaks drawings or studies | Enumerate all consumers/primitives and replace adapters after semantic tests |
| Precision or future-data leakage | Exact metadata plus local projection origins; replay-bound autoscale/hit/labels; adversarial fixtures |
| Different platform text/rasterization | Actual font metrics, platform raster baselines, shared semantic goldens; transparent reviewed exceptions |
| Unbounded history/render costs | Indexed visible scenes, bounded batches and validated display reductions; full research inputs retained |
| Licensing independence incorrectly asserted | Provenance audit; no library-code copying; retain relevant notices until all dependent shipped paths are removed |
| Premature web replacement | Opt-in local candidate, compatibility tests and reproducible rollback; explicit deployment authorization |
| Renderer project becomes broad product rewrite | No new providers/backtester/sync/execution; integrate existing contracts only |

Sequence: audit → build/test native foundation → native verified vertical slice → feature parity and stress → local web candidate → documented payload migration and regressions → remove old consumers/dependency only after acceptance → separate authorized deployment. Maintain prior source revisions and backup/migration rollback; do not retain a hidden Lightweight Charts fallback in a product claimed independent.

## Master goal prompt — paste once

You are the principal renderer, Windows graphics, Rust, TypeScript and verification engineer for ZTerminal. Read `docs/windows/OWN-CHART-RENDERER-PLAN-PROMPT.md` completely and treat it as the renderer specification; also read README, native product boundary, current Windows V2 brief and applicable AGENTS/skills.

Build ZTerminal's independently implemented chart renderer: native Windows first, independent web backend second. Reuse ZTerminal-owned domain and graphics foundations; do not copy/translate Lightweight Charts or introduce another charting engine. Preserve existing web behavior until verified migration. Retain all required chart settings, tools, indicators, replay and persisted documents. Rendering consumes verified local data and existing research outputs; it must not invent prices, depth, jobs or trades.

Apply Ponytail to coding, Penpot to needed design work, and browser-harness with recordings off to web/design-browser verification. Use native checks for native rendering/input/accessibility. Preserve unrelated work. Verify source facts and current repository state before editing. No Next.js changes without reading the relevant installed guides. No live orders, deployment, installer publication, credentials changes or external sharing.

Implement only the requested R milestone, starting with R0. Work through debugging and regression failures to its gate. Tests must cover mathematics, precision, temporal integrity, rendering, input, persistence, lifecycle and measured performance as applicable. Do not replace tests with screenshots or claim native acceptance from a browser run. Original-Figma parity remains unresolved where originals are missing.

For each milestone report commits, actual executable/candidate, implemented features, executed commands/checks and outcomes, geometry/raster evidence, benchmark environment/distributions, failures and unimplemented items. Distinguish Pass/Fail/Blocked/Not Run. Maintain a concise renderer handoff and feature-to-test matrix. Stop at the requested milestone boundary; no blanket “flawless” claim without complete evidence.

## R0 dispatch prompt — send first

Execute R0 only from `docs/windows/OWN-CHART-RENDERER-PLAN-PROMPT.md`. Apply its master prompt. Audit the actual native and web chart code and every Lightweight Charts consumer. Produce the feature/provenance/reuse map, contract conversion plan, native/web ownership decision, migration/risk register and test/performance baseline. Build/run the existing native foundation and run relevant existing web/domain tests. Reuse completed project audits instead of repeating unrelated work. Identify dependencies, reference gaps and unavailable test tooling honestly. Do not start product renderer replacement. Stop with a concrete R1 handoff.

## Continuation prompt — use separately for R1 through R6

Continue with R[NUMBER] — [NAME] only from `docs/windows/OWN-CHART-RENDERER-PLAN-PROMPT.md`. Read the master prompt, current handoff, feature/test matrix, source/provenance audit, prior gates and dirty baseline. Resolve prerequisite failures that affect this work. Implement and debug the required behavior, preserve ZTerminal semantics and existing consumers, and run the milestone's meaningful native/web/math/temporal/persistence/performance checks. Fix regressions before claiming acceptance. Commit reviewable increments, report exact evidence and remaining defects, and stop. No deployment or publication.

Names: R1 Correct native slice; R2 Native presentation completeness; R3 Drawings and research overlays; R4 Native reliability/performance; R5 Independent web backend; R6 Migration and removal.

## R7 independent acceptance prompt

Independently review both ZTerminal-owned renderer backends against `docs/windows/OWN-CHART-RENDERER-PLAN-PROMPT.md`, actual README goals, the approved feature matrix and V2 references. Treat previous completion claims as unverified. Inspect code provenance and confirm no copied/translated Lightweight Charts implementation, remaining runtime dependency or hidden fallback. Check that the Windows product uses native graphics and controls. Exercise actual native and web chart types, scales, axes, panes, drawings, indicators, replay, overlays, synchronization, accessibility and failure/recovery behavior. Independently verify geometry, numerical/temporal fixtures, migrated documents, offline save/restart and performance distributions. Verify research/data behavior and web product remain intact. Separate original-Figma parity from provisional-source comparison and unexecuted tests from passes. Return prioritized reproducible defects and a Pass/Fail/Blocked/Not Run matrix. Recommend acceptance only when every required gate passes. Do not deploy or publish.

## How to use these prompts

Provide repository access, original V2 references where available, and this document. Send the master goal plus R0 dispatch first. Review its evidence. Then send the continuation prompt with R1, R2, R3, R4, R5 and R6 one at a time. Use R7 for independent acceptance after the implementation gates pass. Keep the same implementation chat or supply the latest commit, handoff, defects and evidence to a new chat. No renderer implementation is authorized simply by storing this plan.
