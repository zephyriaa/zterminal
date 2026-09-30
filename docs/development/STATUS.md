# Development status — 2026-09-30

Current milestone: Phase 1 integrity repair. Phase 1 must not be described as complete or as certified walk-forward optimization.

| Capability | Evidence and status |
| --- | --- |
| Exact Python execution | Real local CPython Helper path and integrity tests exist; Python 3.12 suites pass. Live paired Helper workflow not verified this session. |
| ResearchRun persistence / reproduction | Local SQLite archive and linked reproduction path exist; covered by repository tests, not live-verified this session. |
| Provenance | SHA-256 source, dataset, input, result contracts exist; validation linkage checks added in this milestone. |
| Chronological OOS | Exact source and parameters now run separately on disjoint earlier/later candle datasets in the local Helper; linked run identities are checked by the archive. Human strategy selection is not sealed from later data. Live browser success flow unverified. |
| Walk-forward | Rolling-window attribution exists; no training-only optimization or independent forward execution. Incomplete. |
| Monte Carlo | Seeded trade permutation and IID resampling exist; interpretation of additive-PnL terminal distributions needs correction. |
| Parameter sensitivity | Former synthetic heatmap disabled; exact-source sweep missing. |
| Cost stress | Post-trade PnL haircut exists; exact-source friction reruns missing. |
| Regime / concentration | Deterministic post-run summaries exist; entry timestamp mapping and edge cases need audit. |
| Research report | Validation tabs exist, but archive admission fails closed because metrics are browser-computed. Terminal browser smoke passes at 1440/768/390 px; validation success flow is blocked pending Helper-authoritative computation. |
| Account/auth | Shared public/terminal session code exists; current auth E2E not rerun. |
| Cloudflare build / public deployment | Workflow and Worker config exist; build and production state not verified this session. No deployment performed. |
| Market feeds | Gate.io/Binance browser feeds and integrity tests exist; live feeds not verified. |
| Desktop/local runtime | Windows Helper, Tauri, and local archive exist; Python 3.12 tests pass. Paired runtime workflow not exercised. |

Current evidence: `npm test` 206/206, `npm run typecheck` pass, `npm run build` pass, targeted ESLint pass, archive admission and real CPython holdout linkage tests pass, `npm run test:python` 48 Helper tests (6 skipped) and 8 API tests pass on Python 3.12, and `npm run test:terminal` passes at 1440/768/390 px. Repository-wide `npm run lint` exhausts the Node heap at both ~2 GB and 4 GB. The script now uses the pinned desktop lockfile and fails nonzero on installation or test errors.

Independent read-only review found fabricated sensitivity, weak archive admission, overclaimed OOS/walk-forward, misleading permutation terminal probabilities, and a fabricated +100 bps break-even point. The immediate false evidence paths have been disabled or corrected. Exact-source disjoint chronological reruns are implemented. A second independent review found that the archive could still seal arbitrary client-computed metrics beside genuine linked runs; archive admission and display of old unverified validations now fail explicitly. Phase 1 remains blocked on Helper-authoritative quantitative computation and verification, then train-only walk-forward windows, exact-source sensitivity and cost variants, methodology, and the full browser flow.

Subsequent quantitative cleanup: drawdown, loss streak, and Monte Carlo input order now use trade exit chronology regardless of archive array order. The report no longer compares total returns from unequal IS/OOS durations as a degradation figure. Targeted validation tests, typecheck, and changed-file ESLint pass after this change.

Interpretation guard: the later segment is independently executed but not a sealed researcher holdout. The profile therefore withholds a strong/moderate/weak OOS rating and emits a selection warning. Fewer than 20 later-period closed trades produces a separate thin-sample warning.
