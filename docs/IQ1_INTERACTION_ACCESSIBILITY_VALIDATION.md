# IQ1 Interaction and Accessibility Validation

**Branch:** `product/orderflow-research-terminal`
**Validation date:** 2026-08-18
**Release state:** Product-branch validation only. No recovery merge, production modification, or Render deployment is authorized by this record.

## Delivered Interaction Refinements

| Refinement | Validation result |
|---|---|
| Keyboard discovery | Passed. An unmodified `?` opens a compact reference for `Ctrl/Cmd + K`, `/`, `R`, `S`, `F`, `Esc`, `Shift + R`, and `?`. It explicitly says shortcuts are inactive while typing and create no order/execution route. |
| Command registry | Passed. `Keyboard Shortcuts` is a searchable command with shortcut `?`; focused command tests confirm it is discoverable. |
| Palette keyboard navigation | Passed. Arrow navigation wraps deterministically in pure tests. Browser DOM inspection after Arrow Down found exactly one semantic active option with `aria-selected="true"` and the `active` class. |
| Palette accessibility | Passed. Search retains autofocus; the results use a labelled `listbox`, options expose selected state, Enter runs the active command, and Escape closes. |
| Focus mode state | Passed. Focus controls carry `aria-pressed`; the terminal includes a polite live status region announcing entry and exit. |
| Strict Focus boundary | Passed after correction. The initial browser observation exposed opt-in order-flow panels in Focus mode; the dock is now withheld. Follow-up browser view contained only the chart canvas, watermark, and exit control. |
| Responsive support | Passed by static stylesheet inspection. Existing narrow-screen rules preserve a static, stacked order-flow dock at `max-width: 760px`; the new keyboard reference reduces to a one-column definition list at the same breakpoint. Browser console confirmed the responsive dock rule is loaded. |
| Quality gates | Passed: `pnpm check`; `pnpm test` with **22 test files / 74 tests**; `pnpm build`; and `git diff --check`. |

## Browser Evidence

The local workstation verified the `?` reference, its Escape close behavior, command-palette opening, arrow-key active-option change, Focus-mode entry/exit announcements, and the corrected chart-only Focus composition. The automation platform injected a literal `K` into the search field when simulating the platform shortcut; deterministic command-contract tests provide the non-transport-specific assertion for selection behavior.

> IQ1 changes interface discovery and accessibility only. It does not alter provider status, historical data coverage, tape/depth provenance, local-workspace scope, strategy constraints, broker-routing posture, alerts, or execution controls.

## Files Covered

| File | Change |
|---|---|
| `client/src/lib/terminalCommands.ts` | Adds shortcut-help command, wrapping command-navigation helper, and unmodified help-shortcut helper. |
| `client/src/lib/terminalCommands.test.ts` | Adds deterministic keyboard-help and palette-navigation tests. |
| `client/src/components/terminal/CommandPalette.tsx` | Adds active result state, semantic listbox/options, and Arrow Up/Down navigation. |
| `client/src/pages/Home.tsx` | Adds keyboard reference, focus-return helpers for overlays/drawers, Focus-mode announcements, and `aria-pressed` controls. |
| `client/src/index.css` | Adds keyboard-reference, active command, narrow-screen, and strict Focus-mode dock styling. |
| `docs/IQ1_INTERACTION_ACCESSIBILITY_AUDIT.md` | Contains the audit and sequential browser observations. |
