# Terminal workspace repair — 2026-09-23

Deployed terminal: https://zterminal-web.zephyria-inc.workers.dev/terminal

Cloudflare version: `e2889c52-fd14-4c3d-8dc3-0308be04af8a`.

## Behavior

- Defaults use Dockview `addPanel()`: approximately 70% primary chart, order book on the right, research and Python strategy tabs below it. The primary chart is activated last.
- `zt_workspace_layout_v2` accepts Dockview-produced layouts. Malformed JSON, obsolete splitview layouts, invalid schemas, unresolved components, and missing required panels are discarded and rebuilt. The old v1 layout is not structurally migrated.
- Persistence starts after initialization, debounces writes, flushes pending changes, and disposes subscriptions. Reset reconstructs immediately. A terminal error boundary provides a separate recovery action.
- Desktop/mobile navigation and the command palette share the Dockview controller. Secondary tools load on demand; screens up to 900px maximize the selected group while preserving the underlying layout.
- The existing chart, studies, drawings, research reports, Python editor, and real depth subscription remain in use. Glass is scoped to terminal chrome and overlays; chart, editor, report, and table content stays opaque. Reduced motion/transparency and keyboard focus are preserved.
- Terminal chrome now has visibly translucent blue-gray fill, a stationary blur, refractive edges, and an inner highlight. The production CSS keeps the standard `backdrop-filter` declaration after its WebKit prefix so Chromium applies it.
- Account chrome consumes the existing verified session at request time and actual workspace synchronization status. No authentication provider, database schema, public API, or market protocol was changed.
- Legacy appearance preferences remain readable. Loading preferences no longer overwrites separately saved chart colors.

## Validation

| Check | Result |
| --- | --- |
| `npm test` | 162 passed, including 10 layout recovery/persistence tests |
| `npm run typecheck` | Passed |
| `npm run build` | Passed; `/terminal` renders at request time |
| `npm run cf:build -- --skipNextBuild` | Passed using the verified Next.js build |
| `npx opennextjs-cloudflare deploy` | Deployed successfully |
| Local production browser tests | Passed at 1440×900, 768×1024, 390×844 |
| `node scripts/verify-live-production.js` | Passed against Workers at all three sizes; home and health returned 200 |

Browser assertions cover default panels, active navigation, lazy tools and Monaco, mobile full-canvas presentation, repeated focus without duplicate tabs, resized geometry across reloads, malformed/incompatible layouts, missing chart, unknown components, reset, command-palette routing, computed glass blur on chrome, and opaque data panels. Every viewport completed with zero uncaught exceptions and zero Dockview console errors.

Run `npm run test:terminal` against a local server, or set `TERMINAL_URL` to a production server. Browser screenshots and JSON diagnostics are written under `artifacts/terminal` locally and `calibrated-captures/live-production/terminal` for live verification.

## Environment limitations

The live market gateway WebSocket returned HTTP 308, the local research helper was not running, and the helper release endpoint returned 503. These existing service availability failures are recorded separately from renderer failures. The order book displays its disconnected state and introduces no simulated levels. Authenticated Google sign-in and a completed local Python backtest were not exercised with real credentials/helper access.
