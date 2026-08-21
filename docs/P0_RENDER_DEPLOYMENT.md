# P0 Binance Order-Flow Workstation — Render Deployment Handoff

## Deployment target

The production target remains `https://zterminal.onrender.com`. The Docker entrypoint runs three co-located processes: the Next.js application on `3000`, the read-only market-data gateway on `3003`, and Caddy on Render's public `PORT`. Caddy now proxies Socket.IO, readiness, and `/health/market-data` to the gateway.

> **P0 remains research-only.** The gateway has no account credentials, execution endpoints, or order-routing code.

## Required Render environment variables

| Variable | Required value | Purpose |
|---|---|---|
| `MARKET_PROVIDER` | `binance` | Activates the Binance USDⓈ-M Futures adapter rather than the Gate.io regression provider. |
| `ALLOWED_ORIGIN` | `https://zterminal.onrender.com` | Permits the same public production origin to establish the proxied Socket.IO connection while the gateway runs in production mode. |
| `MARKET_DATA_PORT` | `3003` | Optional explicit default for the internal gateway port. |
| `APP_PORT` | `3000` | Optional explicit default for internal Next.js port. |

No Binance API key is required: the P0 adapter uses documented public Futures WebSocket and REST routes only. `BINANCE_FUTURES_WS_URL` and `BINANCE_FUTURES_REST_URL` remain optional overrides for controlled network testing; do not set them in ordinary production deployment.

## Post-deploy checks

| Check | Expected observation |
|---|---|
| `GET /readyz` | HTTP 200 after Binance contract discovery succeeds. |
| `GET /health/market-data` | JSON identifies `provider: "binance"` and includes active feed snapshots once a client subscribes. |
| Browser header | The compact feed badge progresses from `SYNCING` to `LIVE` and its inspector shows the provider, instrument, last book sequence, message age, and reconnect count. |
| BTCUSDT chart | Candles remain primary. The optional CVD pane and footprint pane render only observed trade flow; the mark-price line appears only when Binance supplies a mark price. |
| Order Flow view | Time & Sales, DOM, footprint, CVD, funding, mark/index, official liquidation tape, feed provenance, and Research Mode remain available. |
| OI endpoint restriction | If the selected Render region receives a Binance HTTP 451 for open interest, UI shows **Unavailable** and does not manufacture OI or OI delta. |

## Live data behavior and safeguards

The local L2 book buffers Binance diff-depth updates until a REST snapshot can bridge the documented initial sequence range. Once ready, each later update must link by the Binance `pu` previous-final-update identifier. A continuity break clears the unsafe book and starts recovery. Snapshot bridge retries are bounded with jitter after transient REST restrictions; no DOM depth is emitted until the bridge becomes valid.

Derived calculations are client-side and deterministic. CVD is cumulative observed aggressive buy quantity less observed aggressive sell quantity; footprint bins observed trade volume by time and tick-rounded price; imbalance is `(Σ bid depth − Σ ask depth) / (Σ bid depth + Σ ask depth)` over the selected nearest-level window; and microprice is `ask × bid size/(bid + ask) + bid × ask size/(bid + ask)`. Research Mode calls its sweep and absorption outputs **candidates** and exposes source sequences, rolling window, thresholds, observed metrics, and the calculation version.

## Explicit P0 deferrals

PostgreSQL/object storage retention, OKX, Coinbase, Deribit, GEX, authenticated exchange functions, and live trade execution remain out of scope. Gate.io remains selectable as the regression provider by setting `MARKET_PROVIDER=gateio`.
