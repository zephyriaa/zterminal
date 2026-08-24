# Native Local Chart Vertex-Buffer Contract

**Status:** Internal Track B Direct3D local-chart efficiency contract. The native renderer owns one fixed-capacity dynamic vertex buffer sized for the existing visible-chart ceiling of 2,000 candles plus crosshair geometry. The buffer is not a cache of provider data and does not expand the chart’s local data entitlement.

> The renderer may retain only derived GPU vertices for the currently selected verified chart view. The host increments bounded scene and view revisions for every source or derived-view mutation; the renderer adds a geometry revision for successful resize and device-resource recreation. It compares that compact revision tuple in constant time and must never retain a former scene after a bridge withholding result.

## Bounds and update rules

The allocation remains bounded by `kMaximumVertices`, equivalent to at most 2,000 visible candles at 12 vertices each plus 24 crosshair vertices. The host keeps CPU-side derived vertices and a draw-count field. A frame compares only the `{scene, view, geometry}` revision tuple to draw the retained range without mapping, regenerating, hashing, or scanning visible candle values when the tuple is unchanged.

| Change condition | Required renderer action |
|---|---|
| Verified local scene, fixture diagnostic scene, viewport pan/zoom, cursor coordinate, or cursor-presence change | Host advances the relevant scene or view revision. The next frame rebuilds bounded CPU vertices, maps the existing dynamic buffer once, and uploads only the current draw range. |
| Dirty-frame request with no revision change | Reuse the retained draw range; do not allocate a vector, map the buffer, upload vertices, hash, or scan candle values. |
| Withheld local scene or empty chart | Clear retained draw count before presentation; no stale vertex range may be drawn. |
| Successful resize | The renderer advances geometry revision and the host advances view revision. The next frame rebuilds; the resize path itself must not allocate a new chart buffer. |
| Device loss/recreation | Recreated Direct3D resources advance geometry revision. The next successful render rebuilds and uploads from current local chart input. |

The renderer records only aggregate counters: dynamic-buffer uploads, retained-draw reuse, cleared retained ranges, and revision-triggered rebuilds. They are diagnostic performance evidence, not market-data telemetry. The synchronized smoke requires rebuild count to equal successful upload count and retained draws to exceed uploads; resize timing may conservatively produce one or two initial rebuilds.

## Boundary

This change preserves the normal synchronized `Present(1, 0)` policy. The unsynchronized present mode remains diagnostic-only. The renderer continues to consume only explicit fixture diagnostics or verified local scenes. It opens no provider, socket, Render, cloud-sync, account, broker, order-routing, strategy-execution, credential, scheduler, daemon, public installer, updater, or release-distribution path.
