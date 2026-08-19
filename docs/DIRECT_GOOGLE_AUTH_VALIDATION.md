# Direct Google Authentication Validation

**Status:** Implementation validated; live identity activation intentionally pending owner-controlled Google Cloud and Render configuration.

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
