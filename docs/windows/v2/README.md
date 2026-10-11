# Windows V2 — Milestone 0 review packet

11 October 2026. **Stopped at the M0 acceptance gate: BLOCKED on approved references and control/state design decisions.** The baseline and audit packet are delivered. No Milestone 1 implementation, deployment, release, signing, trade execution, design-file mutation or external sharing occurred.

The governing specification is `../V2-PRODUCT-BUILD-PROMPT.md`, read in full. Ponytail governed code/prerequisite choices; browser-harness performed all browser/WebView work with recordings off. Penpot is the destination for newly required designs; this audit identifies those needs and has not invented or approved them. Existing V2 Figma direction remains the selected reference.

## Review artifacts

- `reference-manifest.json`: every specified frame ID/dimension, original-export availability, source export/hash, typography/token/interactions, review status and empty approved-exception lists; original source snapshots in `evidence/design-source.zip`.
- `control-inventory.csv` and `ACTIONS.md`: **1,711 source control/inspection candidates + 58 missing-state requirement rows**, with 31 command/test families and per-instance contract fields. Unseen menus and missing Figma/state designs block the approved full inventory.
- `ARCHITECTURE-MIGRATION.md`, `dependency-inventory.json`, `legacy-design-system-inventory.json`: actual Phase 1/component/dependency ownership, domain prerequisite review, prior masters/variables and explicit staged migration/rollback sequence.
- `RISKS-DECISIONS.md`: risk register and **21 decisions** with timing and proposed dispositions.
- `ACCEPTANCE.md`: PASS / FAIL / BLOCKED / NOT RUN separately, with evidence and scope qualifications.
- `evidence/baseline/`: exact commands/logs/results, initial failed attempts and corrected reruns, native screenshot, debug smoke samples; `evidence/environment.json` records hardware/toolchain/binary hashes.

## Findings that change the next step

**33:1080 is no longer the wrong diagnostics frame.** Fresh metadata and a natural 1440×900 export show baseline/candidate comparison. The old handoff/capture-state claim is stale. No frame was overwritten. The current Figma header says Binance Futures while the saved source says Spot; typography/geometry also differ. Review `evidence/figma-33-1080.png`, `comparison-source-overlay.png`, `comparison-source-diff.png` and `comparison-diff-metrics.json`. These compare Figma to source, not actual product parity, and use no masks.

Only that natural Figma export was obtainable before current Starter quota rejection. The other 24 original exports and full node/font/component/variable/prototype reads remain unavailable. Saved `figma-proof.png` and `figma-first-launch-proof.png` were inspected: they are zoomed browser-canvas screenshots, not natural frame exports. Their format/navigation content differs from later sources. Every supplied source arrangement was inspected through browser-harness and two contact sheets; none is substituted for an approved Figma export.

The earlier 35-screen editor-first draft has Inter/JetBrains Mono, earlier Violet tokens and a WinUI sequence. It is preserved for lineage/component discovery and explicitly superseded; do not replay its construction/finalization requests. Prepared V2 tokens are labelled unapproved, their capability milestone numbers conflict with the governing brief, and source control radii differ from prepared tokens. Current source needs menu, state, preference, compact/accessibility and feature-scope reviews.

Phase 1 remains a working local Tauri/React/Rust import/save/restore slice. It is visibly unlike V2 and implements seven local commands, not the V2 workstation. Design examples and linked prototype routes do not implement imports/jobs/providers/evidence. The prerequisite commit adopted `zt-domain` plus workspace membership/lock only; no unrelated WinUI, risk, development, Python-requirements, lint or TypeScript edits were included.

## Fresh baseline

Code baseline: **`4040781e142dd44ab1c537941935c79011467037`**, branch `codex/auth-drawing-rebuild`. Tracked sources were exported to a new temporary directory; ignored local design assets and all unrelated dirty files were excluded from build/tests. Node v22.23.2, npm 10.9.8, Rust/Cargo 1.99.0, Windows 11 Pro build 26200, i5-1335U, approximately 8 GB RAM, Intel UHD. Exact source/tool/binary identity is in the environment and dependency records.

**PASS:** locked install; five domain tests; five local storage tests; 92 Rust workspace tests (includes domain); one Tauri command-origin test; 204 web tests after Prisma generation; TypeScript/lint; Next production build; Vite/local Windows release build; 33 existing helper tests with prepared embedded Python; actual native offline/import/rejection/save/reload/source-removal/process-restart. Native test uses separate validation storage and real Tauri IPC. Product identifier rebuilt afterward.

**FAIL attempts retained:** initial web tests lacked generated Prisma client (runner fixed; 204 passed afterward). Venv helper run had five failures out of 33 because the venv launcher spawns a second process rejected by `ActiveProcessLimit=1` (minimal reproducer and supported embedded-interpreter rerun retained). Native UI/V2 mismatch, compact source naming and token/reference conflicts are actual unresolved baseline gaps. Production dependency audit has 14 advisories (11 high/1 critical/2 moderate); no automatic dependency upgrade was applied.

**BLOCKED:** approved original reference/control-state freeze, full Figma structural audit, exact missing menu/state/scope decisions and fixed Windows reference/performance policy.

**NOT RUN:** native fixed 100/150/200% visual parity set, full V2 actions, deployed web end-to-end checks, new perpetual/replay/isolation models, multi-monitor/Narrator/IME/long-session checks, 1m retained-history release performance and installation/upgrade/uninstall/offline-missing-runtime gates.

The native screenshot is **1800×1055 physical client pixels under current desktop conditions**, not a fixed reference-size parity capture. Network emulation is WebView-only, not OS firewall isolation. Wheel range persistence is asserted; pan/crosshair compositor input was delivered, but crosshair numeric correctness was not independently asserted. Original file deletion and OS restart are separate from reload. Python runtime reuse is qualified: parent imported clean sources; child runtime path points to original helper sources whose exact hashes match the clean commit; this is not fresh runtime installation acceptance.

The local unsigned baseline executable is `C:/Users/aykhank/Desktop/Others/Projects/ZT/out/windows-v2-m0/zterminal-desktop.exe` (10,610,688 bytes; SHA-256 `68b59637bd3b08bce0b6a54d83e15d81e0d094737b52a141e55512ddd120f937`). Launching it uses the normal product storage identifier; validation used a separate identifier. No installer was produced. The source export path is retained in `evidence/clean-checkout-path.txt`.

Five debug smoke samples retain the full distribution, including a 4,850.94ms create outlier. They measure 10k labelled fixture rows/2k scene/new process per operation amid baseline work. They do not accept release startup or frame-time budgets. Proposed budgets/hardware/sample policy are D18, awaiting review.

## Reproduce without unrelated local edits

In a new empty directory, export exactly the prerequisite commit (or make a normal clean checkout of it). Preserve user work; do not reset the existing checkout.

```powershell
New-Item -ItemType Directory -Path C:\Path\To\Fresh\Checkout
git -C C:\Users\aykhank\Desktop\Others\Projects\ZT archive 4040781e142dd44ab1c537941935c79011467037 -o C:\Path\To\Fresh\source.tar
tar -xf C:\Path\To\Fresh\source.tar -C C:\Path\To\Fresh\Checkout
# Run these audit scripts from the review commit against that source checkout:
& docs/windows/v2/run-baseline.ps1 -Checkout C:\Path\To\Fresh\Checkout -Evidence C:\Path\To\Fresh\Evidence
& docs/windows/v2/run-native-baseline.ps1 -Checkout C:\Path\To\Fresh\Checkout -Evidence C:\Path\To\Fresh\Evidence
# Further foundational check executed independently:
Set-Location C:\Path\To\Fresh\Checkout
cargo test --locked --workspace
```

`run-baseline.ps1` now generates Prisma before web tests. Native checks require Windows/WebView2, installed browser-harness and Python; they preserve recording-off preference, use separate validation storage, refuse to reset non-test workspaces, and rebuild the normal product identifier in `finally`. They do not install/release anything. Do not run concurrent native rebuilds while an executable from the same output path is open.

Existing helper tests require the prepared **embedded** Python interpreter (3.12.10/vectorbt 0.28.1, identities recorded), not the venv launcher under the one-process job limit. Import the clean helper directory at the front of `sys.path` before loading `test_engine`, `test_helper`, `test_child`; verify child helper source hashes match the clean commit. `evidence/python-runtime-identity.json` and `python-runtime-freeze.txt` qualify the reused runtime; the venv package freeze is not an embedded-install acceptance claim. Building a fresh bundled runtime is a later distribution gate.

`evidence/embedded-runtime-dependencies.json` independently verifies that all 58 locked embedded-runtime packages match their specified versions. That establishes the reused test interpreter's dependency identity, not a clean-machine installation pass.

For source review, extract `evidence/design-source.zip` into a new local directory and run its `server.cjs` on 8765. Never replay the capture IDs or construction payloads. `capture-source-inventory.py` and `generate-inventory.py` expect the original artifact directory; restore the reviewed snapshot there only in a disposable checkout if it is absent. Source captures are labelled examples, not product test results.

## Restart handoff

Before any continuation, read this packet, current Git diff, manifest, governing brief and prior test failures. Preserve unrelated baseline paths in `evidence/user-working-tree-baseline.txt`; only the domain prerequisite was incorporated. No new Figma/Penpot file or edit exists to approve. Review the supplied candidates and D01–D04 plus relevant M1 policies first. The next independently testable milestone is **M1 — V2 shell**, only after the M0 design/reference acceptance gate is cleared and the user dispatches it. Stop here.
