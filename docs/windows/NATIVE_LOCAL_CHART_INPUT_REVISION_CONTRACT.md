# Native Local Chart Input-Revision Contract

**Status:** Internal Track B Direct3D rendering contract. The renderer must validate its retained vertex range in constant time. It receives one explicit composite chart-input revision from the Win32 host and compares it with the last successfully rebuilt revision; it does not hash or scan candle values on ordinary continuous frames.

> The revision is an invalidation token, not a market-data identifier. It is incremented by the native host whenever its bounded derived chart input changes. It neither makes data live nor masks a withheld local scene.

## Revision ownership

The host owns a monotonic **scene revision** and **view revision**. Scene revision increments before any fixture or verified-local candle vector replacement or clear, including a local bridge withholding result. View revision increments whenever the rendered viewport can change: chart pan, visible-candle zoom, cursor crosshair coordinate/presence change, or a successful resize. The composite input revision combines both values without allocation.

| Input change | Revision action | Retained range action |
|---|---|---|
| Fixture or verified local scene replacement, refresh, adjacent segment switch, or source withholding | Increment scene revision. | Rebuild from the new scene, or clear draw count if no candles remain. |
| Pan, zoom, or cursor crosshair change | Increment view revision. | Rebuild bounded vertices on the next requested frame. |
| Successful resize or device recreation | Increment view revision; device recreation additionally resets GPU upload state. | Rebuild once from current input after resources are usable. |
| Continuous benchmark frame with no input revision change | No mutation. | Draw the retained range directly; no candle scan, CPU-vertex construction, buffer map, or upload. |

The revision counter uses saturating behavior. It is not allowed to wrap into a stale cached range. Should a counter reach its maximum, the next mutation forces a retained-range rebuild even though the terminal value cannot advance; this is a conservative invalidation state.

## Diagnostics and boundary

Diagnostics retain aggregate upload/reuse/clear counters and add rebuild counts. They contain no candle values, provider frames, credentials, accounts, or research output. Normal synchronized `Present(1, 0)` remains the product path; unsynchronized present remains benchmark-only. No provider, socket, Render, cloud-sync, account, broker, order-routing, strategy-execution, credential, scheduler, daemon, public installer, updater, or release-distribution behavior is added.
