# Deployment Guide

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
