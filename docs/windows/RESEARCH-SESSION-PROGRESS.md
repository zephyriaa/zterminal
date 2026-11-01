# Local Windows research session

Updated 12 October 2026 (Asia/Baku). Goal remains **active and incomplete**.

## Outcome and acceptance

Deliver a usable session: launch → open workspace → load verified chart data →
study/write a strategy → local backtest → save → close → reopen with workspace
and research evidence restored. Component tests cannot accept this outcome.
Final verification must use the actual native Windows executable and isolated
validation storage, preserve original source/data, disconnect from the website,
restart the OS process, and inspect source, inputs, result identity and restored
chart state. Exercise missing/corrupt data, conflicting writes, failed/cancelled
jobs and interrupted saves. Keep pending product, visual and runtime gates visible.

Product authority: GitHub `zephyriaa/zterminal`, default-branch README blob
`5518a4c483e7bfc961ddd80a044de53a8880e7e7`, re-read on 12 October.
The local README is older, including different licensing language. Neither README
nor LICENSE was rewritten. Initial checkout: `codex/auth-drawing-rebuild`, HEAD
`80124f17ae500565fe4bb7a88ad44f4b693d4e02`, with extensive staged, unstaged and
untracked work. No reset, blanket staging, deployment or publication occurred.

## Architecture assessment

| Existing path | Source evidence | Disposition |
| --- | --- | --- |
| WinUI + Direct3D/DirectWrite | `apps/windows-host/winui/MainWindow.xaml.cpp`, `src/main.cpp`, `native_chart_host.h` | Continue as the Windows interface. Actual local create/open/import/save and scene rendering are wired; research/report are placeholders. |
| Tauri + local Vite/React | `src-tauri/tauri.conf.json`, `src-tauri/src/lib.rs`, `apps/workstation/workstation.tsx` | Retain as compatibility preview. Bundled local frontend avoids a hosted website, but DOM/chart presentation conflicts with the later native-only decision. |
| Device repository | `src-tauri/workstation-core/src/lib.rs`, `native.rs`, `bin/zt-native-store.rs` | Reuse despite its historical directory name. SQLite WAL/FULL, exact source artifacts, revisions and segment hashes already serve the native shell. Do not create a second repository. |
| Rust data/replay | `zt-core`, `zt-storage`, `zt-protocol`, `zt-domain` | Retain validation, exact scene units, completion cutoffs, storage and versioned documents. Scene validity is separate from exchange authenticity. |
| Chart presentation | Native composition adapter; web `observed-history-chart.tsx` | Keep ZTerminal's native renderer. Current product presentation was rejected; see `renderer/R1-PRODUCT-CORRECTION.md`. Passing Store checks does not resolve that rejection. |
| Python Helper | `research/desktop/{controller,child,engine,validation,archive}.py` | Reuse bounded execution and evidence rather than substitute a new engine. Native job lifecycle, runtime discovery and report integration remain absent. |

Recommendation: native WinUI interface → existing Rust repository/scene authority
→ bounded local research worker → durable evidence linked to the workspace.
The README permits an architecture evaluation; the later native-only decision in
`V2-PRODUCT-BUILD-PROMPT.md` selects this path. This supersedes the older Tauri-first
ADR. Preserve legacy implementations until consumer/migration evidence permits
retirement; do not remove them speculatively.

The original integration gap was provider/perpetual-only Helper validation versus
native CSV/spot imports. The new local cash contract below resolves that backend
boundary without relabelling inputs. Native Run and report integration remain
unfinished. Do not imply perpetual margin/funding support.
The existing simulation already documents next-open signals,
costs and unlevered sizing; arbitrary Python remains trusted user code with
filesystem/network authority. Pairing/process limits are not a sandbox.

## Incremental roadmap

| Increment | Implemented | Verified now | Remaining |
| --- | --- | --- | --- |
| Workspace/data foundation | Existing native Store/scene bridge; new strategy persistence | Real adapter processes preserve chart/dataset/viewport and exact strategy inputs through restart and removal of isolated originals | Native product correction and full UI journey |
| Connected chart/strategy surface | Corrected native chart composition and strategy dialog/preview | Actual native chart inspected with observed history; strategy Store verified separately | Product review; native strategy open/edit/save/error/close/restart checks |
| Explicit local research inputs | Versioned CSV/spot cash contract and native snapshot adapter; existing Helper simulator | Store→captured snapshot→bounded child on 600 real historical bars | Native configuration/Run UI, runtime discovery and native job lifecycle |
| Durable report | Existing archive now retains cash context and validates its captured input hash | Offline reopen after isolated original CSV/source copies removed | Workspace run references and native report display; UI failure/cancel/restart behavior |
| Full session acceptance | Not implemented end to end | NOT RUN | Actual Windows launch→chart→strategy→backtest→save→close→reopen, failure recovery and product review |

Next action: connect the verified cash research path to a bounded native job
supervisor, durable workspace run references and actual report display. Finish the
strategy-dialog interaction checks and revisit the complete product composition
when desktop interaction is appropriate. The composition correction is implemented
below but remains unaccepted. Keep workspace/instrument identities separate and
availability explicit. A material new design uses the established Penpot workflow;
no new design artifact was created. Paper/live execution, cloud sync and public
distribution remain deferred. Missing UI checks remain unverified throughout.

## 12 October increment: durable strategy inputs

`strategy.rs` reuses `zt-domain::StrategyRevisionV2` and the existing artifact table.
Each workspace may retain one strategy with exact UTF-8 source, validated flat JSON
parameters, independent strategy revision, target SDK contract and source/parameter
SHA-256 references. Both source and parameter changes create a new revision; identical
saves do not. Workspace reference updates use the existing optimistic transaction.
Chart, dataset and viewport remain unchanged. Ordinary workspace saves/imports
preserve strategy state. Prior content-addressed artifacts remain retained; a browsable
strategy history is not implemented. Unreferenced blobs after a failed commit are
preserved rather than deleted, consistent with the existing repository policy.

Native adapter command: `save_strategy`, with string `id`, expected string `revision`,
local `sourcePath` and JSON-object `parameters`. Source is read with a 256,000-byte
bound, validated as UTF-8, and never compiled/imported/executed. Parameters are bounded
to 16,384 serialized UTF-8 bytes. Adapter requests are bounded to that size plus 4 KiB
of envelope. API only: the WinUI Research button does not yet expose it. No new webview
or hosted Python endpoint was introduced.

Old chart-only payloads remain readable without migration. This adds an optional
strategy field and a second workspace document reference. Older executables do not
support that reference and cannot be used to open strategy-enabled workspaces;
no downgrade or automatic rewrite is provided. Strategy corruption currently withholds
the entire workspace, as other corrupt artifacts do; a recoverable read-only view
remains future work. SDK `1.0.0` denotes the intended contract, not a verified runtime.

## Verification and limitations

Commands from the repository root:

```powershell
cargo test --locked --manifest-path src-tauri/workstation-core/Cargo.toml
cargo clippy --locked --manifest-path src-tauri/workstation-core/Cargo.toml --all-targets --no-deps -- -D warnings
cargo build --locked --manifest-path src-tauri/workstation-core/Cargo.toml --bin zt-native-store
python apps/windows-host/tests/native_strategy_process_test.py src-tauri/workstation-core/target/debug/zt-native-store.exe out/goal-research-session/strategy
python apps/windows-host/tests/native_store_process_test.py src-tauri/workstation-core/target/debug/zt-native-store.exe out/goal-research-session/store
```

- **PASS:** nine Rust Store tests, including exact-source restoration, old payloads,
  no-op/change revisions, stale/invalid saves, interrupted transaction and corruption.
- **PASS:** ten separate-process strategy checks: source hash/CRLF/Unicode, linked
  documents, parameter revisions, retained prior artifacts, unchanged chart state,
  source not executed, original files removed, ordinary save and corruption rejection.
  Oversize source/parameters, invalid UTF-8, NUL and blank source are also rejected.
- **PASS:** eight existing separate-process Store checks including terminated save,
  source retention, exact viewport, cutoff, stale scenes and artifact corruption.
- **Initial failed attempt, corrected:** Python SQLite connection stayed open during
  temporary directory cleanup. Explicit connection closure fixes the harness; the
  full strategy process check was rerun. No product data was touched.
- **Initial lint failure:** current Clippy flagged the existing timestamp modulo
  check. Replaced it with the equivalent `is_multiple_of` predicate; retain final
  command results in `store-clippy-final.log`. The final strict local-store Clippy
  check **PASS**, as do formatting checks on the new strategy module and adapter.
  Dependencies still emit existing missing-doc warnings.
- **NOT RUN:** native UI acceptance, new Python runs, web production regression,
  complete goal session, original-reference parity, installers/performance/security
  release gates. No Next.js code or deployed behavior changed.

Raw local logs/results: `out/goal-research-session/`. They are ignored artifacts;
the checks above regenerate them. The new adapter was built for tests only and was
not copied over the existing WinUI executable's packaged adapter.

Final tested debug adapter SHA-256:
`418594f58b9ef83d3502c89e6d7461c55089f1bec0744ba8ce6263f8df6bef8c`.
Both process checks were rerun on that exact rebuilt executable after the lint
correction; all 18 process checks passed. Nine Store tests passed again after the
same source correction. This is backend evidence, not native UI acceptance.

## Native composition correction and verification boundary

The user rejected the generic native presentation on 12 October. That rejection
remains the product baseline; neither a build nor a screenshot grants acceptance.
Current WinUI now separates instrument/workspace identity, groups file operations
in Workspace actions, uses compact navigation and the reference's 70/30 chart/context
split, respects display scaling/work area, and opens the most recent 100 completed
bars. Explicit Fit history retains the full bounded available range. Existing saved
viewports retain their meaning. Hashes remain available in Dataset inspector, and
saved source has a read-only Python preview. A new native strategy dialog captures
source/parameters through the existing Store; failed saves remain in the dialog,
and edited content blocks Close unless saved or explicitly discarded.

Native Release build and chart/math checks passed; the chart test independently
checks the 100-bar initial timestamps, full Fit span, restoration, and existing
precision/cutoff/raster/cancellation cases. Logs:
`out/goal-research-session/native-composition-{build,math,chart}.log`.
Inspected executable SHA-256:
`58540dd015988f4491f8ad9522ecc8ca5962e7e3717afbb9f98fdf2d90f80a00`.

The actual native chart was visually inspected with 600 historical Binance Spot
BTCUSDT hourly candles beginning 1 January 2026. The imported CSV and raw response,
retrieval URL/time and hashes are retained in isolated validation storage at
`out/goal-research-session/composition-ui-a9b2875d45614745beb35a428ed1d6ee`.
The screen displayed imported history, exchange-origin verification limits and no
live connection. It opened the last 100 bars. This is a structural/readability
inspection, not original-reference parity or user product approval. An initial
hidden-window capture showed an occluding browser and was not accepted as native
visual evidence; a subsequent foreground capture showed the actual workstation.

Computer Use was stopped with the user's physical Escape before the editor action
on two turns. Strategy edit/save/error/close/restart controls therefore remain
**NOT VERIFIED through the UI**. No successful native editor journey is claimed.
Continue independent background integration; do not repeatedly interrupt the
user's desktop to compensate for missing interaction evidence. Full session
acceptance and the product rejection remain unresolved.

## Local cash research backend — 12 October

Implemented `research/desktop/local_cash.py`, which accepts a snapshot produced by
the existing Rust Store, an exact schema-2 native scene and explicitly declared
configuration. It rejects stale workspace/chart/dataset identities, mismatched
source/segment hashes and increments, unordered/missing timestamps, ranges beyond
completion availability, absent saved strategies, and values that cannot survive
the Python numeric conversion. Selected ranges are explicit; no default cost,
sizing or date range is supplied by the adapter.

New dataset contract: `version: 2`, `provider: csv`, `product: spot`, completed UTC
bars and normalized-data hash, retained import timestamp and origin (`local_csv`,
source name, source/segment SHA-256, exact decimal price/quantity steps). The
configuration declares `executionModel: cash_next_open_v1`, `product: spot`, long-only
direction, multiplier 1, tick/quantity increments, capital, allocation, fees, slippage
and exact instrument/timeframe/range. Source and parameters retain their saved
strategy context. Workspace/strategy IDs, revisions, source hash, parameter artifact
reference and SDK contract are captured under version-1 `context` and covered by
the input/result hashes. The Store is the authority for its exported artifacts;
the Python adapter does not independently authenticate arbitrary supplied snapshots
or reread/reimplement the Rust repository.

Reuse: existing simulator, Controller child/Job Object limits, diagnostics and
SQLite archive. Engine version is now `1.2.0`. Result envelope remains version 1
with the explicitly versioned dataset and captured context. Archive validation
reconstructs the same captured-input record without executing stored source.
Existing provider/perpetual dataset version 1 remains supported and is not migrated
or relabelled. Integer versions and nonnegative integer timestamps are enforced.
Cash results declare no short selling/leverage. Proportional fill slippage remains
the existing model; tick size is captured but fills are not rounded to a tick.
No new sandbox or security authority is claimed for trusted local Python.

### Evidence

- Focused four-test contract suite **PASS**: independent next-open entry 12 / exit
  11 / quantity 10 / final equity 990; context/hash/archive restoration; rejected
  stale/malformed/precision/range/model inputs; independent captured parameters.
- Complete Helper discovery **PASS**, with `Ran 46 tests; OK (skipped=6)`.
  Optional Nautilus compatibility setup and five PyArrow recorder checks were
  skipped because those dependencies are absent from the private Helper runtime.
  No dependency install or weakening of recorder checks occurred.
- Real cross-process backend **PASS**: native create/import/save strategy/scene →
  captured cash request → existing bounded child → transactional result → native
  restore and archive reopen after removing only the isolated source/CSV copies.
  It used 600 retained Binance Spot hourly observations and produced 41 hypothetical
  trades, not a paper/live execution capability. The input CSV argument is preserved.
- Initial focused test failed because its proposed precision-loss value actually
  round-tripped. Replaced it with the independently losing decimal
  `9007199254740991 × 0.01`; the adapter rejects that loss, and the full suite passed.
- Final tested identities: Python `3.12.10`, vectorbt `0.28.1`, SDK `1.0.0`, analytics
  `1.0.0`; native adapter SHA-256
  `1654ca539eb47b75fe5fb7eb1227dcb02c7813799ce0673885995d7843481b8b`.
- Final integration artifacts:
  `out/goal-research-session/cash-integration-final/TEST-ONLY-CASH-d411c0669fda44c59c1ed2b0f7a532a4/`.
  Contains captured inputs, retained Store, archive and results/engine/hash summary.
  Input hash `91f431191f68b5bb856e90304b6bec7d0d5e43e1cfdb4e7407c0fb9007ab7f38`;
  result hash `0aa833aceae02f52d2477c729986f653b6d6bb85f39f8805b5ac932876372629`.

Reproduce from the repository root:

```powershell
out/research-runtime/python.exe -m unittest discover -s research/desktop -p "test_*.py" -v
out/research-runtime/python.exe scripts/test-native-cash-research.py out/windows-app/Release/zt-native-store.exe out/goal-research-session/composition-ui-a9b2875d45614745beb35a428ed1d6ee/binance-spot-BTCUSDT-1h-Jan2026.csv out/goal-research-session/cash-integration
```

The second command requires the retained public BTCUSDT hourly CSV (or a fresh
equivalent source with the declared increments) and a built native adapter. Tests
always create new isolated roots. Raw logs are `local-cash-helper-regression-final.log`
and `native-cash-integration-final.log` under `out/goal-research-session/`.
These results validate the backend and reused installed runtime, not a clean-machine
runtime installation, a packaged release, native Run/Cancel UI, or native report
restoration. Workspace references to completed runs are not yet implemented. No
UI automation, public distribution, trading or deployment occurred in this increment.
The full goal remains active and incomplete.
