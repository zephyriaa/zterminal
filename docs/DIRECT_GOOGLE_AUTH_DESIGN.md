# Direct Google Identity Design

**Decision:** ZTerminal will use Google Identity Services for Google-only login and retain its existing Express/tRPC/Drizzle account and workspace model. Firebase Authentication and Firestore are not introduced.

## Security contract

Google Identity Services returns a Google ID token to the browser. ZTerminal does not trust browser-provided account fields. The server verifies the token through Google’s Node authentication library against the configured Google web client ID. The server accepts a subject only after validation of signature, audience, issuer, and expiry, then uses the verified Google `sub` as the external identity key. Google expressly identifies `sub` as the durable account identifier and says that email must not be used as the account key.[1]

The login mutation also uses a double-submit CSRF value. Before rendering a usable Google button, a public configuration procedure generates a high-entropy, client-readable, host-scoped CSRF cookie and returns the same value. The subsequent login mutation must receive the same value in its typed request body and cookie header, comparing the values in constant time. A mismatch, missing value, missing Google configuration, invalid/expired token, unknown external subject, or unavailable database fails closed.

| Layer | Contract |
|---|---|
| Browser | Loads Google Identity Services only when the deployment says Google login is enabled. It receives a Google credential and submits it through ZTerminal’s typed API with the matching CSRF value. It never stores an ID token as a durable application session. |
| Server verification | Uses the configured `GOOGLE_CLIENT_ID` as the required ID-token audience. The server maps a verified `sub` to `google:<sub>`, stores optional profile fields only as display data, and never treats email as the unique identity key. |
| ZTerminal session | After the user is upserted in the existing `users` table, the server issues an application JWT signed with `JWT_SECRET` and sends it only in the existing secure, HTTP-only session cookie. The session expires after 14 days, rather than the legacy one-year OAuth period. |
| Protected data | Existing tRPC `protectedProcedure` continues to rely only on `ctx.user`. Research drafts remain joined to a user-owned workspace, so one Google account cannot list or save another user’s data. |
| Guest use | Market research remains available without a session. A disabled Google control and explicit explanation are shown until database, session secret, and Google client configuration exist. |

## Session compatibility

The existing `users.openId` field remains the unique external-identity slot for this release. Google identities are namespaced as `google:<sub>` to prevent collisions with historical identifiers, while still deriving solely from the immutable verified subject. Session claims gain an explicit provider field. Legacy Manus OAuth session handling remains isolated until it can be removed in a deliberate migration; direct Google sessions never call the old OAuth profile endpoint.

## Typed procedure surface

| Procedure | Access | Behavior |
|---|---|---|
| `auth.googleConfig` | Public | Returns only the public Google client ID and whether login can be enabled. It sets a short-lived double-submit CSRF cookie when enabled. |
| `auth.googleSignIn` | Public, rate-limited | Receives `credential` and CSRF value. It validates CSRF, verifies the Google token, upserts the mapped account, writes the secure ZTerminal session cookie, and returns a sanitized current user. |
| `auth.me` | Public | Returns the session-derived current user or `null`. |
| `auth.logout` | Public | Clears the ZTerminal session and Google CSRF cookie. |
| `research.*` | Protected | Keeps the current database-owned workspace isolation unchanged. |

## Required configuration

Direct Google login is **disabled unless all conditions are met**. The release needs the following Render environment values, none of which will be committed to the repository: `GOOGLE_CLIENT_ID`, `JWT_SECRET`, and `DATABASE_URL`.

`GOOGLE_CLIENT_ID` is the Google Cloud web OAuth client ID used by the server as the required token audience. After the server validates its configuration, the same non-secret client ID is returned through the public configuration procedure solely to render Google’s sign-in control; a separate `VITE_GOOGLE_CLIENT_ID` is optional and not required. `JWT_SECRET` must be a new high-entropy server-only secret. `DATABASE_URL` enables account and workspace ownership persistence. The Google Cloud OAuth client must list `https://zterminal.onrender.com` as an authorized JavaScript origin and `http://localhost:3000` as a local development origin if local browser testing is desired.

## Test boundaries

The release must prove CSRF mismatch rejection, missing configuration fail-closed behavior, untrusted payload rejection, verified-subject mapping, provider-aware application session validation, protected research ownership, logout cookie clearing, type-checking, full test-suite success, and production build success. Live Google browser authentication is deferred until the owner supplies the Google Cloud client ID and Render environment settings.

## Reference

[1]: https://developers.google.com/identity/gsi/web/guides/verify-google-id-token "Google Identity Services: Verify the Google ID token on your server side"
