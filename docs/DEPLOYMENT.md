# Deployment Guide

## Production hosting: Cloudflare edge + persistent Node backend

ZTerminal cannot currently be exported as a static Cloudflare Pages site. It is
a Next.js App Router application with route handlers, NextAuth/Prisma-backed
cloud sync, and a persistent Socket.IO market-data gateway. The supported,
low-risk migration is therefore a split deployment:

```text
Browser -> Cloudflare Worker (custom domain, CDN cache)
                 |-- immutable Next.js/Monaco assets: Cloudflare cache
                 `-- HTML, auth, APIs, downloads, Socket.IO: Node backend
```

The Worker in `cloudflare/edge-proxy.mjs` is intentionally a thin transport
layer. It contains no application credentials, does not cache HTML or API
responses, and passes WebSocket upgrades through to the backend. `render.yaml`
remains in the repository only as a rollback artifact until the cutover is
verified; the backend must be deployed to a persistent Node/Docker host such as
Railway before Render is retired.

### Bandwidth audit

The checked-in public directory is approximately 16.0 MiB. Its dominant cost is
the optional self-hosted Monaco editor at approximately 15.0 MiB, including a
6.7 MiB TypeScript worker and a 3.5 MiB editor API bundle. The largest landing
image is `public/landing/terminal-screenshot.png` (438 KiB); the equivalent
WebP used by the sticky showcase is 144 KiB. No video, GIF, or oversized font
asset is present.

The more significant recurring egress risk is architectural: the current
production Socket.IO gateway receives public Gate.io/Binance data upstream and
fans it out to every browser through the host. L2 and trade streams are not
safe to treat as ordinary web traffic. The Cloudflare proxy reduces delivery
cost for static requests but does not eliminate this per-client stream cost.
Before scaling the terminal, validate direct browser connections to the public,
unauthenticated exchange feeds for the specific providers and jurisdictions in
use, then retire the gateway only after feed integrity, CORS/WebSocket support,
and rate limits have been verified. Private feeds, broker credentials, and
authenticated data must remain server-side.

### Cloudflare setup

1. Deploy the existing Docker application to the replacement Node host using
   `railway.json` (or another host that supports Docker, persistent processes,
   and WebSocket upgrades). Do not use an ephemeral filesystem for production
   SQLite; set `DATABASE_URL` to a managed database before enabling cloud sync.
2. Configure the backend with the public Cloudflare origin for both
   `ALLOWED_ORIGIN` and `NEXTAUTH_URL`, then configure the Google OAuth callback
   as `https://<public-domain>/api/auth/callback/google`.
3. In Cloudflare Workers, connect the GitHub repository and create a Worker
   Build for `main`. Use `npx wrangler deploy` as its deploy command (no custom
   GitHub Action is required). Add `BACKEND_ORIGIN` as a Worker secret containing
   the HTTPS backend origin, for example with `npx wrangler secret put BACKEND_ORIGIN`.
4. First verify the generated `*.workers.dev` URL. Then attach the production
   custom domain to the Worker and make it the canonical public origin. Keep
   the backend origin private/unadvertised where the host supports it.
5. Test `/`, `/terminal`, `/docs`, `/download`, OAuth sign-in, browser refresh,
   `/_next/static/*`, and the live Socket.IO feed. Only then remove the Render
   service and its deployment workflow.

For a local Worker smoke test, create an untracked `.dev.vars` containing only
`BACKEND_ORIGIN=https://your-backend.example` and run:

```bash
npx wrangler dev
```

Never commit `.dev.vars` or set private API, OAuth, broker, or database secrets
in the Worker. `BACKEND_ORIGIN` is deployment configuration, but should still
be configured as a Worker secret to avoid exposing internal topology.

### Environment inventory

| Class | Variables |
|---|---|
| Public feature flags | `NEXT_PUBLIC_ZT_*` |
| Backend required | `ALLOWED_ORIGIN`, `NEXTAUTH_URL`, `AUTH_TRUST_HOST`, `MARKET_PROVIDER`, `MARKET_DATA_PORT`, `APP_PORT` |
| Server secrets | `DATABASE_URL`, `NEXTAUTH_SECRET` (or `JWT_SECRET`), `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `FRED_API_KEY`, `FINNHUB_API_KEY`, `RESEARCH_API_URL` when used |
| Release configuration | `WINDOWS_RELEASE_*` |
| Cloudflare Worker secret | `BACKEND_ORIGIN` |

Do not use the local fallback authentication secret in a public deployment;
configure `NEXTAUTH_SECRET` explicitly. Never prefix server secrets with
`NEXT_PUBLIC_`.

### Railway persistence and cutover gate

`src/lib/db.ts` defaults to `file:<repository>/db/custom.db` only when
`DATABASE_URL` is unset. That path is suitable for local development and is
**not durable on Railway**: Railway service filesystems are ephemeral unless a
Volume is attached. Before the first Railway deploy, attach one Railway Volume
to the web service at `/data` and configure the private service variable:

```bash
DATABASE_URL=file:/data/custom.db
```

Run `npx prisma migrate deploy` against that same URL as a release step, not
during image build (Railway does not mount Volumes during the build phase).
Take a verified SQLite backup before schema changes and periodically copy a
consistent database snapshot to private durable storage. SQLite permits only a
single writer, so this service must remain a **single instance** and its Volume
must not be shared with another writer. A managed PostgreSQL migration is only
needed if multi-instance writes, HA, or concurrent administrative access become
requirements.

Railway has not been authenticated from this workspace, so no Railway URL or
Cloudflare secret has been created. Do not set `BACKEND_ORIGIN` or change DNS
until the Volume-backed backend returns healthy after a restart.

### Public market-data transport matrix

| Feed | Classification | Client direct? | Current / target transport |
|---|---|---|---|
| Gate.io futures trades, ticker, L2 | Public; no secret | Yes | Browser provider; shared per symbol |
| Binance USD-M aggTrade, ticker, L2 | Public; no secret | Yes | Browser provider; shared per symbol |
| Binance mark price / liquidation | Public; no secret | Yes | Direct only after the normalized derivatives/liquidation adapter is enabled |
| Deribit trades, books, options | Public; no secret | Technically yes | Not implemented in this repository; do not claim a feed exists |
| Google OAuth, cloud workspace | Server protected | No | Node backend |
| Rithmic/CQG/broker credentials | Private/authenticated | No | Secure local/native or protected backend boundary |
| GEX/options-derived datasets | Server-derived/shared computation | Case-by-case | Not implemented; evaluate payload size before decentralizing |

The direct browser provider is deliberately separate from React. It has one
connection per selected exchange, reference-counts symbols, normalizes events,
and retains book state outside render state. The Socket.IO gateway remains a
rollback path until browser integration has passed live snapshot/sequence-gap
tests; do not run both paths for the same public feed in production.

## What Must Run

ZTerminal consists of two cooperating Node processes. The Next.js process
serves the terminal UI and server routes. The market-data gateway maintains a
persistent upstream Gate.io WebSocket and exposes a Socket.IO stream on port
`3003`. Deploy both processes together, keep the gateway internal to the
application network, and expose only the HTTPS application origin publicly.

| Process | Command | Health check |
|---|---|---|
| Terminal web application | `npm run start` after `npm run build` | `GET /api` returns a JSON response |
| Market-data gateway | `npm run market-data` | `GET http://127.0.0.1:3003/healthz` and `/readyz` |
| Combined process supervisor | `npm run start:production` after build | Both checks above |

## Required Configuration

Copy `.env.example` to your host’s private environment configuration. Do not
commit an environment file. For a real public deployment, set
`ALLOWED_ORIGIN` to the exact HTTPS origin serving ZTerminal; an empty value
is permitted only for local development.

```bash
MARKET_PROVIDER=gateio
MARKET_DATA_PORT=3003
ALLOWED_ORIGIN=https://terminal.example.com
```

Use `MARKET_PROVIDER=mock` only as a deliberate offline development mode. It
makes the UI label data as `SIMULATED`; it must never be used to represent a
live provider.

## Build and Run

```bash
npm ci
npm run typecheck
npm test
npm run build
npm run start:production
```

Before opening the service to users, query both readiness endpoints. A process
may be healthy while Gate.io is unavailable. Treat a non-success `/readyz`
response as a **not-ready-to-serve** condition for live market data.

```bash
curl -fsS http://127.0.0.1:3003/healthz
curl -fsS http://127.0.0.1:3003/readyz
```

## Reverse Proxy and TLS

The supplied `Caddyfile` exposes one public application port and routes `/socket.io`,
`/healthz`, and `/readyz` to the internal market-data gateway on port `3003`.
All remaining traffic is routed to the Next.js application on port `3000`. This
keeps browser WebSocket traffic same-origin on any supported Docker host, while
the gateway remains inaccessible as a separately exposed public service. Terminate
TLS at the host proxy and never make an unauthenticated control/connector endpoint
available over plain HTTP.

## Persistent Hosting

The upstream market-data connection needs a process that stays running. Use a
hosting mode that supports a single persistent service, two supervised
processes, and WebSocket upgrades. A managed reserved web-service runtime is
usually enough for the current read-only Gate.io gateway. Use a VM/container
only if your target provider cannot supervise both processes or you require
operating-system-level controls.

## Rithmic Connector Boundary

The Rithmic form is intentionally **not** a live adapter. It is a rate-limited,
server-side runtime input boundary that clears the browser password after a
request and refuses to connect until the official Rithmic dev-kit, Test
integration, and conformance approval exist. Do not put Rithmic credentials in
environment files, source files, CI variables, sample data, logs, issue text,
or Git history.

## Release Checklist

| Check | Required result |
|---|---|
| `npm run typecheck` | Exit code `0` |
| `npm test` | All deterministic tests pass |
| `npm run build` | Production build completes |
| Live smoke test | Discovers `QQQX_USDT`, receives Gate.io trade data, and synchronizes depth |
| `/readyz` | Reports ready after a real subscription and fresh provider data |
| Security scan | No tracked `.env`, credential, token, key, or personal account material |
| Browser test | Chart loads bars; Order Flow shows `GATEIO · LIVE`; Rithmic password clears after submit |

The service must report any provider interruption as `STALE`, `DEGRADED`, or
`UNAVAILABLE`. It must not silently fall back to synthetic values or call the
feed live when it is not.
