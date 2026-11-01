# ZTerminal audit fixes — 2026-10-20

**11 audit findings addressed; local validation PASS. Whole-product and deployed acceptance remain PARTIAL.**

Scope: C01–C06, P01–P03 and B01–B02 in the retained original audit `artifacts/codebase-speed-audit-2026-10-20/findings.csv`. This pass did not deploy, stage, commit, reset, trade, alter production data or resume unrelated paused repair phases.

## Changes

- **C01–C05:** deleted the exact 39 unreferenced files identified by the audit (33 UI scaffold files, device frame pair, two desktop cards, HeroCanvas and unused motion hook): **4,356 physical source lines**. Referenced components/examples remain. `removed-files.zip` backs up removed sources and original package manifests/locks.
- **C06:** removed 39 unused root dependency declarations (25 UI-only plus 14 others). npm's remaining package versions were preserved. The already-stale Bun lockfile was regenerated from npm's lock and passes a frozen offline check. Transitive packages can remain. Only the legacy quant service's unused Nautilus dependency was removed; the separate optional event runtime's pin remains.
- **P01:** standard-library bounded LRU caches reuse small RFC 8785 scalar encodings and UTF-16 key encodings; large strings bypass caches. Existing RFC encoding remains authoritative for scalar bytes, numbers and invalid values. Engine and archive share `validation.digest`. The archive still independently validates source, input, dataset, accounting, evidence and result identities. No trust-boundary validation or hash contract was removed. Existing Helper packaging already includes the changed module.
- **P02:** best quote scans each book side once; sorted depth presentation remains unchanged. Regression coverage includes unordered insertion, replacement/deletion, empty sides, not-ready/reset and 200 deterministic randomized updates against sorted depth. Existing gap/crossing checks pass.
- **P03:** creates the six-field JSON identity expression index on archive open. Explicit `ORDER BY rowid LIMIT 1` preserves the original first-inserted duplicate match. Migration/reopen/query-plan/reverse-hash-order checks pass.
- **B01:** native test builds now copy required font assets. Initialization failure stops the test cleanly; zoom ignores calls after renderer shutdown. Removing a font now yields exit 1 instead of a crash. Release and Debug suites pass with assets.
- **B02:** replaced a quant adapter that ignored source and returned fixed performance figures with the service's existing owned position simulator, next-open delayed supplied signals and computed metrics. Rejects missing/invalid timestamp, OHLCV, config, parameter-grid and signal inputs. Unimplemented purged CV/DSR and tick simulation now raise explicit unavailable errors. Fixed the zero-second timeout boundary. The legacy service remains separate from the current Helper. Its bar model is not a tick/queue engine; arbitrary Python runs in-process and its limiter is cooperative around strategy execution, not a secure sandbox or hard interruption mechanism.

## Measurements

Alternating reference/candidate runs used identical fixed data in one process after installation and compilation completed. Three runs per implementation used fresh disposable archives and full archive validation. Input hashes and stable output hashes matched in all six runs. Only UUIDs/timestamps were excluded from the stable-output comparison; exact canonical bytes were separately checked against RFC 8785 across thousands of finite float, Unicode, cache type and invalid-value cases.

| Operation | Reference median | Candidate median |
| --- | ---: | ---: |
| 100k-bar engine | 7.379s | 5.958s |
| 100k-bar archive save | 7.161s | 5.544s |
| Per-run engine + archive | 14.494s | 11.556s |
| Quote, 1k levels per side | 0.2449ms | 0.0082ms |
| Quote, 10k levels per side | 3.0363ms | 0.2180ms |
| Dataset lookup, 10k metadata rows | 10.391ms | 1.327ms |

Median per-run engine plus archive time fell **20.3%**, meeting the proposed 20% target. Median combined time is calculated from each paired engine+save run, not by adding independent medians. Quote lookup is 29.8x faster at 1k levels and 13.9x at 10k. Dataset lookup is 7.8x faster including opening a connection each time; index creation took 22.1ms on that metadata fixture. These are bounded operation measurements, not overall application/browser speedups or statistical guarantees. A slower JSON/regex experiment was rejected and not shipped.

## Verification

| Check | Result |
| --- | --- |
| TypeScript | PASS: 341/341 tests; typecheck with no emit/incremental disabled |
| Scoped lint | PASS: 0 errors, same 10 pre-existing unused-disable warnings; final changed-test lint clean |
| Production build | PASS: isolated current-source Next 16.3.6 build, types and prerender |
| Clean dependency install | PASS: offline npm ci, 846 packages; lifecycle scripts disabled |
| Bun lock | PASS: frozen offline check |
| Desktop Python | PASS: 71 run, 65 passed, 6 optional-runtime skips |
| Optional event runtime | PASS: 15/15 |
| Research API | PASS: 8/8 |
| Legacy quant service | PASS: 12/12; next-open accounting, source-dependent output, malformed inputs, queue lifecycle, timeout and unavailable adapters |
| Native | PASS: 3/3 Release, 3/3 Debug; missing font exits cleanly |
| Import graph | PASS: no remaining consumers of removed modules/declarations; unresolved CSS imports are existing TS resolver limitations |
| Live gateway | PASS: 90-second real Gate observation, 792 trades, 753 depth events, 2272 quotes, two cycles; no errors; no active symbols after disconnect |
| Browser research | PASS: real production guest UI + isolated Helper; 2,160 bars, 40 trades; one durable result and displayed report |
| Browser cancellation | PASS: actual Helper job observed and cancelled through UI; no extra committed result |
| Browser reopen | PASS: reload and Helper restart, re-pair, select exact archived result with market/history requests blocked; Helper fetch and displayed report confirmed |
| Landing | PASS: foreground hero screenshot visually inspected; reduced-motion media matched; offscreen lazy images not certified |
| Preservation | PASS: only intended finding/test/lock files changed; Git index unchanged |

The Helper's token is deliberately memory-only; reload requires pairing again, which was preserved. The isolated guest candidate has no production auth configuration or configured browser market-gateway origin, so authenticated journeys and browser live Level 2 are not certified. The separate live gateway client probe exercises the changed book logic. Full foreground WinUI import/save/restore, Rust/Tauri platform journeys, remote Redis/PostgreSQL, release packaging/signing and deployment remain **NOT TESTED** in this fix pass. Existing lint warnings/optional skips remain. This does not claim every possible ZTerminal defect is eliminated.

## Evidence and rollback

Evidence is in `artifacts/codebase-speed-fixes-2026-10-20/evidence/`: `research-comparison.json`, `performance-summary.json`, `market-bench.json`, `dataset-query.json`, test/build/install logs, `browser-research.json`, `browser-local-cancel.json`, `browser-reopen.json`, `browser-landing.png`, `import-graph.json` and `preservation-final.json`. `fixes.csv` maps all 11 findings. Original audit reports/results were not rewritten. The diagnostic asset staging touched the original audit's ignored native build folder only.

Rollback selectively; do not reset the dirty repository. Restore removed sources and package manifest/locks together from `removed-files.zip` if undoing cleanup. The new index can be dropped independently. Persisted hash contract versions are unchanged. Temporary browser tab and owned servers were stopped; disposable archives remain as evidence.
