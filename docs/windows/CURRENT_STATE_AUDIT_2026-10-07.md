# ZTerminal Windows app — current state

Follow-up: the blank-screen defects were subsequently diagnosed and repaired locally. See [the Windows debug report](WINDOWS_DEBUG_REPORT_2026-10-07.md) for the newer status; the findings below preserve the original audit baseline.

Investigated on 7 October 2026, at local commit `1cd4fc80962ccc2716ce4b86f35c42fd19a9afa8`, with existing unrelated working-tree changes preserved.

**Where we are:** the native Windows engine has a tested local foundation, but the desktop product interface is still an early prototype. It is not ready for everyday use or a public release. The polished web terminal and its violet theme have not been implemented as native Windows screens.

| Area | Current state |
|---|---|
| Native app | A real C++ Win32/Direct3D 11 executable. The normal desktop build/development commands now target it. It does not embed a browser. |
| First opening | Opens a responsive window. Accessibility exposes “Local Data Unavailable” and import guidance, but every captured first-opening window looked blank. No usable onboarding or import button exists. |
| Dashboard / terminal tabs | Neither exists in the native host. There are no native dashboard or terminal-tab screenshots to supply. The current window is a single chart surface. |
| Native charts | Candle geometry, pan/zoom, crosshair, bounded history navigation and renderer recovery are implemented. Logs confirm local candles and vertex uploads, but chart captures remained blank, including continuous rendering and after mouse-wheel input. Visual correctness is unverified; the rendering/capture discrepancy remains unresolved. |
| Local data / research | Verified local segments, workspace journaling, replay/EMA and bounded Monte Carlo exist. Packaged import/research utilities work, but the user interface does not expose a complete workflow. Provider ingestion requires explicit opt-in; no live provider connection was exercised in this audit. |
| Python research | A separate local helper provides strategy/indicator execution and archives. It is not integrated into a native editor or research panel. An intermittent indicator child-process failure remains. |
| Appearance / settings | Native colors remain the older dark blue palette. The violet theme, theme selector, full workspace customization and polished Windows navigation are missing. |
| Distribution | Native executable is unsigned. Private installer source exists; no setup executable was found under `out`, and the default native install directory was absent. Installation was not rerun. Public Windows release endpoint returns 503 / `WINDOWS_RELEASE_PUBLISHING_DISABLED`. |

The legacy Tauri preview remains a separate hosted WebView application. Its launch page sends “Continue offline” to `/desktop/dashboard`, which currently returns 404. Its dashboard data is seeded in an in-memory database. It cannot be counted as the native, durable local-first product.

Fresh checks: 56 selected Rust tests and the native credential-vault test passed. An isolated pipeline imported 32 synthetic provider-shaped frames, persisted 31 verified bars, generated a 100-scenario local Monte Carlo result, and handed data/research to the native host successfully. Those are test inputs, not live market data. The Python runtime suite ran 40 tests: 33 passed, one failed and six were skipped; the failed indicator test passed on a focused retry. The optional event environment then passed all 15 contract/recorder tests. One native process observation found zero TCP connections; this is a point-in-time check, not a general network proof.

**Next priorities:** resolve the blank rendering/capture discrepancy; build native onboarding, dashboard and terminal navigation; expose local import, workspace restoration and Python research; apply the violet/blue theme choices; stabilize Python jobs; then validate installation, trusted signing and updates. The local compute boundary supports the server-load goal, but full workstation performance and user-scale capacity have not been established.

Actual screenshots and diagnostic evidence: `artifacts/windows-state-audit/2026-10-07/`. Screenshots were captured from the running native application, without mockups or generated UI. First opening is `01-native-first-opening.png`; explicitly synthetic chart mode is `02-native-chart-diagnostic.png`; verified local test-data mode is `04-native-local-scene.png`. The blank captures are retained as evidence, not presented as completed chart screens. No application source was changed, deployed or installed by this audit.
