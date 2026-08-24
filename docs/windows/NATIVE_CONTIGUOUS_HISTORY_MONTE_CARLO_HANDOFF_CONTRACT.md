# Native Contiguous-History Monte Carlo Handoff Contract

**Status:** Internal Track B native-research handoff contract. The Win32 host may request a bounded local history Monte Carlo analysis only after an explicit local chart scene is already renderable. The host forwards the chart request’s explicit local root, symbol, interval, starting immutable segment, and freshness budget to the packaged `zt-local-monte-carlo.exe` sidecar together with all three research bounds and an optional exact history count.

> The native chart is never evidence that the next cataloged local segment is contiguous. A multi-segment research result is accepted only when the local research sidecar independently proves every selected immutable record and every decoded time boundary. The host displays the returned segment count rather than inferring it from chart navigation.

## Activation and validation

The existing native parameters `--local-monte-carlo-simulations`, `--local-monte-carlo-horizon-bars`, and `--local-monte-carlo-seed` remain all-or-nothing. `--local-monte-carlo-history-segments` is optional only when those three parameters are present; it defaults to `1` and must be from `1` through `16`. A partial, zero, overflowed, or out-of-range request sets **LOCAL MC BRIDGE FAILURE** while retaining the already verified local chart.

The bridge passes `--history-segments` explicitly on every successful research request. It accepts a complete result only when its schema, bounded summary fields, and `source_segments` field are valid and `source_segments` equals the host’s requested history count. A mismatch is a bridge failure, not a partial analysis.

## Outcomes

| Sidecar outcome | Native behavior |
|---|---|
| `complete` with matching source count | Keeps the verified local chart and shows **LOCAL MC COMPLETE**, the actual segment count, and aggregate median/P05/P95 basis-point summary. |
| `withheld` | Keeps the verified local chart and shows **LOCAL MC WITHHELD**; no scenario summary is displayed. |
| Bridge/parser/time-bound failure | Keeps the verified local chart and shows **LOCAL MC BRIDGE FAILURE**. |
| Cross-segment chart navigation | Clears the earlier summary because it was bound to a different immutable starting segment; no recomputation is automatic. |

The diagnostic record contains only aggregate research fields, including requested/accepted source segment count. It never records raw bars, payloads, provider frames, account data, credentials, or a forecast.

## Boundary

The handoff invokes a packaged local child process with its existing finite wait and temporary-output cleanup. It has no provider, socket, Render, cloud synchronization, account, broker, order-routing, strategy-execution, credential, scheduler, daemon, public installer, updater, or release-distribution behavior. It remains research-only.
