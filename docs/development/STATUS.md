# Development status — 2026-09-30

Current milestone: Helper-owned Validation Engine certification. Phase 1 remains active until final reproduction/browser and adversarial gates are finished.

| Capability | Evidence and status |
| --- | --- |
| Exact Python execution | Real local CPython Helper, Python 3.12 suites and authenticated browser backtest pass on explicitly simulated candles. |
| ResearchRun persistence / reproduction | Paired browser reproduction, hashed persistent parent link, runtime/numerical comparison and restart/reopen pass. Divergent reproduction is explicitly marked in an authenticated CPython integration test. |
| Provenance | SHA-256 source, dataset, input, result contracts exist; validation linkage checks added in this milestone. |
| Chronological OOS | Fresh exact-source disjoint cold-start runs and checked links; paired browser flow passes. Researcher selection and arbitrary Python causal logic remain unsealed. |
| Walk-forward | Real independent rolling training/test executions; disjoint tests, explicit purge/state policy, optional training-only grid selection. Future-price and indicator warm-up traps pass. |
| Monte Carlo | Helper computes seeded, named additive-PnL permutation/IID methods; fixed permutation terminal equity and DD-threshold interpretation documented and tested. |
| Parameter sensitivity | Measured two-numeric-parameter CPython grid; stable/spike fixtures and actual browser heatmap pass. |
| Cost stress | Exact-source fee/slippage/sizing/fill reruns, full equity metrics and sampled crossing bracket; no invented break-even estimate. |
| Regime / concentration | Prior-closed-bar trailing volatility/EMA grouping with Unknown; gross-winning-PnL denominator, chronological streaks, monthly/side attribution, sample coverage. Causality-prefix and concentration fixtures pass. |
| Research report | Helper-owned artifact, Summary/OOS/WFO/MC/Sensitivity/Costs/Regimes/Concentration/Diagnostics/Provenance tabs; real desktop/narrow browser battery, Helper restart and same-artifact reopen pass. |
| Account/auth | Shared public/terminal session code exists; current auth E2E not rerun. |
| Cloudflare build / public deployment | Workflow and Worker config exist; build and production state not verified this session. No deployment performed. |
| Market feeds | Gate.io/Binance browser feeds and integrity tests exist; live feeds not verified. |
| Desktop/local runtime | Windows Helper, fresh CPython variants and local archive exercised through authenticated API/browser. Tauri packaging not recertified. |

Current evidence: `npm test` 197/197, `npm run typecheck` pass, latest `npm run build` pass including successful Prisma generation, changed-file ESLint pass. `npm run test:python`: 66 Helper tests (6 skipped) and 8 API tests pass on Python 3.12, including relative high-volatility dependence and divergent reproduction. Old browser-only validator tests were replaced by actual CPython strategy fixtures and client authority tests, explaining the reduced TS count. Prior terminal smoke passes at 1440/768/390 px. Repository-wide lint previously exhausted the Node heap at ~2 GB and 4 GB; this is not recorded as a pass.

Independent review first found fabricated sensitivity, weak archive admission, overclaimed OOS/WFO, misleading permutation terminal probabilities and an invented break-even point. The new Helper implementation replaces these paths. Subsequent review found legacy v3 rows hiding valid v4 reports and nullable UI percentages; both repaired with tests. Final independent read-only review found no remaining release-blocking flaw in the integrated validation/reproduction paths, while expressly retaining arbitrary-Python/local-trust limitations.

`npm run test:validation` passes at `http://localhost:3000`, desktop 1440×1000 and narrow 390×844: unpaired backtest disabled, exact-source paired backtest, 46-run battery including training-only grid selection, hashed reproduction, actual Helper restart, same saved validation reopen, and visible disconnected failure. Evidence: ignored `artifacts/validation/validation-summary.json` and PNGs. Zero uncaught browser exceptions. Console records expected unpaired 403s, unavailable installer 503s and disconnected requests, plus existing CSP-blocked localhost:3003 market socket attempts; live market service is not certified by this test.

Interpretation guard: the later segment is independently executed but not a sealed researcher holdout. The profile therefore withholds a strong/moderate/weak OOS rating and emits a selection warning. Fewer than 20 later-period closed trades produces a separate thin-sample warning.

The Phase 1 development checkpoint meets the implemented validation flow and its local test/build/browser gates with the documented methodology limits. Independent review found no remaining release-blocking issue in these paths. The broader product goal remains active. Next: Phase 2, a self-contained evidence export containing the checked source run, validation and linked executions; no deployment, production migration or push follows from this checkpoint. Public research-page historical claims and private package recertification remain follow-up audit items.
