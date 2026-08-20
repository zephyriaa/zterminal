# Direct Google Authentication Validation

**Status:** Direct Google identity activation is live in production with a server-verified, CSRF-protected account path. The current product-branch terminal-account UI follow-on remains pending separate production promotion.

## Implementation evidence

The product branch now contains a direct Google Identity Services account path. The browser asks the public `auth.googleConfig` procedure whether all required configuration is present. Only when a Google client ID, durable database URL, and session-signing secret pass validation does the browser load Google’s native rectangular button. The direct-login mutation validates a short-lived double-submit CSRF token, verifies the Google credential server-side with Google’s supported Node library, maps only the verified Google subject to `google:<sub>`, upserts the existing `users` record, and writes ZTerminal’s own 14-day HTTP-only session cookie.

| Boundary | Validation result |
|---|---|
| Configuration gate | Unit-tested: missing client identity, database URL, or a session secret shorter than the established minimum leaves Google login disabled. |
| CSRF exchange | Unit-tested: only equal, non-empty cookie/request values are accepted via constant-time comparison. |
| Identity key | Unit-tested: the account key is a namespaced immutable subject; email is optional display data and only retained when Google marks it verified. |
| Server verification | Implemented using `google-auth-library` and the configured web client ID as required audience. Browser-provided names, emails, and subjects are never used directly. |
| Application session | The existing signed session now carries an explicit provider claim. Google sessions do not fall through to the legacy OAuth user-info endpoint, and they fail closed if the persisted account record is unavailable. |
| Workspace ownership | The existing protected research procedures still operate through `ctx.user.id` and join every draft through its owning workspace. No cross-account behavior was changed. |
| Logout | Regression-tested: logout clears both the HTTP-only application session and the Google CSRF cookie. |

## Automated quality gates

Static validation completed successfully with `pnpm check`. The full Vitest suite completed successfully with **24 test files and 85 tests**, including five direct Google identity contract tests and the updated logout regression. The production build completed successfully with `pnpm build`.

## Browser validation

The local server was restarted after the account-flow change. At `http://localhost:3000/account`, the guest account surface rendered its deliberate account-ownership copy, secure guest fallback, and the expected disabled message: **“Google sign-in requires deployment configuration.”** This is the correct fail-closed state because no `GOOGLE_CLIENT_ID`, `DATABASE_URL`, or production `JWT_SECRET` has been configured for the local or Render deployment. The browser therefore did not load or render a misleading live Google control.

## Remaining activation boundary

A live Google browser round trip cannot be performed until the owner creates the Google Cloud web client and configures `GOOGLE_CLIENT_ID`, `JWT_SECRET`, and `DATABASE_URL` in Render. The required console steps and post-deploy acceptance checks are specified in [Direct Google Account Setup](./DIRECT_GOOGLE_ACCOUNT_SETUP.md). Production promotion and deployment remain separate user-authorized actions.


## Google Cloud configuration progress — 2026-08-20

The authenticated Google Cloud project **ZTerminal** (`zterminal`) initially had no OAuth clients. The Google Auth Platform consent configuration was created after user confirmation with the following verified setup: application name **ZTerminal**, external testing audience, and `novalesss@proton.me` as both user-support and developer contact. No Firebase service, Google API data scope, service account, client secret, paid database, or billing activation was created. The console then entered the OAuth web-client creation route; the client form was still loading at the time of this record, so no client identifier or authorized origin has yet been created.


The Google Auth Platform consent configuration and the enabled **ZTerminal Web** OAuth client were created successfully on 2026-08-20 in project `zterminal`. The client is a Web application restricted to the JavaScript origins `https://zterminal.onrender.com` and `http://localhost:3000`; no redirect URI was configured. The client is in Google’s external testing state. The visible client secret was deliberately neither copied nor stored because the implemented Google Identity Services flow does not use a browser client secret; only the non-secret client ID will be placed in Render’s secured environment configuration.


The authenticated owner `novalesss@proton.me` was added and verified in the Google Auth Platform test-user list. The application remains in **Testing** status with one authorized user; it was not published publicly. Direct Google configuration is now ready for a controlled live login check once the compatible durable datastore, Render environment settings, and release are completed.


## Render environment inventory — 2026-08-20

The authenticated Render dashboard for service `srv-d9uogdajobas73bbnn1g` was inspected without reading or exposing secret values. Its **Environment Variables** list is empty, no secret files are configured, and no environment group is linked. The service is a Docker web service on the free plan and is bound to `zephyriaa/zterminal` branch `render-hosted-research-terminal`. There is therefore no existing `DATABASE_URL`, Google client configuration, or signing secret to reuse. The current Drizzle configuration uses the MySQL dialect, so a storage choice must be MySQL/TiDB compatible or be accompanied by a deliberate schema-and-migration rewrite; no such storage was created during the inspection.


## Durable workspace storage provisioning — 2026-08-20

A TiDB Cloud **Starter** instance named `zterminal-workspaces` was created in AWS **N. Virginia (`us-east-1`)** for the existing MySQL-dialect Drizzle schema. The instance ID is `10119688735981124709`; its configured monthly spending limit is **$0**, its current spend is **Free**, and the dashboard confirmed that no credit card is required. TiDB reported initial free capacity of up to 5 GiB row-based storage and 50M request units for the instance. At the last check the instance was still in `Creating` state; no connection credential, database URL, schema migration, or Render secret has yet been generated or applied.


The TiDB Starter instance became **Active** on 2026-08-20. The connection wizard reports a public TLS endpoint at `gateway01.us-east-1.prod.aws.tidbcloud.com:4000`, with the current sandbox IP allowlisted. The dashboard confirms public-endpoint TLS is required. No root password has been generated or saved, and no credential has been placed in source control. The next step is to create a dedicated `zterminal_app` database principal and the `zterminal` database through the authenticated SQL editor, then apply migrations using the least-privilege connection.


The authenticated TiDB SQL Editor executed `CREATE DATABASE IF NOT EXISTS zterminal` successfully on the active Starter instance, returning `Query OK`. No database user password was generated and no secret value was copied. The remaining migration work is limited to the application’s `users`, `workspaces`, and `researchDrafts` tables plus their ownership indexes.


### TiDB migration execution note

The browser SQL editor accepted the short `CREATE DATABASE` statement and confirmed success. Its full-schema execution path then proved unreliable: a long typed query timed out after partial entry, and the editor reported a parse error near the closing parenthesis for the original Drizzle-style timestamp/default syntax. A revised query was loaded, but the web editor retained the previous failed query in its run history rather than reliably reporting a fresh execution. The migration was therefore moved to a deterministic TLS client runner rather than relying on ambiguous editor state.

### TiDB schema activation — verified 2026-08-20

A direct TLS migration runner using the TiDB MySQL-compatible protocol created and verified the account-isolation schema in database `zterminal`. The verification query returned exactly the required tables: `users`, `workspaces`, and `researchDrafts`. The connection secret was used only as a process environment variable and is not stored in this repository or this validation record.


### Google OAuth client-ID retrieval state — 2026-08-20

The authenticated Google Auth Platform clients route was reopened for the existing `zterminal` project after TiDB schema verification. The console chrome and signed-in session loaded, but the client-list pane remained in its loading state. The next activation step is limited to retrieving the non-secret web client ID through an alternate console route or the page once it completes; no client secret is required or will be used.


The loaded Google Auth Platform Clients view confirms that project `zterminal` contains exactly the intended **ZTerminal Web** OAuth 2.0 client, created on 2026-08-20 with type **Web application**. The client-list row shows a client-ID prefix beginning `761687626475-8djm`; the full non-secret ID will be retrieved from the client detail view before it is added to Render.


### Render activation deployment — started 2026-08-20

Following explicit user confirmation, the Render service accepted the three required secured environment variable keys—`GOOGLE_CLIENT_ID`, `JWT_SECRET`, and `DATABASE_URL`—and automatically triggered deployment `dep-da3d3n3m8hqs73a7b8qg` from production commit `be53fd8`. Render’s deployment log confirms that it checked out the configured production branch and began the Docker build. Secret values are intentionally not recorded here.


### Approved direct-Google source promotion — 2026-08-20

After explicit user confirmation, the production branch was fast-forwarded from `be53fd8` to release commit `3e00210`. The release was assembled in an isolated worktree from the actual production commit by applying the approved institutional account-boundary and direct-Google commits only; no unrelated branch history was merged. In that exact release ancestry, `pnpm check`, the full Vitest suite (**24 files, 85 tests**), and `pnpm build` all completed successfully before the push. Render is expected to build this updated configured production branch next.

### Direct Google activation and CSRF refresh hotfix — live 2026-08-20

Render successfully deployed the direct Google foundation as `3e00210`, after which the public `auth.googleConfig` procedure reported enabled configuration and the configured Google sign-in control rendered at `/account`. A real owner login was subsequently confirmed by the user. During that round trip, the provider chooser could remain open longer than the page’s former short-lived CSRF token. The server correctly rejected that stale token rather than weakening the CSRF boundary.

A focused one-file remediation refreshes the double-submit CSRF cookie/token pair immediately before the browser submits the returned Google credential. The server still requires a non-empty, matching short-lived token and performs the same server-side ID-token verification. The hotfix commit `2a739a2` passed `pnpm check`, **24 test files / 85 tests**, and `pnpm build`, then was deployed live through Render deployment `dep-da3e8ie7bikc739q8rgg`. Render logged successful server startup and marked the primary URL live. No secret value, OAuth client secret, or database credential is recorded here.

### Terminal account visibility follow-on — product branch validation 2026-08-20

The next product-branch slice replaces the terminal’s decorative account orb with a real authenticated account control. It shows a guest sign-in entry when no session exists and, for a signed-in Google account, presents verified identity display data, workspace disclosure, account navigation, and ZTerminal logout. This follow-on is validated locally and remains pending a separate production promotion; it does not alter the session or identity-verification boundary.
