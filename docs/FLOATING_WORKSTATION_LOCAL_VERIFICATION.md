# Floating Workstation Local Verification

## Reference-led desktop composition

The local `/terminal` implementation now presents a compact dark-navy workstation shell with a dense brand/account header, instrument strip, narrow left tool rail, matte canvas workspace, elevated chart window, and elevated market-context window. The deleted Focus, Canvas, and Research workspace mode controls are not present. A small non-interactive header status identifies the new interaction model as **Floating workstation — Drag panels to arrange**.

## Direct interaction evidence

The chart panel was opened from its default geometry, then its title bar was moved with pointer input. Its inline geometry changed from `left: 4%; top: 5%; width: 72%; height: 84%` to `left: 6.66667%; top: 7.2449%; width: 72%; height: 84%`. Its visible lower-right grip was then dragged; geometry changed to `width: 69.3333%; height: 81.551%`. The saved local workspace contained the same bounded chart geometry and contained no credential-like keys.

The Indicators catalogue and Strategy Tester were each opened from the compact left rail. Both rendered inside their own movable panel frames with minimize, close, and resize controls, preserving native-study/data-gate and closed strategy/backtest functions. Market context remains a separate closable, movable panel. The desktop panel layout is designed to persist locally for guests and through the existing account-isolated workspace preference contract for signed-in users.

## Reset control

The left-rail reset control was invoked after the direct drag and resize test. The interface displayed `Desktop panel layout reset to the chart-first default`, restored the chart to the default arrangement, and kept the verified chart, market-context panel, and no-mode header intact.
