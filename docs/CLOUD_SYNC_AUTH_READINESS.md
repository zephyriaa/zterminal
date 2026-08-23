# Cloud Sync and Google Sign-in Readiness

ZTerminal requires a server-side Google OAuth callback, durable database records for accounts and sessions, and workspace ownership checks before browser preferences can become cloud-synchronized user data. The public research posture does not change: authentication identifies a workspace owner; it does not grant brokerage, order, balance, or execution permissions.

The installed application dependency is NextAuth v4. Its documented Google provider requires `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, and the production OAuth client must register `https://zterminal.onrender.com/api/auth/callback/google` as an authorized redirect URI.[1] A local development client must also permit `http://localhost:3000/api/auth/callback/google`.[1]

| Requirement | Current audited state | Required before public enablement |
| --- | --- | --- |
| Google client | Production web client configured with the Render origin and server callback | Keep the client restricted to `https://zterminal.onrender.com` and its exact Auth.js callback |
| Google client secret | Stored as a protected `GOOGLE_CLIENT_SECRET` variable in Render; never committed | Rotate only through Google Cloud and Render, then disable obsolete secrets after verification |
| Session secret | Existing `JWT_SECRET` is available to the configuration | Reuse only after server-side verification, or introduce a dedicated high-entropy auth secret |
| Durable database | `DATABASE_URL` exists, but its provider and durability are unverified | Verify a managed PostgreSQL or other durable relational database; do not use container-local SQLite |
| Auth data model and route | Prisma account/session models, Auth.js handler, and owner-scoped sync API are implemented locally | Convert and apply a provider-correct migration, then deploy a migration workflow before activation |
| Production sign-in and writes | Deliberately disabled by `CLOUD_SYNC_ENABLED !== "true"` | Enable only after the durable database and production migration are verified |

The Prisma adapter documentation requires a relational `DATABASE_URL` and models for users, accounts, sessions, and verification tokens when database-backed sessions are used.[2] The implementation must use server-side sessions and owner-scoped workspace rows; browser local storage remains only an offline/local cache until successful sync is confirmed.

## References

[1]: https://next-auth.js.org/providers/google "NextAuth.js v4 Google provider"
[2]: https://authjs.dev/getting-started/adapters/prisma "Auth.js Prisma adapter"

## Google Cloud Configuration Record

On 2026-08-23, the user authorized creation of the Google Cloud project **ZTerminal Research** (`zterminal-research`) for this sign-in integration. The Google Auth Platform consent configuration was completed with the **ZTerminal** application name, an external audience in testing mode, the account owner selected as support and notification contact, and acceptance of the Google API Services User Data Policy. The consent configuration currently allows only standard OpenID Connect identity data (`openid`, `email`, and `profile`); no Google API scopes, Google Drive access, or trading-related permissions are requested.

The OAuth **web application** client is now registered with the production origin `https://zterminal.onrender.com` and callback `https://zterminal.onrender.com/api/auth/callback/google`; its client secret is stored only in Render as `GOOGLE_CLIENT_SECRET` and is never committed to the repository. Google currently still reports the external app configuration as incomplete and has no test users. The integration must therefore remain described as **testing-only**, not public-to-all, until the owner can be added as a test user and Google accepts the remaining branding configuration.

> **Release gate:** ZTerminal intentionally keeps both the Google provider and every cloud-workspace endpoint unavailable unless `CLOUD_SYNC_ENABLED` is explicitly `true`. Because Auth.js uses database-backed sessions, this same gate protects identity persistence as well as workspace synchronization. It must not be enabled until the actual production database provider, durability, migration, and rollback path have been verified.
