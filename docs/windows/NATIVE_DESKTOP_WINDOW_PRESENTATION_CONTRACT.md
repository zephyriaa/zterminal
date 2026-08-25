# Native Desktop Window Presentation Contract

**Status:** Internal Track B desktop presentation contract for the local-first Win32 and Direct3D11 host.

## Normal application identity

The normal native window title is simply **`ZTerminal`**. It must not encode operational diagnostics, provider state, keyboard controls, fixture status, benchmark results, local segment offsets, or research output in the Windows title bar. Those details are not a substitute for an application interface and make the desktop host look like a diagnostic tool rather than a workstation.

The host remains an ordinary resizable Win32 window with standard Windows controls. It does not use a browser shell, a remote WebView, a hosted chart, or a persistent network service.

## Local-data unavailable workspace

When no verified local scene was explicitly selected, the Direct3D surface remains clear and a child-control overlay presents an intentional workspace state:

| Element | Required behavior |
|---|---|
| Workspace identity | Displays `ZTERMINAL / LOCAL WORKSPACE` inside the client area rather than in the title bar. |
| State | Displays `LOCAL DATA UNAVAILABLE`. |
| Truthful detail | States that no verified local candles are available. |
| Guidance | States that a verified local segment must be imported, and that ZTerminal will not fetch or manufacture market data automatically. |

The unavailable overlay is hidden as soon as a verified local scene is available. Fixture data remains a command-line diagnostic path only and is never silently substituted for a local scene.

## Presentation and rendering boundaries

The desktop presentation overlay is not market data and does not alter the retained Direct3D candle vertices, local-scene gating, cache/history semantics, synchronized presentation behavior, or no-network boundary. Resize relayout only positions the local overlay and requests an ordinary frame. The application title remains `ZTerminal` for local scenes, withheld states, diagnostics, and benchmark runs.

## Validation

The Windows 10 native smoke launches the rebuilt host in bounded diagnostic mode and verifies a responsive nonzero main-window handle with title `ZTerminal`, a clean exit, and no network activity. The updated private installer smoke separately verifies that the packaged host is delivered with the current-user Installed-apps registration and complete owned-data removal boundary intact.
