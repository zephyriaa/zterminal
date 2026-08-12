# SECURITY

Z TERMINAL is a research and hypothesis-testing environment. It does not
route real orders and does not custody funds. Nonetheless, it handles
market-data credentials and user-authored strategies, so the following
controls are enforced.

## 1. Credentials — never in the browser

This is the single most important rule. Rithmic (and any future real-market)
credentials are **server-side environment secrets** and must obey all of the
following:

- **Server-side only.** Credentials are read from environment variables in
  Next.js route handlers or a dedicated server process. They are never
  imported by client components, never serialized into API responses, never
  appear in client bundles.
- **Never in `localStorage`.** The Zustand `persist` stores
  (`zterminal-workspace`, `zterminal-strategy`) persist only UI preferences,
  strategy source, params, and config — never credentials.
- **Never in URLs.** No credential, token, or session id is passed as a
  query parameter or path segment. The socket.io connection uses
  `io("/?XTransformPort=3003")` — a port transform, not a credential.
- **Never in logs.** Heartbeat, reconnect, and connection-state logs must
  redact credentials and authentication payloads. The Prisma client in
  development logs queries; no query may carry a secret.
- **Never in Git.** No `.env` file with real secrets is committed. `.gitignore`
  must exclude `.env*` (except `.env.example` with placeholder values).
- **Never logged in error responses.** API error envelopes must not echo
  back credentials or environment-derived secrets.

## 2. Provider boundary

- The **Rithmic adapter runs server-side only.** It is not imported by any
  component under `src/components/` or `src/app/page.tsx`.
- The **mock provider needs no secrets.** It is the default and the only
  provider operational in this environment. Switching to a Rithmic provider
  requires server-side configuration that is never exposed to the client.
- The **socket.io mini-service** (`mini-services/market-data/index.ts`) runs
  as a separate Node process reachable only through the gateway transform
  port. It does not authenticate (it serves only SIMULATED data) and
  requires no credentials.

## 3. No real trading

- No orders are routed to any exchange. The execution-domain types
  (`Order`, `Execution`, `Position`, `AccountSnapshot`) in
  `src/lib/market/types.ts` are modeled for analytics and backtesting only.
- Every market-data surface in this environment is `SIMULATED` and must be
  labeled as such via the `SimulatedTag` primitive and the `DataStatus`
  field on every API response and socket event. Hiding the SIMULATED label
  is a defect.
- The terminal is **not authorized for production trading** in its current
  state. See `RITHMIC_INTEGRATION.md` and `PROJECT_RULES.md`.

## 4. Input validation

All client input is validated server-side in the API routes:

- `/api/bars` — validates `symbol` against the contract universe; clamps
  `bars`, `to`, `tf` to safe values.
- `/api/backtest` — validates `symbol` and strategy compilation; rejects
  requests with insufficient data; coerces numerics with `Number(...)`.
- `/api/strategy` — rejects empty source; returns structured diagnostics.
- `/api/contracts`, `/api/markets` — read-only, no client input beyond
  nothing.

Client-side validation is for UX only; the server is the trust boundary.

## 5. Recommended hardening before any production use

These are **recommendations**, not currently implemented controls:

1. **Authentication & authorization.** Add a real auth layer (session or
   token) before any production deployment. Currently the workspace is
   single-user and unauthenticated — appropriate for local research, not
   for a multi-tenant deployment.
2. **Rate limiting.** Apply rate limits to all API routes, especially
   `/api/backtest` (CPU-intensive) and `/api/bars` (deterministic but
   unbounded range requests).
3. **CORS lockdown.** The socket.io service currently allows
   `cors: { origin: "*" }`. In production, restrict to the trusted
   frontend origin.
4. **CSRF protection** for any state-changing endpoint if cookie auth is
   added.
5. **Secrets manager.** Move Rithmic credentials out of `.env` files into
   a secrets manager (e.g. AWS Secrets Manager, Doppler, Vault) before
   production.
6. **Audit logging.** Log connection lifecycle, backtest runs (with hash),
   and strategy saves — without ever logging credentials.
7. **Dependency scanning** (Dependabot / `npm audit`) and SAST in CI.

## 6. Reporting security issues

If a vulnerability is found in the credential handling, provider boundary,
or input validation paths, treat it as a blocker. Do not deploy, do not
log the issue with secrets in the report, and restrict the fix to a
server-side commit that does not surface the secret in its diff.
