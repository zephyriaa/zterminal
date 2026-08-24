# Native Renderer Recovery and Frame-Pacing Contract

**Status:** Implementation boundary for the native Windows Direct3D host. This work changes only local rendering resource handling and diagnostics. It does not activate network transport, cloud synchronization, provider fallback, account data, execution, signing, installers, updates, or releases.

## Recovery rules

The host must treat every swap-chain resize and present result as a device-resource boundary. A normal resize must unbind the render target, release the back-buffer view, resize buffers, recreate the render target, and request one dirty frame. If buffer resize fails, the viewport remains unavailable instead of drawing through a stale view.

> `DXGI_ERROR_DEVICE_REMOVED`, `DXGI_ERROR_DEVICE_RESET`, and `DXGI_ERROR_DEVICE_HUNG` are local recovery signals. They must trigger a bounded single renderer reinitialization against the existing window; they must never cause a server request, fallback data source, or fixture substitution.

| Event | Required local behaviour | Diagnostic |
|---|---|---|
| `WM_SIZE` with non-zero dimensions | Recreate only the back-buffer target and redraw once. | Increment successful resize count. |
| Ordinary `ResizeBuffers` failure | Mark render target unavailable and withhold drawing until a later valid local resize/recovery. | Increment resize failure count. |
| Recoverable device loss at resize or present | Recreate device, swap chain, target, shaders, input layout, and bounded vertex buffer once. | Increment device recovery count; record last device error. |
| Failed device recovery | Keep chart data state unchanged but stop rendering rather than use WARP or an external service unexpectedly. | Increment unrecoverable device failure count. |
| Non-recoverable `Present` error | Withhold further rendering. | Increment present failure count and record HRESULT. |

## Frame pacing rules

Normal local workstation mode remains dirty-frame driven. Input, valid resize, local scene arrival, or explicit repaint requests at most the next synchronized frame. It must wait for a Windows message while nothing is dirty. The existing continuous present loop remains restricted to finite benchmark runs and is never enabled in ordinary user mode.

The diagnostic-only unsynchronized present switch remains benchmark-only. It must never be enabled merely because a machine has a slow compositor or reports a high synchronized p95 frame time.

| Mode | Presentation rule | Permitted purpose |
|---|---|---|
| Normal user mode | `Present(1, 0)` only after a dirty request; then wait. | Responsive local UI without idle spinning. |
| Synchronized benchmark | `Present(1, 0)` continuously only for a finite auto-close benchmark interval. | Measurement of compositor-inclusive frame time. |
| Unsynchronized benchmark | `Present(0, 0)` only with the existing explicit diagnostic switch and finite benchmark interval. | Isolate local draw-path cost; never production interaction. |

## Acceptance and limitations

The changed host must build with Windows MSVC and preserve the existing fail-closed default chart state. A smoke run must report recovery, resize, and present counters in the native diagnostic. Benchmark evidence must be treated as diagnostic on the connected reference machine, not as a 60 FPS product guarantee. Device-loss injection and three-tier performance acceptance remain future test infrastructure work.

## Windows validation evidence

The updated host built successfully with Windows MSVC on the connected Windows 10 reference device. The repeatable smoke suite ran four finite two-second cases: default fail-closed startup, an explicit missing-local-segment request, an explicit 10,000-candle fixture diagnostic, and the internal `--benchmark-resize-once` diagnostic. Every case recorded zero resize failures, device recoveries, unrecoverable device failures, and present failures. The resize diagnostic preserved the default withheld/unavailable chart state and recorded two successful resize target rebuilds (one normal window message plus the explicit internal diagnostic resize).

The raw measurements are retained at `docs/windows/benchmarks/windows-local-scene-smoke.json`. This evidence validates ordinary resize resource handling on the reference device. It does **not** simulate or prove recovery from a physical device removal, driver reset, GPU hang, sleep/resume transition, or a three-tier performance target.
