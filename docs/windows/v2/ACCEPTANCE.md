> Update 11 October 2026: M0 engineering audit COMPLETE; original combined gate NOT PASSED. EX-M1-01 authorizes M1 provisional implementation only. Original-Figma approval/parity remain BLOCKED where evidence is missing. See [Milestone 1](MILESTONE-1.md). Historical results below are unchanged.

# Milestone 0 acceptance matrix

11 October 2026. **Gate: BLOCKED — baseline review packet delivered; approved reference/control freeze not achieved. Stop here.** PASS means the named check actually passed. FAIL means an observed mismatch or failed attempt. BLOCKED means a prerequisite prevents acceptance. NOT RUN means no executed evidence. Historical Phase 1/design results are context, not fresh passes.

## Pass

| Gate | Fresh evidence | Scope / limitation |
|---|---|---|
| Governing brief and real baseline inspected | Original Phase 1/docs/domain/IPC/store/chart/helper and V2 source/handoff/contracts/tokens; source archive and inventories | No later milestone code or product UI added |
| Coherent domain prerequisite | `4040781`; exact four files, five domain tests; clean commit source export | Generic contracts do not implement every V2 lifecycle/relationship |
| Locked clean-source build | `evidence/baseline/results.json`: npm ci, local-core, typecheck, lint, Next build, Windows executable, origin regression | No unrelated working-tree files or environment secrets copied; no installer |
| Rust contracts/storage/foundations | Domain 5; local Store 5; workspace 92; command-origin 1 | Workspace count includes domain; do not add overlapping totals; 109 domain missing-doc warnings retained |
| Web regressions after required setup | `web-tests-after-generate.log`: **204/204**; typecheck/lint/production build | Prisma generation required before suite; deployed auth/provider journeys not exercised |
| Existing Python helper with supported interpreter | Embedded runtime: **33/33**; clean parent source and exact equal child helper hashes | Existing runtime reused; fresh runtime installation, Rust broker and sandbox not accepted |
| Actual Windows local journey | `native-offline-restart.log`, `native-result.json`, native screenshot | Fresh isolated validation storage; create/name/save/import/invalid import/zoom range save/reload/source removal/OS restart; real Tauri IPC |
| Source control census | 1,711 visible candidates, 58 required missing-state rows; **1,769 inventory rows**, 31 action contracts | Complete for supplied rendered source selectors; Figma/unseen menus/missing design controls still blocked |
| Current comparison content discrepancy diagnosed | Fresh 33:1080 metadata + natural 1440×900 PNG | Correct comparison now present; historical diagnostics defect superseded; header/product/details still need review |
| Source geometry/assets | 36 captured source arrangements; 11 measured geometry arrangements; hashed real Geist assets match installed source | Source-only geometry, not accepted Figma measurement or native parity; raw sources are synthetic examples |
| Recordings disabled | CLI preference off, active/latest none; native subprocess override `BH_RECORD=0` | PNG review captures retained; no video/trace recording enabled |
| Original product identifier restored | Product rebuilt after validation, copied to `out/windows-v2-m0/zterminal-desktop.exe` | Local unsigned standalone executable only; no installation or publication |
| Reproducible debug smoke | Five 10k-row fixture runs, 2k-bar scene, per-call new process | Median create 49.30ms/import 223.23ms/scene 173.04ms/save 84.84ms/restore 59.71ms; creation max 4,850.94ms; not product startup/frame budget |

## Fail

| Check / defect | Evidence | Disposition |
|---|---|---|
| Existing Phase 1 presentation against V2 | Native screenshot: Segoe UI/blue surfaces/230 DIP list/single chart; source and selected V2 direction use Geist/Violet/194 DIP navigation/dock groups | Known baseline gap; implementation belongs to M1+, not repaired by M0 |
| Full V2 behavior in current shell | Seven local commands only; Store rejects indicators/drawings/replay/presentation; no desktop editor/jobs/providers/docking/evidence | Known baseline gap; inventory maps required owners/tests; no placeholders counted |
| Initial clean web test attempt | `web-tests.log`: 186 pass, three test-file failures from ungenerated Prisma client | Baseline runner setup omission corrected; generated client + rerun 204 pass; initial failure retained |
| Virtual-environment helper attempt | `python-helper.log`: 28/33 pass; five worker failures, exit 101 | One-process Job Object rejects venv launcher spawning base interpreter; direct minimal reproducer confirms cause; embedded interpreter run passes |
| High-severity dependency threshold | Production audit: 14 advisories, including 11 high/1 critical; full install reports 22 | Separate reachability/update decision; no broad dependency mutation in audit |
| Compact source accessibility | Reset-layout buttons lack accessible names; 683×384 placement y≈494 beyond visible area; visible DOM census includes internally scrollable/offscreen candidates | Unapproved source defect; design must establish access/scrolling/name before approval |
| Prepared source/token agreement | Source measured instrument radius 7px and icon radius 6px versus prepared token controls 8 DIP; comparison Futures versus source Spot | Resolve accepted precedence; do not label prepared tokens bound/approved |

## Blocked

| Acceptance requirement | Blocking evidence | Required resolution |
|---|---|---|
| Approved original reference manifest | Only 33 natural Figma export obtainable; 24 remaining exports unavailable; fresh structural inspection rejected at current Starter quota | D01–D03: originals/access, per-frame/font/layer/component/token/state reviews and explicit exceptions |
| Complete approved action inventory | Full menus, preference page bodies, states and missing provider/research/export/repair controls unspecified | D04–D16: approve exact controls/semantics; source census and missing-state requirements remain review candidates |
| Accepted V2 parity matrix | Missing originals/approval and current app visibly non-V2 | Freeze targets/masks/capture conditions, implement M1+ then compare actual fixed client captures |
| Fixed Windows reference conditions/performance budgets | Native test capture is 1800×1055 physical pixels under current desktop conditions; no 100/150/200 reference set | D17/D18: approve OS/client/caption/scaling/hardware/budget convention; collect distributions |
| Full preservation/migration gate for later consumers | Dataset v1/native V3/web payload/archive semantics differ; domain limitations recorded | D06–D10/D15: explicit converters/golden fixtures before consumer expansion |

## Not run

| Test group | Planned milestone / reason |
|---|---|
| Fixed 1366×768/1440×900/1920×1080/detached 1024×680 native screenshot overlays at 100/150/200%, all hover/focus/pressed/selected/disabled/loading/empty/error/recovery states | M1–M6 after approved originals/state designs; source captures do not substitute |
| Full menus, workspace duplicate/save-as, libraries/search/drafts/recovery, detach/redock/close/presets/monitor removal | M2; current slice has only simple create/open/name/save |
| Parquet/other formats, provider subscription/history/rate limits/gaps/perpetual metadata, drawings/studies/volume, shared replay | M3; no first-release capability pass inferred from design labels or Rust enums |
| Rust-brokered editor/config/queue/jobs/isolation and versioned spot/perpetual numerical tests | M4; existing helper tests do not establish new model/sandbox |
| V2 reports/trades/undefined metrics/provenance/comparison/incompatibility/bootstrap/export pickers and failures | M5; existing math/helper tests cover legacy behavior only |
| Narrator, IME, contrast, high-contrast, native keyboard coverage, crash/disk-full/long-session/mixed-DPI, 10k/100k/1m release performance distributions | M6; 100k rejection/unit bounds and debug 10k smoke are separate evidence |
| Clean Windows 10/11 install/offline absent-WebView2/upgrade/uninstall/data retention/update/signing/SBOM/release | M7; executable build is not an installer pass; signing/publication separately authorized |
| Deployed web interactive auth/providers/storage and production migrations | Preserved source/contracts; local tests/build pass; no production access/mutation performed |
| Optional event/microstructure tests, native WinUI/D3D performance track, full warnings-as-errors lint/clippy | Outside selected Phase 1/V2 M0 behavior baseline; unrelated edits excluded |

## Acceptance conclusion

M0 baseline reconciliation and review documents are ready. Human design/scope acceptance is still required by the governing brief before a reference can be called approved. No accepted design exceptions were invented. EX-M1-01 now permits M1 against the provisional baseline; see MILESTONE-1.md. Missing references block dependent design acceptance only.
