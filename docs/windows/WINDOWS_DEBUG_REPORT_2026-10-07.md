# Why the Windows app appeared broken

7 October 2026. This follow-up supersedes the unresolved blank-screen finding in the earlier current-state audit. The local native executable has been rebuilt with the fixes below; no installer, hosted deployment or public release was published.

**Conclusion:** there were real rendering defects hiding both the initial workspace message and loaded charts. Separately, the native application is still a single chart prototype: its dashboard, terminal tabs and complete local research workflow have not been implemented. Repairing its renderer does not create those missing features.

## Confirmed causes and fixes

1. **The chart had no drawing viewport.** `Renderer::render()` bound its target, shaders and vertex buffer, but never called `RSSetViewports`. Thus candles could load and `Draw`/`Present` could succeed without drawing the chart. Resize also called `ClearState`, which discards graphics state. The renderer now binds a viewport using the actual back-buffer dimensions and an explicit 2D rasterizer on every frame. The explicit rasterizer disables face culling for the chart rectangles. This follows the [Microsoft viewport API](https://learn.microsoft.com/en-us/windows/win32/api/d3d11/nf-d3d11-id3d11devicecontext-rssetviewports).

2. **The graphics surface covered the first-opening text.** The empty workspace used Windows child text controls while the parent repeatedly presented a full-window Direct3D background. Accessibility could read the controls even though screenshots could not see them. The unavailable-data state now paints through Windows controls without GPU presentation. Child clipping and opaque text backgrounds keep it readable. The corrected screenshot shows the actual “Local Data Unavailable” guidance.

3. **Chart geometry used the wrong vertical convention.** Higher prices were mapped toward the bottom, and the body-height clamp used the opposite direction. The price mapping and minimum candle-body height are corrected. Exposure/repaint now requests a fresh chart frame. Synthetic diagnostic windows explicitly identify their data in the title.

4. **Python status publication could crash on a Windows read lock.** The controller polls `status.json` while the child publishes new status through `os.replace`. A short-lived reader can prevent replacement on Windows. A controlled reproduction raised `PermissionError: [WinError 5] Access is denied`. The child now retries the Windows sharing/access-denied errors for at most half a second, leaving the previous complete JSON readable; persistent failure still raises. Generic failures now include the actual child exit code instead of asserting that a resource limit caused them. This is a confirmed race mechanism and a plausible explanation of the earlier intermittent indicator failure; the exact historical failing child had its stderr discarded, so that particular failure cannot be attributed retrospectively with certainty.

## What still prevents everyday use

The normal native launch deliberately withholds market data until an explicit verified local scene is supplied. There is no import button, automatic workspace restoration, provider picker, native dashboard, terminal-tab layout, Python editor/research panel, or violet/blue theme selector. The local storage/research utilities exist, but users cannot complete those workflows through the current window.

The legacy Tauri/WebView preview is a separate application. Its “Continue offline” action points to a missing `/desktop/dashboard` route, confirmed as HTTP 404; its seeded in-memory dashboard is not durable native workspace storage. This deprecated preview was not changed into another hosted workaround.

The native executable remains unsigned, the private installer source is not a released setup, and public Windows release publication remains deliberately disabled (HTTP 503 / `WINDOWS_RELEASE_PUBLISHING_DISABLED`). These are distribution gaps, not the cause of the blank chart.

## Verification

- Release native build passed. Actual first-opening text and native candles are now visible in captured Windows screens. Mouse-wheel zoom, verified local test-data rendering and maximize/resize were exercised visually.
- Five isolated native checks passed: normal empty launch, missing store, 10,000 synthetic candles, 100,000 synthetic candles and resize. GPU readback counted 32,453 chart pixels, 32,274 chart pixels and 20,909 chart pixels respectively in the three chart cases. Missing data remained withheld. Readback runs only with the explicit benchmark verification flag.
- The isolated offline-import → verified local scene → local Monte Carlo → native sidecar handoff passed again. Native credential-vault testing passed. No live provider feed or broker operation was used.
- 33 Python engine/helper/atomic-publication tests passed after the fixes. Focused persistent-lock, reader-contention and explicit process-crash checks passed after final test edits. Before the fix, 12 indicator retries and a traced full 31-test suite also passed, confirming the original failure was intermittent rather than universally reproducible.
- The earlier audit's 56 Rust tests and 15 optional event-environment checks were already passing; unchanged Rust code was not retested merely to increase the count.

Evidence lives in `artifacts/windows-state-audit/2026-10-07/`: `python-atomic-baseline.txt`, `python-fixed-tests.txt`, `pixel-checks/*/results.json`, the local pipeline result and before/after screenshots. Synthetic and imported test frames are explicitly test-only. Real user archives were preserved. GPU device-loss recovery, signed installation/update flows, real-provider coverage, and full-workstation performance have not been certified by this debug pass.

**Current status:** the blank-screen defects and Windows status-file race are repaired locally. The app still needs a native workstation interface and release preparation before it can serve as the complete ZTerminal Windows product.
