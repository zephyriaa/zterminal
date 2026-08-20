# Cloud Workspace and PWA Validation Record

**Status:** Implemented and validated on `product/orderflow-research-terminal`; **not yet promoted to Render production**.

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
| Browser smoke | Local terminal rendered in guest/local mode, preserving honest fallback while PWA controls did not break the workstation |

## Deployment boundary

The TiDB schema migration has already been applied because the running cloud-workspace APIs require the table. The source release remains on the product branch pending the user’s explicit confirmation to promote it to `render-hosted-research-terminal` and perform a manual Render deployment. After authorization, validation will cover the live signed-in workspace creation/sync path and the production manifest/service-worker assets.

## References

[1]: https://web.dev/learn/pwa/web-app-manifest "Web app manifest — web.dev Learn PWA"
[2]: https://web.dev/learn/pwa/installation "Installation — web.dev Learn PWA"
