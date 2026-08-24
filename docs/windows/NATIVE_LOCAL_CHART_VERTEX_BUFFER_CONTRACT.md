# Native Local Chart Vertex-Buffer Contract

**Status:** Internal Track B Direct3D local-chart efficiency contract. The native renderer owns one fixed-capacity dynamic vertex buffer sized for the existing visible-chart ceiling of 2,000 candles plus crosshair geometry. The buffer is not a cache of provider data and does not expand the chart’s local data entitlement.

> The renderer may retain only derived GPU vertices for the currently selected verified chart view. It must rebuild those vertices whenever the local scene, chart viewport, cursor crosshair, dimensions, or device generation changes; it must never retain a former scene after a bridge withholding result.

## Bounds and update rules

The allocation remains bounded by `kMaximumVertices`, equivalent to at most 2,000 visible candles at 12 vertices each plus 24 crosshair vertices. The host keeps CPU-side derived vertices and a draw-count field. A frame may draw the retained vertex range without mapping or regenerating it when the render input revision is unchanged.

| Change condition | Required renderer action |
|---|---|
| Verified local scene, fixture diagnostic scene, viewport pan/zoom, or cursor crosshair changes | Rebuild bounded CPU vertices, map the existing dynamic buffer once, and upload only the current draw range. |
| Dirty-frame request with no chart-input change | Reuse the retained draw range; do not allocate a vector, map the buffer, or upload vertices. |
| Withheld local scene or empty chart | Clear retained draw count before presentation; no stale vertex range may be drawn. |
| Resize | Existing vertices remain geometrically valid only if normalized chart layout is unchanged; cursor input changes trigger normal rebuild. The resize path itself must not allocate a new chart buffer. |
| Device loss/recreation | Reset retained upload state with the Direct3D resources. The next successful render rebuilds and uploads from current local chart input. |

The renderer records only aggregate counters: dynamic-buffer uploads, retained-draw reuse, and cleared retained ranges. They are diagnostic performance evidence, not market-data telemetry.

## Boundary

This change preserves the normal synchronized `Present(1, 0)` policy. The unsynchronized present mode remains diagnostic-only. The renderer continues to consume only explicit fixture diagnostics or verified local scenes. It opens no provider, socket, Render, cloud-sync, account, broker, order-routing, strategy-execution, credential, scheduler, daemon, public installer, updater, or release-distribution path.
