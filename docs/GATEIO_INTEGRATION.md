# Gate.io Read-Only Market Data Integration

## Scope

ZTerminal’s first live-data provider is **Gate.io USDT perpetual futures**. The
integration is read-only: it obtains public contract metadata, historical
OHLCV candles, public trades, best bid/offer, and order-book depth for
`QQQX_USDT`. It does not require a Gate.io account, API key, trading
permission, account access, order placement, or funds movement.

The TradingView-style symbol `GATEIO:QQQXUSDT.P` and the shorthand
`QQQXUSDT.P` are normalized to the native Gate.io contract `QQQX_USDT`.

## Architecture

| Component | Responsibility |
|---|---|
| `src/lib/market/gateio.ts` | Symbol aliases, input validation, decimal parsing, runtime contract metadata mapping, candles normalization |
| `/api/bars` | Bounded, validated historical OHLCV retrieval; Gate.io by default and explicit mock fallback only |
| `/api/contracts` | Public provider contract discovery and normalized metadata |
| `/api/markets` | Read-only `QQQX_USDT` ticker snapshot for the market view |
| `mini-services/market-data/gateio-provider.ts` | Persistent public WebSocket ingestion, reconnects, status, subscriptions, and event normalization |
| `mini-services/market-data/order-book.ts` | REST snapshot plus WebSocket-delta sequencing, stale detection, and local book recovery |
| `src/hooks/use-market-stream.ts` | Browser subscription, status fan-out, reconnection handling, and bounded trade buffers |

## Gate.io Endpoints

The integration uses the official public endpoints below.

| Purpose | Endpoint |
|---|---|
| Contract catalogue | `GET https://api.gateio.ws/api/v4/futures/usdt/contracts` |
| Historical candles | `GET https://api.gateio.ws/api/v4/futures/usdt/candlesticks` |
| Order-book snapshot | `GET https://api.gateio.ws/api/v4/futures/usdt/order_book?contract=QQQX_USDT&limit=100&with_id=true` |
| Ticker snapshot | `GET https://api.gateio.ws/api/v4/futures/usdt/tickers?contract=QQQX_USDT` |
| Real-time stream | `wss://fx-ws.gateio.ws/v4/ws/usdt` |

The WebSocket client passes `X-Gate-Size-Decimal: 1` so fractional quantities
are transmitted as decimal strings and cannot be silently truncated. All
provider values are validated before normalizing to terminal events.

## Data Integrity Rules

The terminal may show **LIVE** only after the upstream provider has connected
and recently supplied data. A connected browser socket alone is not sufficient.

For the local order book, the service buffers `futures.order_book_update`
events, fetches a REST snapshot with `with_id=true`, applies a delta only when
its `U` / `u` range bridges the snapshot sequence, and deletes a price level
when Gate reports a zero size. A missing sequence, malformed update, or failed
snapshot marks the book **STALE**, stops it from being presented as live, and
rebuilds it from a new snapshot.

Gate documents positive public trade size as buyer-initiated and negative size
as seller-initiated. The service uses that documented sign to calculate its
read-only order-flow side. Internal/liquidation-related trades retain an
`internal` condition for future UI filtering.

## Service Configuration

| Variable | Default | Purpose |
|---|---|---|
| `MARKET_PROVIDER` | `gateio` | Set to `mock` only for explicit simulated offline development |
| `MARKET_DATA_PORT` | `3003` | Internal Socket.IO/health service port |
| `ALLOWED_ORIGIN` | Allow all in local development | Comma-separated production browser origins; set this before public deployment |

The service exposes:

- `GET /healthz` — process health.
- `GET /readyz` — provider readiness; returns a non-success result while the
  provider is disconnected, unavailable, stale, or has no discovered contract
  metadata.

## Run Locally

1. Start the market-data service: `npm run market-data`.
2. Start the Next.js application: `npm run dev`.
3. Open ZTerminal and select `QQQX_USDT` or type `QQQXUSDT.P` in the command
   palette.
4. Confirm the connection displays `GATEIO · LIVE` only after fresh market data
   appears. If data is unavailable, the UI must say `STALE`, `DEGRADED`, or
   `UNAVAILABLE`, never `SIMULATED`.

## Operational Limits

This is an exchange-data display integration, not an execution system. Market
data can be delayed, unavailable by jurisdiction, interrupted by exchange
maintenance, rate-limited, or changed by the provider. The service has
reconnect/backoff and stale detection but does not guarantee uninterrupted
delivery or trading suitability.

## Sources

1. [Gate Futures WebSocket API v4](https://www.gate.com/docs/developers/futures/ws/en/)
2. [Gate API v4](https://www.gate.com/docs/developers/apiv4/en/)
