# B1 Deterministic Backtest Evidence Validation

**Scope:** recovery branch only; no production deployment or promotion occurred. The B1 evaluator is a browser-local, dedicated Worker that computes a deterministic historical research package from the already verified chart window. It has no broker, order-routing, arbitrary-code, network-from-source, or cloud-persistence capability.

## B1 Execution Contract

| Control | Enforced behavior |
|---|---|
| Dataset | Normalizes and deduplicates bars, rejects malformed bars, carries selected Gate.io provenance, coverage, timestamp, and dataset fingerprint |
| Signal and fill | The fixed EMA 20/50 + loaded-window VWAP template observes signals at close and fills only at the **next** bar open |
| Costs | Capital, quantity, multiplier, commission per unit, spread ticks, slippage ticks, and tick size are explicit and included in run identity and per-trade evidence |
| Protocol class | A locked baseline yields `BASELINE · NO OPTIMIZATION`; a staged single-variable change yields `INCREMENTAL · ONE VARIABLE` with its declared changed field |
| Identity | Deterministic FNV-1a run hash includes engine/strategy version, source fingerprint, ordered parameters, selected data provenance/fingerprint, classification, execution model, and costs |
| Package | Returns status, run ID/hash, engine version, provenance, trades, markers, equity, drawdown, monthly outcomes, metrics, and limitations |
| Terminal position | A final-close terminal mark is expressly distinguished from a modeled next-bar market fill |
| Non-blocking UX | The evidence run is executed through a dedicated browser Worker; the chart drawer remains responsive while it runs |

## Local Browser Evidence

On the local integrated workstation on 2026-08-18:

- A locked browser-local cited baseline unlocked the **Backtest** tab. It displayed capital, quantity, multiplier, commission, spread, slippage, and tick-size controls, plus a `Show entry / exit markers` toggle.
- The verified Gate.io `QQQX_USDT · 15m` window contained 97 bars. Running it returned the feedback `Historical evidence bt_a-44c01a09 completed in the dedicated browser worker.`
- The rendered evidence package was classified `BASELINE · NO OPTIMIZATION`, included the locked baseline fingerprint, engine `1.1.0`, deterministic run hash `fnv1a-44c01a09`, 97 normalized bars, complete selected coverage, source timestamp, zero rejected bars, and zero deduplicated bars.
- The panel displayed Net P&L, return, maximum drawdown, trade count, monthly outcome, individual trade timing/P&L/costs, and its research-only limitation statement. The tested window returned three listed next-open exits; it did not produce an execution or broker interface.
- Chart marker metadata was returned with the evidence package and passed through the workstation chart contract. Turning the `Show entry / exit markers` control off hid the chart annotations while retaining the complete evidence package. Markers remain opt-in and are not trading controls.

## Automated Quality Gates

| Gate | Result |
|---|---|
| Determinism, next-bar fill order, commission/spread/slippage accounting | Passed |
| Provenance, baseline/increment classification, monthly outcomes, drawdown, marker alignment | Passed |
| Insufficient data, source/parameter/cost run identity, normalization, terminal-mark disclosure | Passed |
| `pnpm check` after worker, marker, drawer, and chart integration | Passed |
| Full `pnpm test` | Passed: 15 files, 49 tests |
| `pnpm build` | Passed; dedicated `backtest.worker` bundle emitted |

**B1 is complete on the recovery branch pending commit.** B1 does not claim a predictive edge. Walk-forward testing, Monte Carlo, parameter optimization, arbitrary compiled-source evaluation, stop/limit simulation, and future-performance prediction remain out of scope.
