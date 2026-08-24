# Native Local Monte Carlo Handoff Contract

**Status:** Internal Track B native-host integration contract. A native local chart request may additionally request one bounded Monte Carlo summary from the packaged `zt-local-monte-carlo.exe` sidecar. The chart and research paths use the same explicit local root, normalized symbol, interval, segment start, and freshness budget.

> Research is optional and never changes the loaded candle window. A withheld or bridge-failure research result does not turn local candles into a different source, manufacture a summary, or initiate a provider recovery.

## Host activation

The host invokes research only when all three explicit options are present with valid bounded values.

| Option | Native host bound |
|---|---|
| `--local-monte-carlo-simulations=` | Integer from `1` through `10,000`. |
| `--local-monte-carlo-horizon-bars=` | Integer from `1` through `1,000`. |
| `--local-monte-carlo-seed=` | Non-zero unsigned integer. |

The host rejects a partial, zero, excessive, or total-work-overflowing request before launching the sidecar. The total draw budget is at most `1,000,000`. There is no implicit default request; omitting all three options leaves research as **not requested**.

## Sidecar boundary and outcomes

The native bridge starts only `zt-local-monte-carlo.exe` from the host’s own package directory. It captures output in a temporary local file, waits at most 15 seconds, validates schema version 1, availability, bounded counts, and ordered integer percentile fields, then deletes the temporary output file.

| Native result | Chart behavior | Diagnostics/title behavior |
|---|---|---|
| `LOCAL MC COMPLETE` | Retains the verified local candle window. | Shows median, 5th percentile, and 95th percentile additive basis-point summaries; records only aggregate counts and median in the host diagnostic. |
| `LOCAL MC WITHHELD` | Retains the verified local candle window, if one was already safe to render. | Surfaces a withholding status; no summary values are invented. |
| `LOCAL MC BRIDGE FAILURE` | Retains the verified local candle window, if one was already safe to render. | Surfaces a bridge-failure status. No fallback process, remote service, or retry is used. |
| `RESEARCH NOT REQUESTED` | Leaves the chart path unchanged. | Emits no research result. |

The bridge rejects a non-`Live`/non-`Cached` complete response, non-positive seed/counts, source counts inconsistent with returns, result values outside the declared work bounds, unordered percentile summary values, malformed JSON, non-zero child exit status, and process timeouts.

## Product and data boundaries

This native handoff is local research only. It opens no network connection and does not use Render, cloud synchronization, provider fallback, account data, strategy execution, broker routing, order submission, calibration, forecasting, or user credentials. Diagnostics exclude raw candles and raw provider frames. The result is a deterministic summary under the algorithm definition in [`LOCAL_MONTE_CARLO_RESEARCH_CONTRACT.md`](LOCAL_MONTE_CARLO_RESEARCH_CONTRACT.md), not investment advice or an execution instruction.
