# Cloud Workspace and PWA Validation Record

**Status:** **Live in production** on `render-hosted-research-terminal` commit `155914a`, deployed through Render as `dep-da3fqfgu01pc738klvig` on 2026-08-20.

## Cloud-workspace boundary

The account system previously persisted only research drafts to TiDB while the terminal’s selected market, timeframe, range, public-tape choice, enabled layers, and watchlist remained browser-local. This release adds a single `workspacePreferences` record per user-owned workspace. It stores only a versioned, bounded interface snapshot. It does not store session credentials, public market bars, WebSocket tape, depth, broker/execution data, custom-indicator formulas, protocol text, or closed strategy source.

| Validation item | Result |
|---|---|
| TiDB migration | `workspacePreferences` table applied and verified alongside `users`, `workspaces`, and `researchDrafts` |
| Ownership boundary | Protected workspace procedures derive the owner exclusively from the server-authenticated session user; no client owner or workspace identifier is accepted for authorization |
| Preference validation | Strict shared schema restricts symbols, timeframes, ranges, providers, layer IDs, watchlist count, and arbitrary keys |
| Conflict handling | Revision-aware save detects a different cloud revision and presents explicit **Use cloud workspace** / **Replace cloud with this device** choices |
| Local resilience | Guests remain local-only; database/mutation failure retains the browser workspace and states that cloud sync is unavailable |
| Research path | Existing account-scoped research-draft storage remains unchanged |

## Installable web app boundary

The Vite production build now emits a valid manifest, generated service worker, and 192px/512px application icons based on the existing ZTerminal brand mark. The manifest declares the `/terminal` standalone launch route and the production app’s dark theme colors. The in-app install control appears only when a browser provides an install prompt. iPhone/iPad users receive manual Safari **Share → Add to Home Screen** guidance rather than a misleading one-click install affordance.[1] [2]

| Resource | Service-worker policy |
|---|---|
| Revisioned JS/CSS/assets, manifest, app shell | Revisioned precache |
| Navigation | Cached shell fallback only; network remains primary |
| `/api/trpc/*`, account/session responses, Google identity | Never runtime-cached |
| Public quotes, candles, tape, depth, WebSocket data | Never runtime-cached |
| Workspace reads/writes | Never runtime-cached; server stays authoritative |

The generated worker’s only route is a navigation fallback with an explicit `/api/` denylist; it has no runtime caching declarations. This avoids representing stale authenticated or market data as current.

## Quality evidence

| Gate | Result |
|---|---|
| TypeScript | `pnpm check` passed |
| Focused workspace tests | 5 tests passed: preference contract plus protected router owner binding |
| Full regression | `pnpm test` passed: **27 test files / 93 tests** |
| Production build | `pnpm build` passed; generated `manifest.webmanifest`, `sw.js`, and Workbox asset bundle |
| Browser smoke | Local terminal rendered in guest/local mode; live terminal rendered the guest account control and Chromium **Install app** control without disrupting the workstation |

## Production activation evidence

The TiDB schema migration was applied before deployment and verified the `workspacePreferences`, `users`, `workspaces`, and `researchDrafts` tables. The user authorized the source promotion; Render built and started commit `155914a` in deployment `dep-da3fqfgu01pc738klvig` and reported the service live.

The public production checks returned the declared standalone manifest, HTTP 200 for `/sw.js`, the live **Install app** control, and enabled Google configuration. The live terminal DOM also resolved the guest sign-in control rather than leaving the header in a loading state. The user subsequently reported that the signed-in flow appeared to be working. To respect account privacy, no user workspace payload or preference value was retrieved by the validation process; ownership and conflict behavior are covered by protected-router tests and server-side authorization.

## References

[1]: https://web.dev/learn/pwa/web-app-manifest "Web app manifest — web.dev Learn PWA"
[2]: https://web.dev/learn/pwa/installation "Installation — web.dev Learn PWA"
