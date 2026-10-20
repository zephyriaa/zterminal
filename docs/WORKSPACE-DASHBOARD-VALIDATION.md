# Workspace dashboard verification — 2026-10-20

Scope: `/workspaces` is the lightweight entry point; `/workspaces/[id]` owns a saved workspace. `/terminal` redirects compatibly. The marketing root remains unchanged apart from launch destinations.

## Automated checks

- PASS: 354 Node tests against a migrated disposable SQLite database, including owner/revision checks, shared draft merge conflicts and cooperative editor takeover.
- PASS: TypeScript check and Next production build, including packaged Monaco verification.
- PASS: ESLint, zero errors; 11 existing unused-directive warnings remain.
- Local Cloudflare assembly: Next compilation succeeds; Windows denies OpenNext's Prisma symlink (`EPERM`). The existing Linux GitHub quality gate verifies complete Worker assembly before merge.

## Real browser checks

Browser Harness, recording disabled, task origin `http://127.0.0.1:3100`:

- PASS: Dashboard recovers the pre-existing local workspace without opening it; no Helper, candle, trade or depth resources are requested by the dashboard.
- PASS: Creation opens a new browser tab. Chart starts with only Chart; Order Flow starts with Chart and Order Book; Python Research starts with Chart and Python Strategy.
- PASS: BTC Chart retained its changed 15m timeframe on reopen; independent ETH Order Flow and BTC 1h Python Research retained their selected markets/settings.
- PASS: A second tab opens with an inert, read-only canvas. Cooperative takeover makes the original tab read-only and restores the saved timeframe in the new editor.
- PASS: Duplicate creates a separate local UUID; rename works after closing the actions menu. Deletion uses a native confirmation dialog and preserves the shared Python library and Helper archives.
- PASS: Packaged Helper 1.2.0-preview.1 paired through the new Research workspace. A real 90-day hourly backtest prepared market history, completed, archived its result, and opened Research Report after the run.
- PASS: Desktop 1536px and mobile 390px captures; loaded Geist confirmed using computed styles. Fresh finish reviewer scored the typography, documentation and recency-label fixes resolved. Final disposition: ship for that fix list.

## Evidence and boundaries

Review captures and detector adjudication are under `.impeccable/review/`. Existing Google database sessions, owner-scoped routes and same-origin mutation checks remain authoritative; real Google sign-in/cloud synchronization across devices was not exercised in the local anonymous browser. Database tests verify ownership and stale-write rejection, not the Google OAuth journey.

The separate live market gateway was unavailable during verification. Historical provider candles and direct Helper data preparation worked. Launcher verification does not close the earlier live order-flow acceptance gates. No schema migration, trading semantics change, Helper release or native Windows architecture change is included.
