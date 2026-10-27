# Compact workspace header — 27 October 2026

The second workspace toolbar repeated the terminal's workspace/account information
and consumed a separate row. Open workspaces now use one terminal header. Its
workspace-name dropdown contains the full name, local/cloud save state, Back to
Workspaces, Duplicate and the existing conditional Save to account / Retry sync
actions. Account access uses the terminal's existing account panel.

The existing save, flush, duplication, ownership and sync operations are retained.
Read-only tabs keep the workspace menu available while market/header editing
controls, command palette and the workspace body remain blocked. Conflict and
takeover banners remain outside the inert content.

Local Browser Harness acceptance:

- PASS: no `.ws-toolbar`; the only header is 42 CSS pixels at the tested compact
  density and the canvas starts at the top of the viewport.
- PASS: a long workspace name truncates in the trigger and wraps fully in the
  menu; name and save state remain readable.
- PASS: pointer and keyboard opening, Escape dismissal and trigger-focus return.
- PASS: Duplicate creates a local copy; Back to Workspaces flushes and navigates
  from a read-only second tab. Charts/market controls remain inert there.
- PASS: 1536px desktop and 390px narrow layouts inspected. At 390px the market
  picker has 185px available, the menu stays within the viewport and document
  width does not exceed viewport width. Mobile navigation retains the shortcuts
  omitted from the narrow header.
- PASS: typecheck and focused lint. Linux CI must validate the release build.
- NOT TESTED locally: authenticated Save to account / Retry sync; their existing
  operations and ownership conditions were relocated unchanged.

Bounded screenshots and logs are under ignored
`artifacts/helper-redesign/header-*`. Browser recordings remain disabled.
The Next development server regenerated its managed AGENTS heading; that generated
change is retained as directed by the repository's Next agent rule.
