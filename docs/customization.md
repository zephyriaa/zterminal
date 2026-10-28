# Workstation customization

Application preferences remain local to the device. Chart presentation belongs to the existing chart document (workspace + chart + venue + instrument). Panel geometry, chart arrangement, linking and the panel lock belong to the existing workspace snapshot.

## Behavior

- Terminal Preferences provides searchable Appearance, Charts, Layout, Keyboard and Import / Export sections. The command palette links directly to each section. Chart settings remain available from the chart toolbar.
- Application appearance changes seed future charts and preserve existing chart documents. A saved new-chart style takes precedence over application chart colors until explicitly reset. Applying a style to workspace charts is explicit and changes presentation fields only.
- Built-in appearances retain their storage keys. Custom appearances, chart styles, indicator templates and layout templates are separately named collections, with up to 30 entries per collection. Saving an existing name replaces that entry.
- Candle body, border and wick colors can be linked or edited independently. Hex input validates before applying. Interface/editor/chart-axis text sizing is separate from compact/comfortable density. Motion reduction also respects the existing system preference.
- Layout templates reuse Dockview serialization and the workspace runtime. Layout changes can be undone during the open workspace session, including after the settings panel remounts. The panel lock prevents dragging and resizing; opening tools remains available. Older snapshots default to unlocked.
- Shortcut rebinding uses the existing commands. Conflicts, reserved browser/editor bindings and duplicate modifiers are rejected. Inputs, text areas, select controls and the Python editor retain their keyboard input. Escape cancels capture.
- Preference export produces version 1 JSON. Import checks size, version, colors, numeric bounds, shortcut conflicts, style fields, indicator compatibility and known layout panels before presenting a replacement preview. Applying imported preferences does not import credentials, scripts, market data or workspace drawings.
- Appearance and chart changes apply immediately and provide session reversion. Scoped reset controls preserve other sections. Layout undo lasts until the workspace closes.

## Verification

Run `npm run typecheck`, `npm test`, focused ESLint and `npm run build`. `tests/customization.test.ts` checks preference-file rejection/round-trip, reserved and conflicting shortcuts, appearance/chart isolation, presentation-only application and older workspace migration.

Browser acceptance uses Browser Harness with recordings off. Local evidence is kept under `artifacts/customization/`, including the interaction results, exported/imported preference files and desktop/mobile captures. The release record must distinguish local checks, Linux release gates and production verification. Native Windows parity is a separate delivery and acceptance gate.

Local acceptance on 28 October 2026: 375 Node tests passed, TypeScript and focused ESLint passed, and the production build passed. Browser acceptance covered saved presets/hex input, font sizing, motion, search, rebinding/conflicts, layout templates/undo/locking, independent wick colors, separate indicator templates, real export and import preview/rejection, reload restoration, new-chart defaults and workspace isolation. Desktop 1440px and mobile 390px captures showed no horizontal overflow. Evidence remains local under `artifacts/customization/`; production confirmation follows the release pipeline.

Completion refinement: density changes line spacing and padding in both Monaco and the plain-text fallback. Restoring application style uses the same complete presentation defaults as future charts while preserving scales and identity. The refined build passed 376 tests; browser checks also verified 18px compact and 22px comfortable Monaco line spacing, the fallback's matching density, and restoration of saved grid defaults.
