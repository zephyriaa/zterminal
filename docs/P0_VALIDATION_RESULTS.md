# P0 Validation Results

## Automated validation

| Check | Result |
|---|---|
| Unit tests | Passed: 35 tests, including deterministic Binance L2 and order-flow cases. |
| TypeScript | Passed: `npm run typecheck`. |
| Lint | Passed: `npm run lint`. |
| Production build | Passed: `npm run build`. |
| Binance gateway live probe | Passed on local port 3003 after a 50-second warm-up: 2,868 trades, 28,817 quotes, 415 synchronized depth events, and 5 derivatives updates. |

The live validation intentionally accepts zero liquidation prints: liquidation events are exchange-declared and are never generated synthetically.

## Regional data limitation

Binance public open-interest requests can return HTTP 451 in this environment. The adapter emits `openInterestStatus: "unavailable"`; UI therefore presents **Unavailable** and withholds OI delta. This is intentional data-integrity behavior. The L2 snapshot route also showed transient HTTP 451 responses during testing, so the bridge now retries with bounded jitter and never emits a depth book until it is sequence-safe.

## Production endpoint observation

The repository `main` branch was pushed at commit `978fd24d4b2619fc02cee21f9e8ce4aaaaf3266a`. Immediately after the push, `https://zterminal.onrender.com/health/market-data` returned the existing public route-recovery UI rather than the new Caddy health JSON. That response shows the currently served Render deployment is not yet this pushed Docker/Caddy revision, or the Render service is configured to use a different application layout/route. It is not evidence of a gateway data failure.

Render configuration must use this repository's Dockerfile and set `MARKET_PROVIDER=binance` plus `ALLOWED_ORIGIN=https://zterminal.onrender.com`; the full handoff is in `docs/P0_RENDER_DEPLOYMENT.md`.
