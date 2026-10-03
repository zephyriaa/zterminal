# Drawing repair release — October 4, 2026 (Asia/Baku)

Target: Cloudflare Worker `zterminal-web`, https://zterminal-web.zephyria-inc.workers.dev/terminal.

Source repair commit in the primary checkout: `d905f1b`. This isolated release starts from `444ec6d`, the source checkpoint of the current live Worker version `a6e60139-7459-4490-8792-1fa0d537117a`, confirmed through Wrangler deployment history. The branch is `codex/drawing-release-2026-10-04`.

## Scope

Ship drawing future/fractional time projection, position right-border time-only resizing, snapping, geometry/render alignment, pointer cancellation, text sizing, flyout clipping/keyboard access, duplicate-shortcut handling, and exact terminal connection CSP origins. This corresponds to D1–D10, D14 and D15 in the local audit. D11–D13 belong to the ongoing desktop/dashboard implementation and remain local; they are excluded here, as are unpublished Research Core work and other dirty market/backend/landing/native files.

Only the frontend Worker changes. No backend deployment, Helper update, database migration, schema change, secret modification, or push to `main` is part of this release. Release branch publication provides source traceability without invoking the main-push backend workflow.

## Gates and build

- Isolated SQLite client generation and all four existing migrations applied to a newly created ignored `artifacts/release-tests.db`; tracked `db/custom.db` and production PostgreSQL were not changed.
- Isolated `npm test`: 207 passed, zero failed. This count differs from the full dirty checkout's 237 tests because unrelated new work is excluded.
- `npm run typecheck`: passed.
- Full isolated `npm run lint`: passed, zero errors and 11 existing unused-disable warnings. `NODE_OPTIONS=--max-old-space-size=4096` was used; the earlier primary-checkout heap failure is not counted as a pass.
- Primary and isolated optimized-build browser drawing suites: 26 passed each, including long/short right-border resizing with fixed entry/target/stop, corner extension, cancellation, persistence and narrow flyouts.
- Isolated `npm run test:terminal`: passed at 1440, 768 and 390 pixels; `npm run test:drafts`: passed.
- Independent review against `444ec6d`: no code blockers; 14 targeted geometry/projection/CSP tests rerun successfully.

Worker preparation generates the PostgreSQL client with a build-only placeholder URL, explicitly prepares self-hosted Monaco, runs `npx next build --webpack`, then `npx opennextjs-cloudflare build --skipNextBuild`. The last flag avoids rerunning the already verified Next build; it does not skip that gate. The previously tested Windows directory-junction preload is copied to an ignored build artifact and used only by the build process to retry directory symlinks on EPERM. It does not alter file links or suppress other errors. No live database connection is made by these build steps.

## Environment and rollout

Keep the existing Worker variables and secrets using `wrangler deploy --keep-vars`. Checked secret names: `AUTH_SECRET`, `NEXTAUTH_SECRET`, `DATABASE_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`. No values are copied or exposed. Public auth origin and internal origin remain `https://zterminal-web.zephyria-inc.workers.dev`; Google callback remains `/api/auth/callback/google` at that origin. Assets, R2 artifact binding and self-reference service remain unchanged.

Before publication: verify the actual OpenNext bundle and Wrangler dry run. After publication: confirm home/terminal/health/auth endpoints, self-hosted Monaco assets, private terminal cache headers, and the 26 real browser drawing regressions against the live Worker. Live continuous market-feed success and actual Helper computation are outside this drawing release's claims.

Rollback if a material regression appears: `npx wrangler rollback a6e60139-7459-4490-8792-1fa0d537117a --config wrangler.jsonc --message "Rollback drawing repair release"`. No database rollback is required.

## Outcome

Optimized Next/Webpack build and PostgreSQL OpenNext bundle passed. Wrangler dry run passed: 298 assets and Worker gzip 2401.22 KiB, with the expected assets/R2/self-reference/auth-var bindings. Self-hosted Monaco loader is present in the bundle. Production baseline health/auth config/provider discovery returned 200, auth is enabled, and anonymous profile/cloud-workspace requests returned 401. Pending live publication and verification; do not treat this note as evidence of a completed rollout until updated.
