# IQ1 Interaction and Accessibility Audit

**Branch:** `product/orderflow-research-terminal`
**Date:** 2026-08-18
**Scope:** Keyboard discoverability, Focus mode, command-palette behavior, and narrow-screen workstation controls.

## Current Strengths

| Surface | Present behavior |
|---|---|
| Global commands | `Ctrl/Cmd + K`, `/`, `R`, `S`, `F`, `Shift + R`, and `Esc` are already handled without affecting editable fields. |
| Focus mode | The terminal leaves one explicit top-bar exit control, supports `Esc`, and removes chart chrome, drawers, footer claims, and workstation controls. |
| Command palette | Opens with focus in the search field, supports filtering, runs the first matching command on Enter, closes on Escape/backdrop, and visibly lists command shortcuts. |
| Narrow screens | Main controls reduce progressively and the order-flow dock becomes static, preserving chart scroll space. |

## Gaps to Close

| Gap | Impact | Bounded refinement |
|---|---|---|
| Shortcut discovery is limited to a compact palette footer and no help command exists. | New users cannot efficiently discover the direct `R`, `S`, `F`, `/`, or `Shift + R` actions. | Add a keyboard-shortcuts command and a non-modal reference panel accessible from the palette and `?` outside editable fields. |
| Palette results have no arrow-key active item or semantic option state. | Keyboard users must switch between keyboard and pointer or rely only on the first result. | Add deterministic up/down navigation, `aria-activedescendant`, selected result styling, and Enter activation. |
| Opening/closing drawers does not restore focus to the initiating control. | Keyboard context can be lost after a close action. | Track the prior focus element for palette/study/research openings and restore it on close where still connected. |
| Focus mode toggle has no announced state. | A screen-reader user receives no explicit confirmation that the workspace changed. | Add `aria-pressed` plus a short live-region status message on entry/exit. |
| The compact top bar hides its dedicated Focus button under 760px. | Focus remains available from the icon rail, but its keyboard route is not visible. | Keyboard help should show `F`; avoid adding another mobile control that competes for limited top-bar space. |

> No audit finding calls for changing data-provider scope, chart data, order-flow contracts, durable storage, strategy evaluation boundaries, or execution controls.

## Browser Observation: Keyboard Reference

The unmodified `?` shortcut opened a compact keyboard-reference dialog above the preserved workstation. It disclosed `Ctrl/Cmd + K`, `/`, `R`, `S`, `F`, `Esc`, `Shift + R`, and `?`, and explicitly stated that shortcuts are inactive in fields, open research controls only, and do not create an order or execution route. `Escape` closed the reference and returned to the underlying verified workstation.
The documented Escape close path returned cleanly to the chart workstation. The command palette then opened with the search input focused, a semantic `listbox` of options, an active visual treatment on the first result, and a footer showing arrow-key selection. The browser automation passed an extra literal `K` into the focused query while simulating the platform shortcut, so final arrow/Enter behavior is also covered by the deterministic pure command-navigation tests rather than treating that transport artifact as product behavior.
A DOM inspection after Arrow Down confirmed exactly one active palette option: `terminal-command-exit-focus` with `aria-selected="true"` and the `active` class. This verifies that keyboard navigation moves semantic selection independently of mouse targeting. Escape then closed the palette and restored the verified workstation.
## Browser Observation: Focus Mode

The lowercase `f` shortcut entered Focus mode and exposed the live status announcement **“Focus mode enabled. Chart workspace only. Press Escape to exit.”** The initial observation revealed that opt-in order-flow panels remained visible despite the chart-only specification. This was corrected by adding the Focus-mode rule that withholds the order-flow dock. A follow-up browser view showed only the chart canvas, verified-research watermark, and explicit focus exit control.
