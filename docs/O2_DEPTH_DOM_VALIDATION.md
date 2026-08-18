# O2 Honest Order-Flow Foundation Validation

**Scope:** recovery branch only; no production deployment or promotion occurred.

## Implemented Surface

| Study | Source and calculation | Visible non-live behavior | Explicit limitation |
|---|---|---|---|
| CVD | Exchange-reported signed size across the current bounded public trade tape | No plotted data when tape is not `LIVE` | Not candle-derived and not a historical tick archive |
| Live DOM | Gate.io REST `with_id=true` snapshot reconciled with sequenced public depth deltas | No levels rendered while connecting, syncing, stale, degraded, or unavailable | No historical depth |
| Time & Sales | Ordered rows from the current bounded public trade tape; buy/sell follows Gate.io signed taker size | No rows rendered while the tape is not `LIVE` | No historical ticks |
| Live footprint | Exact-price buy, sell, and delta aggregation over the current bounded public trade tape | No footprint rows rendered while the tape is not `LIVE` | Not candle volume and not historical footprint |

The DOM manager is bounded and read-only. It starts an exchange WebSocket subscription, buffers deltas while requesting a REST snapshot, exposes levels only if an update contains `snapshot.id + 1`, and rejects a sequence gap rather than constructing an unverified local book.

## Local Browser Evidence

On the local integrated workstation on 2026-08-18:

- The Studies drawer showed **Live DOM**, **Time & Sales**, and **Live footprint** as independent, disabled-by-default flow studies. Each study description stated its provider and current bounded/live-only scope.
- Before public-depth reconciliation, Live DOM displayed **DEGRADED** and `Depth not rendered`, with no bid or ask levels. Once reconciled, it displayed **LIVE**, bid and ask levels, an exchange update ID, a live-age label, and `No historical depth`.
- Time & Sales initially displayed a safe **DEGRADED** state with `Tape not rendered`. When public trade events arrived, it changed to **LIVE** and showed timestamped rows with exchange-reported signed direction and size, plus `No historical ticks`.
- Live footprint showed **LIVE** only after the same bounded tape was live. It displayed exact trade prices, buy size, sell size, signed delta, and `Not candle volume`.
- The historical chart, research drawer, execution-disabled footer, and provider attribution remained intact. The public-tape query is enabled once for any of CVD, Time & Sales, or footprint, so these panels do not start redundant stream families.

## Contract and Quality Gates

| Gate | Result |
|---|---|
| Depth snapshot/delta reconciliation, gap rejection, stale, unsupported-symbol tests | Passed: 4 tests |
| Pure CVD, Time & Sales, and footprint trade-semantics tests | Passed: 5 tests |
| Study capability source/gating tests | Passed: 3 tests |
| `pnpm check` | Passed |
| Full `pnpm test` | Passed: 13 files, 39 tests |
| `pnpm build` | Passed |

**O2 is complete on the recovery branch.** It is not production-promoted. The next planned vertical slice is **R1 — protocol-led research workflow**; deployment remains subject to later security and release-gate review.
