> Update 11 October 2026: M0 engineering audit COMPLETE; original combined gate NOT PASSED. EX-M1-01 authorizes M1 provisional implementation only. Original-Figma approval/parity remain BLOCKED where evidence is missing. See [Milestone 1](MILESTONE-1.md). Historical results below are unchanged.

# Risks and decisions before implementation

11 October 2026. Decisions are proposed for human review at the M0 gate. No source-generated frame, missing menu, numerical example or prototype placeholder is approved by this audit. New/missing designs belong in Penpot; existing Figma remains the visual reference. M0 has not created/edited/shared either design file.

## Risk register

| ID / severity | Evidence / risk | Mitigation and acceptance owner |
|---|---|---|
| R01 Critical | 24 original frame exports and structural/font/component reads unavailable after fresh quota rejection. Historic source reviews differ from Figma approval. | Design owner supplies originals or access; review per-frame status and freeze hashes/exceptions. No pixel-parity claim from source PNGs. |
| R02 Major | Current 33:1080 is comparison; old handoff says diagnostics. Current header reads Binance Futures while local source reads Spot. | Supersede old defect using fresh PNG/metadata, review exact product identity. Do not repair an already corrected frame or replay capture IDs. |
| R03 Major | Menus, control states, preferences pages, high-DPI/material/detail views have no accepted references. | Penpot review queue; item-by-item controls and state matrix. Undefined items block full inventory acceptance. |
| R03a Major | Saved zoomed Figma first-launch proof advertises CSV/Parquet; current source launch advertises CSV/OHLCV. Earlier main proof lacks local library navigation now in source. Source evolved without confirmed matching Figma exports. | Preserve both histories and hashes; inspect original current exports; never treat latest source as an approved replacement automatically. |
| R04 Critical | Phase 1 Dataset v1 lacks instrument/product/timezone/provenance model expected by V3. Legacy web archive/config semantics differ. | Versioned converters preserve originals; explicit provider/product/units; golden migration fixtures. Do not infer product from a label. |
| R05 Critical | Same-user Python resource limits and scrubbed environment do not isolate filesystem/network/credentials. | Rust broker + concrete isolation policy and adversarial tests before enabling desktop Run. No renderer/Python credential exposure. |
| R06 Critical | Perpetual simulation requires marks/funding/historical margin tiers; current paper/helper logic is not that model. | Separate versioned isolated-margin engine; required coverage blocks runs, explicit assumptions captured; preserve legacy archive identity. |
| R07 Major | Domain validation has relationship/lifecycle/bounds gaps and incomplete funding metadata edge; Volume not a listed chart study. | Contract evolution decision, focused trust-boundary fixtures, explicit artifact validation; bounded IPC and converters. |
| R08 Major | UI minimum 1024Ã—680 cannot fit required 911Ã—512 or 683Ã—384 logical laptop areas. Small source reset control is unnamed/off viewport; rail measures 42 outer/37 client. | Reviewed compact/scroll/focus designs, native work-area-aware sizing and placement. Do not shrink text or report client width as outer DIP width. |
| R09 Major | Strict importer positive-volume/contiguous/100k/8MiB conflicts with zero-volume valid markets, source Parquet advertisement and 1m-input quality targets. | Decide valid formats/zero volume/gaps; never silently parse Parquet as CSV; measured segmented ingestion/retained history. |
| R10 Major | Synchronous SQLite mutex and repeated full artifact checks may stall UI; no release startup/frame latency distributions. | Measure declared hardware; move work off UI thread based on results; retain integrity and bounded rendering. |
| R11 Major | Crash between immutable artifact writes and workspace transaction can leave orphans; disk-full and GC policy unaccepted. | Transaction/recovery tests, original retention and approved bounded cleanup; no false save status. |
| R12 Major | No installer/offline missing-WebView2/upgrade/uninstall acceptance; configuration downloads bootstrapper. | M7 clean Win10/11 tests and runtime package policy. Executable build is not install acceptance. |
| R13 Major | Full dependency install reports high/critical advisories; CI audit threshold is non-enforcing. | Capture production audit separately, assess reachable dependencies, plan reviewed updates with web regressions. No automatic broad upgrade in M0. |
| R14 Major | Web quality/production workflows tolerate selected failures; current local build cannot prove deployed auth/provider behavior. | Keep source/contracts untouched; report local checks separately from deployed end-to-end checks. No production mutation. |
| R15 Major | Original tree contains independent WinUI/risk/dev/environment edits. | Initial snapshot; prerequisite-only commit; audit-only second commit; compare remaining dirty paths/content against initial state. Never stage all. |
| R16 Major | Full AA/Narrator/keyboard/IME/high-contrast checks absent; source font declarations are not Figma rendered-font evidence. | Native assistive-tech and composed contrast tests; actual font assets/style names; fixed capture conditions and masks reviewed. |
| R17 Major | Named browser daemon/CDP handles may fail on restart; browser-only injection differs from native IPC. | Fresh native daemon per process; recordings disabled; report harness faults as blocked attempts, rerun unchanged tests only after diagnosis. |
| R18 Major | Source examples use hard-coded reports/market data and navigation instead of real file/jobs/providers. | Keep previews out of product; require each action's real service owner, immutable inputs, failure/recovery tests. |
| R19 Major | Titlebar/source preview paints illustrative OS controls; native frame varies by OS/theme/DPI. | Use Windows caption; declare client/caption bounds and approved OS mask; no fake window controls to conceal parity gaps. |
| R20 Minor | Tauri configuration reports 0.2.2 while Cargo package reports 0.2.1; package/version identity is inconsistent before distribution. | Reconcile application/package versions and upgrade rules at M7; do not infer installer compatibility from this executable baseline. |

## Decisions required before M1 or later dependent work

| ID | Concrete review decision | Proposed disposition / when required |
|---|---|---|
| D01 | Approve each manifest frame/export and explicit exceptions; provide missing originals/access | Block M0 accepted freeze. User-selected V2 direction retained; unreviewed frames stay unapproved. |
| D02 | Approve current comparison 33:1080 and exact Spot/Futures header/content identity | Fresh correction source/export is reviewable; no further Figma edit currently needed. |
| D03 | Approve missing equity/trades/empty/monitor/material/high-DPI and control-state designs; reconcile compact navigation mode | Prepare in Penpot when separately dispatched; existing source images are concrete proposals, not approvals. Current 1366 source retains 194 DIP navigation; clarify its relation to the brief's compact rail requirement using approved exports. |
| D04 | Approve full Panel/Strategy/Workspace/Layout/Study/Drawing/Speed and selector menu item lists | Every item needs its own command/state/failure/test; full approved control inventory blocked until supplied. |
| D05 | Resolve calendar/provider planned versus first-release capability scope | Calendar/AI/order flow/options/cloud/broker proposed roadmap-disabled; verified Binance Spot + USDT-perpetual in scope. |
| D06 | Approve advertised import formats and zero-volume/gap/duplicate policies | CSV required; Parquet appears in V2 dataset source but unsupported locally. Implement approved formats or approve visual removal; default strict reject unchanged meanwhile. |
| D07 | Choose workspace root ownership and move/export policy | Phase 1 app-local Store versus V2 folder picker/D:\Research examples. Rust picker-granted root references; no arbitrary renderer paths. |
| D08 | Approve versioned compatibility/migration semantics | Phase 1 Dataset v1, web envelope/store and legacy research archives need explicit preserved-original converters; no automatic cloud ownership migration. |
| D09 | Approve domain extensions/relationships for Volume, replay completion and perpetual inputs | Existing types adopted as prerequisite, no silent reinterpretation of versions. Before M3/M4 consumers. |
| D10 | Choose replay stop/completion/rewind and research cancellation policy | Shared half-open availability boundary; rewind must invalidate/recompute dependent state; no future access. Before M3. |
| D11 | Choose drawing persistence/tool/menu and measurement semantics | Visible modes cursor/crosshair/trend/horizontal/text/measure plus magnet/visibility/delete; edit/lock/undo/redo must be designed. Before M3. |
| D12 | Approve preferences ownership/precedence, themes/material/density/grid/timezone and shortcut conflicts | Restart-persisted local settings versus per-chart/per-workspace overrides; reset boundaries explicit. Before M1/M2/M5. |
| D13 | Choose bundled Python/runtime repair and sandbox/isolation approach | No credentials/network/filesystem authority to arbitrary user code; prove chosen boundaries, package licensing/offline installation. Before M4. |
| D14 | Approve job queue/concurrency/resource/cancellation/restart budgets | Existing helper single active job is not queued V2 lifecycle; bounded jobs with immutable snapshots and interrupted-state recovery. Before M4. |
| D15 | Approve separately versioned spot/perpetual execution models and historical rule inputs | Cash/next-open/fees/slippage; isolated margin/long-short/funding/mark/maintenance/liquidation; missing required coverage blocks run. Before M4. |
| D16 | Approve comparison compatibility and robustness limits/export format | Same dataset/model/config identity comparison; explicit incompatibility; closed-trade account-return bootstrap with replacement, version/seed. Before M5. |
| D17 | Approve Windows reference OS/theme/DPI/client/caption capture convention and visual masks | Proposed current Win11 build 26200 at 100%, then Win10/11 matrix; native caption isolated explicitly; no geometry/type masking. Before parity acceptance. |
| D18 | Confirm performance budgets/hardware tier and distribution statistics | Proposed i5-1335U/8 GB baseline: release cold p95 <2s, warm p95 <1s, 60 FPS interaction target; collect at least 20 startup samples and long-session latency/memory percentiles. Debug smoke cannot accept budget. |
| D19 | Approve data backup/GC/disk quota and uninstall retention policy | Preserve source/evidence/drafts; cleanup preview scoped to disposable cache; backup before migration; no silent orphan deletion. Before M2/M7. |
| D20 | Approve Win10/11 supported versions, WebView2 offline policy, unsigned packaging/update/upgrade approach | No remote frontend. Signing, release publication and secrets remain separate authorization. Before M7. |
| D21 | Prioritize dependency advisories and workflow enforcement separately | Reachability-based fix plan; preserve deployed behavior with regression checks. No unrelated upgrade added to M0. |

Milestone 0 can deliver this review packet and reproducible baseline; it cannot grant human design/scope approval. Implementation must remain stopped at the acceptance gate while D01â€“D04 and relevant M1 policies remain unresolved.
