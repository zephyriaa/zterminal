# TradingView-Style Chart Navigation Plan

## Goal

Make the `/terminal` chart feel like a charting terminal rather than a static canvas: a user must be able to pan freely through time, zoom at the cursor, manipulate the price scale independently, and reset the view predictably. These gestures must coexist with the desktop-style floating-window manager: only a window title bar may move a window; any interaction inside the chart plot belongs to the chart.

## Current diagnosis

`TerminalChart` already contains a canvas gesture model for pointer drag, wheel, pinch, price-scale zoom, keyboard navigation, and viewport reset. The behavior is nevertheless unreliable because its viewport representation, gesture ownership, and redraw cadence have not yet been consolidated around the expected charting-terminal interaction model. The chart currently conflates several movement paths and can make a drag appear inert when an offset is constrained or when the viewport needs a redraw before the next meaningful pointer delta.

The floating-window component is not intended to drag from the chart body—its drag handler is restricted to the title bar—but the implementation will explicitly verify and preserve this boundary. No work will modify the landing page, market-provider semantics, or the fail-closed P0 data policy.

## Implementation approach

### 1. Establish a single viewport controller

Refactor the chart’s internal viewport state into an explicit controller containing the visible bar count, right-edge offset, price-scale zoom, and vertical price offset. Define pure, bounded operations for `panTime`, `zoomTimeAtPointer`, `zoomPriceAtPointer`, `panPrice`, `resetViewport`, and `goToRealtime`.

The controller will use a consistent coordinate convention: panning right reveals older candles; panning left returns toward the latest verified print and into the configured future space. Its bounds will permit practical historical navigation without producing an unintelligible empty chart. Live market updates will update only the newest bar and will never recenter or erase a user’s manual viewport.

### 2. Make plot, time, and price gestures unambiguous

On desktop, primary-pointer drag within the plot will pan the time axis immediately after a small movement threshold. The price axis will retain its independent vertical scale behavior. The implementation will additionally support a clear price-pan gesture inside the plot—middle mouse or an explicit modifier—so users can reposition a manually stretched scale without accidentally moving the floating chart window.

Wheel zoom will be anchored to the cursor’s time coordinate in the plot and to the pointer’s price coordinate over the price axis. Zoom direction and sensitivity will be normalized across mouse wheels and trackpads. Double-click will reset the relevant axis; the existing reset button, Home/Escape, and a visible “Go to realtime” control will remain synchronized with the same controller.

On touch devices, one-finger drag will pan time; a two-finger pinch in the plot will zoom candle density around the pinch midpoint; a pinch beginning on the price scale will change candle height. The canvas will retain `touch-action: none` so browser-level scroll/zoom does not consume the chart gestures.

### 3. Harden pointer ownership around floating windows

The chart canvas will take and release pointer capture deterministically for drag and pinch lifecycles, including cancellation and loss of capture. Event propagation will be stopped only where required to prevent a chart gesture from being interpreted as a window drag; title-bar movement and edge/corner resize controls will remain unchanged.

The implementation will add an interaction threshold and cursor states (`grab`, `grabbing`, price-scale variants) to provide immediate visual confirmation that the chart, rather than the desktop window, owns the gesture. It will also ensure that opening a supporting floating window does not change chart panning behavior or steal focus during a drag.

### 4. Improve rendering responsiveness and continuity

Pointer movement will update the viewport through a request-animation-frame redraw path, avoiding state churn while preserving immediate visual response. The cursor anchor will be recalculated from the actual plot width, excluding the price axis and respecting the active volume pane. Resize handling will preserve the chart’s chosen time/price viewport rather than resetting it.

The reset behavior will remain explicit: it restores only the user-controlled chart navigation state, not market data. The current verified bars, provider status, and fail-closed unavailable-data indicators will not be altered by any navigation action.

### 5. Add regression coverage and release verification

Extract the viewport clamp and anchor calculations into testable pure functions. Add deterministic tests for time pan direction, bounds, cursor-anchored zoom, price-scale anchoring, reset, and “go to realtime.” Extend browser review to verify that a chart remains pannable while its containing desktop window is focusable, resizable, minimized/restored, and maximized.

## Acceptance criteria

| Area | Required result |
|---|---|
| Time pan | A pointer drag on the chart plot visibly moves historical candles in the expected direction, including after opening other floating windows. |
| Time zoom | Wheel/trackpad and pinch zoom candle density around the pointer/pinch midpoint without jumping to an edge. |
| Price navigation | Price-axis drag/wheel and the explicit plot price-pan gesture adjust candle height/vertical placement independently of time pan. |
| Window separation | Chart gestures never move or resize the parent floating window; only title bar and resize handles do so. |
| Continuity | Live trades do not reset a manually panned or zoomed chart. “Go to realtime” intentionally returns to the latest verified print. |
| Mobile | One-finger pan and two-finger pinch work without browser page zoom or scroll hijacking the chart gesture. |
| Integrity | No synthetic candles, prices, L2, footprint, open interest, or provider state is introduced. |

## Validation plan

Run TypeScript, lint, existing deterministic tests, the new viewport tests, and the production build. Use a local browser to exercise mouse drag, wheel/trackpad-equivalent zoom, price-axis zoom, middle/modified price pan, pinch, double-click reset, keyboard navigation, chart maximize/minimize, window resize, and mobile-width layout. After publishing, verify the live `/terminal` route with a cache-busting URL, check browser console output, and confirm that `/` remains the landing page.

## Assumptions and risks

The plan assumes the desired “free movement” refers to chart navigation, not moving the entire chart window from its body. If the user instead wants body-drag to move the floating window, that would be mutually exclusive with standard chart panning and would require a dedicated title-bar or modifier convention; the reference already establishes the title bar as the window-move affordance.

The exact feel of TradingView’s proprietary gesture tuning will be approximated through observable interaction conventions, not copied from private implementation. Trackpads and high-resolution wheels vary by browser, so final sensitivity values will be tuned through browser testing on desktop and touch layouts.
