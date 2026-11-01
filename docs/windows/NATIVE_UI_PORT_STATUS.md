# Native interface port — 7 October 2026

The user requested bringing the existing Figma interface into the working
native Windows app. This supersedes waiting for completion of the entire
Figma design handoff before starting the port.

## Prepared integration

`ZTerminalChartPresentation` builds the existing renderer and local scene
bridges as a native static library. `native_chart_host.h` exposes a
presentation adapter for composition swap-chain attachment, physical-size
resize, retained rendering, input, and application of existing verified local
scene results. This introduces no alternate workspace or market domain model.

The composition path creates a Direct3D device and a flip-sequential
composition swap chain, then attaches it through a host callback. Device
recovery reattaches the new swap chain. The diagnostic Win32 executable keeps
its existing HWND swap-chain path. Shared invalidation and title functions
ignore null window handles rather than affecting unrelated desktop windows.

The future WinUI host must own this adapter on its UI thread, supply an
`ISwapChainPanelNative::SetSwapChain` callback, handle composition-scale
changes and physical buffer sizes, and invoke shutdown during teardown.
The current adapter supports one chart presentation, matching the existing
host; it is not a completed multi-chart or detached-window implementation.

## Validation

- Existing native Release executable builds.
- New composition presentation static library builds.
- Five existing rendered-chart checks pass: unavailable launch, missing store,
  10,000 diagnostic candles, 100,000 diagnostic candles and resize.
- Isolated evidence: `out/rendered-chart-smoke/ec86e27463ee4a90bdeb4b8bbe359aa8/results.json`.

The composition path has **not** yet been exercised inside a WinUI window.
There is no completed visual interface port or new release installer yet.

## Pending design-reference choice

Figma `get_design_context` for file `VtIJq6WBPRJUUKtc4XvnxE`, frame `14:1080`
returned the Starter MCP tool-call limit. The Figma-to-code skill requires
implementation from its high-fidelity context responses. A pending user
question asks whether to override that requirement and use the saved design
source that generated the Figma screens, or wait for Figma access.

Saved source: `artifacts/figma-rebuild/revision-v2/`, including the
chart-led preview, Geist/Violet tokens, original assets and verified local
compositions. After the reference choice, implement the actual native shell
around this adapter and verify it in Windows. Do not silently substitute
a browser wrapper, fabricated market data or example run reports.
