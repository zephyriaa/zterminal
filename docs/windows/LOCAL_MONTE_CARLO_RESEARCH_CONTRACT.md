# Local Monte Carlo Research Contract

**Status:** Initial native research-engine contract. This capability performs deterministic, bounded scenario analysis from caller-supplied local bars only. It has no data transport, provider selection, cloud synchronization, code execution, account access, broker action, or order-routing behavior.

> A Monte Carlo result is a reproducible transformation of verified local history, not a forecast, recommendation, probability of profit, or execution instruction.

## Input eligibility

| Requirement | Enforcement |
|---|---|
| Local source | The function accepts in-memory bars supplied by the local replay/cache path; it does not accept URLs, sockets, or provider identifiers. |
| Provenance | Every input bar must have `DataStatus::Live`. A stale, unavailable, or gap-marked bar withholds the entire run. |
| Continuity | Bars must represent one symbol and interval with exact consecutive open times. A missing interval halts research rather than inventing a return. |
| Minimum data | At least two eligible bars are required to derive one observed close-to-close return. |
| Bounds | The request carries explicit source, simulation, horizon, and total-work limits. Invalid or oversized requests fail before scenario allocation. |
| Reproducibility | A caller-selected non-zero seed drives a specified local integer PRNG. Equivalent bars and request values return identical ordered summaries. |

## Simulation method

The engine derives **integer close-to-close additive basis-point returns** from observed local bars. Each scenario draws exactly `horizon_bars` returns with replacement from that verified return set using a deterministic xorshift64 generator. The engine retains only bounded scenario sums and computes minimum, 5th percentile, median, 95th percentile, maximum, and arithmetic mean return in basis points.

The result intentionally does not synthesize candles, create a price path, estimate fill probability, model slippage, infer a market regime, or claim a calibrated distribution. Integer basis-point aggregation is selected for reproducibility and bounded arithmetic, and it must be labelled accordingly in any user interface.

## Terminal outcomes

| Outcome | Meaning |
|---|---|
| `complete` | Every requested scenario was calculated from one contiguous, `Live`, bounded local source. |
| `withheld` | A gap, degraded data status, wrong symbol/interval, nonconsecutive timestamp, or insufficient verified source prevents a research result. |
| `invalid_request` | A zero, excessive, or overflow-risking source/simulation/horizon/seed request was rejected before simulation. |

## Reproducibility record

A complete result must carry the algorithm version, seed, source bar count, derived return count, simulation count, horizon, and basis-point summary. It must not include raw source prices, account data, credentials, provider payloads, or remote identifiers. A UI may persist this record locally with the workspace journal only after local workspace schema integration is separately approved.

## Explicit exclusions

This contract does not implement strategy execution, portfolio sizing, optimization, historical backtesting, live pricing, public data download, model calibration, transaction-cost estimation, cloud sharing, broker connectivity, or investment advice. Persistent strategy runtimes and local Python sandboxing remain separate future gates.
