# P0 Render Deployment Log

## Service

The connected Render service is `zterminal` (`srv-d9uogdajobas73bbnn1g`) in the Frankfurt region. It is a Docker web service connected to `zephyriaa/zterminal` on the `main` branch and is publicly available at `https://zterminal.onrender.com`.

## Production configuration applied

On 2026-08-22, the following non-secret environment values were applied through the Render dashboard and Render triggered a rebuild:

| Variable | Applied value | Purpose |
|---|---|---|
| `MARKET_PROVIDER` | `binance` | Activates the P0 Binance USDⓈ-M Futures provider. |
| `ALLOWED_ORIGIN` | `https://zterminal.onrender.com` | Allows the public same-origin Socket.IO client through the gateway CORS policy. |

## Deployments

The service successfully deployed commit `38f8e01` after the environment update. A subsequent corrective commit, `fd7984f03da906e3f536c4de010069780bf5bafc` (`fix: default P0 workspace to Binance BTCUSDT`), was manually deployed at 04:48 UTC.

The Render build for `fd7984f` completed its Next.js production compilation and TypeScript verification successfully, then assembled the Docker runtime image. At the latest dashboard observation it had pushed the image layers and was exporting its registry cache; the service replacement was still in progress.

## Runtime observation

The public root had already switched from the prior unrelated legacy application to this repository's Next.js terminal. The deployed gateway reports the `binance` provider. Its `/readyz` response has shown a ready contract state after automatic retries; a prior `exchangeInfo` request from the Render environment briefly received HTTP 418. The provider's automatic gateway boot retry is the relevant recovery behavior, and no fabricated market or open-interest values are introduced.

## Public production probe

A 45-second Socket.IO probe was run against `https://zterminal.onrender.com` after the `fd7984f` rollout. It successfully subscribed to `BTCUSDT` and received 718 raw trades, 10,107 book-ticker quotes, and three derivatives updates. The source reported official Binance depth-diff messages, but each required REST snapshot request was rejected from the Render environment with HTTP 418. Therefore no local L2 book was marked ready and no depth event was emitted. This is correct fail-closed behavior: the gateway does not fabricate, interpolate, or present an unsynchronized DOM/footprint book.

| Surface | Production result | Interpretation |
|---|---|---|
| Public Next.js P0 bundle | Live at `/` | The root response contains the BTCUSDT P0 workspace bundle. |
| Binance WebSocket trade tape | Live | Official trades reached the public Socket.IO subscriber. |
| Binance book ticker | Live | Best-bid/best-ask quote events reached the public Socket.IO subscriber. |
| Mark/index/funding context | Live | Derivatives updates reached the public Socket.IO subscriber. |
| OI endpoint | Unavailable when Binance restricts it | Explicit unavailable handling remains active. |
| Sequence-safe REST-snapshot L2 | Degraded in this Render region | Binance returned HTTP 418 to `/fapi/v1/depth`; the book correctly remained unsynchronized. |

The publicly served `/terminal` browser view observed during validation was a local browser cache of the pre-existing legacy surface. A direct no-cache origin request returned Next.js 404 for that absent route, while the authoritative P0 application is served from `/`. A browser with the old cached service worker should be hard-refreshed or its site data cleared before it can see the deployed root application.

## Release state

The application deployment completed and the new public root bundle contains `BTCUSDT`; the latest code commit is `fd7984f03da906e3f536c4de010069780bf5bafc`.

The remaining production blocker for a fully live P0 DOM and footprint is **regional outbound REST access to Binance Futures**. The approved sequence-safe L2 design cannot safely substitute a stale or WebSocket-only pseudo-snapshot. A gateway in a Binance-permitted region, or an approved market-data transport capable of providing the official Binance depth snapshot, is required before the P0 depth-dependent tools can move from transparent degraded mode to live mode.
