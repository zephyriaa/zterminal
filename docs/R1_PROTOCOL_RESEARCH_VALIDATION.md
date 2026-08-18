# R1 Protocol-Led Research Validation

**Scope:** recovery branch only; no production deployment or promotion occurred. Protocol state is intentionally **browser-local** until the planned storage and authentication configuration is available.

## Ported Domain Contract

The former shallow hypothesis form has been replaced at the rendered workstation surface by a chart-context **Evidence Lab** with exactly three contextual tabs: **Hypothesis**, **Strategy**, and **Backtest**. Strategy compilation and historical evaluation remain visibly gated by their later R2 and B1 slices; no arbitrary code execution, strategy execution, or backtest result was enabled in R1.

| Control | Enforced behavior |
|---|---|
| Citation | Requires title, author/organization, historical year, typed reference, and retained source text before rule extraction can advance |
| Rule scope | Requires one fixed entry, exit, and sizing rule; rejects optimization, parameter ranges, undeclared filters, multi-timeframe/regime logic, alternatives, and ambiguous wording |
| Data contract | Binds the protocol to the selected verified chart dataset, including provider, symbol, interval, coverage, bar count, source timestamp, and fingerprint |
| Baseline | Creates a deterministic FNV-1a fingerprint only when citation, scope, complete data, explicit execution/cost model, capital, and size gates pass; locks only after a human checkbox approval |
| Incremental research | Retains the locked snapshot and permits staging only one declared changed variable with before/after values and rationale; staged work is labeled **not evaluated** |

## Local Browser Evidence

On the local integrated workstation on 2026-08-18:

- An empty protocol opened in `NEEDS SOURCE` with visible citation, rule-scope, and baseline blockers; it did not expose a generated strategy or evaluation button.
- A retained URL source with title, organization, year, reference, source text, one exact entry rule, one exact exit rule, and one exact sizing rule progressed to `READY FOR APPROVAL`. The selected Gate.io historical dataset was displayed as `QQQX_USDT · 15m`, with complete coverage and a dataset fingerprint.
- The candidate baseline showed a deterministic fingerprint. It could not be locked until the explicit human approval checkbox was set.
- After approval, the drawer displayed `BASELINE LOCKED`, the immutable browser-local fingerprint, the retained snapshot, and disabled original source/rule inputs.
- A changed sizing proposal with a rationale staged as `Increment staged — not evaluated`; the original locked sizing rule remained visible as the baseline value.
- Strategy and Backtest tabs accurately stated their future, separately gated R2/B1 status. The chart remained visible, and the execution-disabled footer remained intact.

## Quality Gates

| Gate | Result |
|---|---|
| Citation, scope, data-requirement, fingerprint, approval, immutability, and one-variable contract tests | Passed: 4 tests |
| `pnpm check` | Passed |
| Full `pnpm test` | Passed: 14 files, 43 tests |
| `pnpm build` | Passed |

The R1 workflow is not a durable cloud workspace and does not claim that browser-local protocol artifacts are synced or recoverable outside the current browser. **R1 is complete on the recovery branch pending commit.** The next active recovery slice is R2, which will introduce a closed strategy compiler with explicit no-escape security tests.
