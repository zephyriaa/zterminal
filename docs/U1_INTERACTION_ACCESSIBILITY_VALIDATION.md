# U1 Interaction and Accessibility Validation

**Scope:** recovery branch only; no production deployment or promotion occurred. U1 retains the chart-first three-destination model and exposes secondary actions through a dismissible command palette rather than a new sidebar or route.

## U1 Command Contract

| Control | Behavior |
|---|---|
| Palette | Opens from the top-bar command control or `Ctrl/Cmd + K`; filters chart-context actions by label, detail, and keywords |
| Keyboard | `R` opens Research, `S` opens Studies, `F` enters Focus Mode, `Esc` exits Focus/close palette, `/` focuses the market input, and `Shift + R` refreshes verified data when not typing |
| Secondary status | Settings, Alerts, and Risk report only their truthful current local/unconfigured/no-execution state; they do not manufacture an integration or action surface |
| Focus Mode | Is designed to retain the chart, a single explicit exit control, and `Esc` while hiding workstation navigation, market command controls, studies/research drawers, toolbars, and attribution clutter |

## Local Browser Evidence

On the local integrated workstation on 2026-08-18:

- The top-bar command control opened a centered, focusable `Command palette` without replacing the chart route.
- The palette listed nine contextual actions, including Research, Studies, Focus, market input focus, refresh, truthful Settings/Alerts/Risk status, and its `Ctrl/Cmd + K` and `Esc` discovery controls.
- Searching `research` and pressing Enter opened the existing chart-context Evidence Lab. The palette closed and did not create a competing page or route.
- Entering Focus Mode left the visual chart and one top-right `Exit focus · Esc` control only; navigation, market controls, chart toolbar, range controls, drawers, footer, and other workstation clutter were absent. Pressing Escape restored the complete workstation reliably.

## Quality Gates

| Gate | Result |
|---|---|
| Command filtering and palette/market shortcut contracts | Passed: 2 tests |
| `pnpm check` after palette integration | Passed |
| Focus-mode browser verification | Passed: one visible exit control, chart-only presentation, and Escape restoration |
| Full `pnpm test` | Passed: 16 files, 51 tests |
| `pnpm build` | Passed |

**U1 is complete on the recovery branch pending commit.** Settings, Alerts, and Risk remain truthful status surfaces; durable configuration, connected alerts, and broker/execution functionality remain out of scope.
