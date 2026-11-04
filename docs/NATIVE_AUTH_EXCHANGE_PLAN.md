# Windows sign-in exchange contract

Updated 28 October 2026. Native and server implementations exist locally in Phase
02; production deployment and real browser/native sign-in acceptance remain
unverified. Google/NextAuth database identity remains authoritative. No parallel
identity source was added.

Native implementation: `apps/windows-host/src/native_account.{h,cpp}` and
`winui/MainWindow.account.cpp`. The public client is `zterminal-windows`. An
exclusive kernel-assigned IPv4 loopback listener is bound before opening the
system browser. Only exact `http://127.0.0.1:<ephemeral-port>/native/callback`
callbacks with the current random state and one code/denial are accepted. PKCE
S256 uses independent cryptographic random state and verifier; only the challenge
is included in the browser URL. Listener lifetime is bounded and cancellable.

Server implementation: `src/lib/native-auth.ts`, `native-auth-http.ts` and
`src/app/api/native/auth/*`. Browser authorization requires a verified existing
NextAuth session, same-origin POST and identity/request-bound signed consent.
Codes expire after 60 seconds, are stored only as hashes and are consumed by an
atomic compare-and-update transaction. Callback, client ID and S256 verifier must
match. Token/session endpoints reject browser cookies and Origin headers rather
than bypassing the existing cookie-authenticated web APIs.

Device access is `native:identity` only. Five-minute opaque access tokens and
rotating refresh tokens are hashed server-side. Refresh-token reuse revokes the
whole family; session lifetime is absolutely bounded to 30 days. Removing a
single device is owner-scoped. “Sign out everywhere” revokes all that user's
native sessions, pending codes and browser database sessions. No native token
authorizes workspace synchronization or provider access.

Windows Credential Manager holds the complete native credential envelope under
a per-Windows-user, per-Store-root target. It never goes through JSON sidecar
requests, localStorage, logs or callback URLs. A verified exchange completes
onboarding only after credentials are protected. Opening/cancelling the browser
never marks onboarding complete. Offline choice is durable and valid without
any account. Failed offline revocation is retained as a protected pending record
and retried; local work is not removed. Native account operations are serialized
to prevent cancelled and newer exchanges overwriting each other's credentials.

Production gate: additive SQLite migration and `prisma/native-auth.postgresql.sql`
are local candidates. PostgreSQL SQL creates tables and applies RLS/revokes within
one transaction; Auth.js users do not map to Supabase auth.uid(). The server must
connect with its existing trusted owner/BYPASSRLS role. No public/browser role is
granted table access. Apply/verify the production migration through the existing
release workflow, then set `ZTERMINAL_NATIVE_AUTH_ENABLED=1`. It defaults off.
Neither hosted database migration nor account endpoint publication occurred.

Tests use isolated synthetic users/databases and native loopback/Credential
Manager fixtures. They cover exact callback allowlisting, known RFC PKCE vector,
consent binding/expiry, wrong verifier, code expiry/replay/race, refresh rotation
and reuse, access/session expiry, device/owner separation, all-account revocation,
browser-cookie/Origin denial and native HTTP token/session/revoke handlers.
Real successful/denied/cancelled browser sign-in, clean Windows-profile isolation,
DPI/high contrast and native UI restart journeys still require device evidence.

Guidance checked 28 October 2026:
- https://www.rfc-editor.org/rfc/rfc8252.html (external user agent, loopback, PKCE)
- https://www.rfc-editor.org/rfc/rfc9700.html (refresh replay protections)
- https://supabase.com/docs/guides/database/postgres/row-level-security (grants/RLS)
