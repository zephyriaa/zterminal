# P0 Market-Data Architecture Audit

## Current implementation

ZTerminal is a Next.js application with a separate Node.js and Socket.IO gateway at `mini-services/market-data`. The Render container starts the Next.js application on port 3000, the market-data gateway on port 3003, and proxies both through Caddy. The current gateway is demand-driven: it discovers contracts, starts a provider subscription when the first browser client requests a symbol, and stops it when the last browser client disconnects.

The active production provider is Gate.io USDT perpetual futures. Its adapter already proves several P0 patterns: official REST contract discovery, public WebSocket subscriptions, local-book snapshot/delta reconciliation, gap-triggered rebuild, bounded reconnects, stale detection, normalized trade/quote/depth events, and explicit state emissions. The current local book uses `Map<number, number>` and sorts on read; this is adequate for the narrow P0 BTCUSDT proof of concept, while update frequency and depth will be profiled before increasing retention or active instrument count.

The browser data path is `use-market-stream.ts` → Socket.IO → normalized `trade`, `quote`, `depth`, and `state` events. It batches trades per animation frame and keeps a bounded client-side tape. Chart code and the current lower workspace must therefore consume extensions of this contract rather than raw exchange payloads.

## P0 migration seam

The immediate change is to generalize the gateway’s provider selection and event envelope so that Gate.io and Binance coexist behind the same public Socket.IO contract. Binance-specific REST/WebSocket parsing remains isolated in a `BinanceFuturesProvider`; chart and hook consumers will receive canonical provider/market/analytics payloads.

P0 stays subscription-scoped to Binance USDⓈ-M `BTCUSDT`. The existing Gate.io path remains available and is a regression baseline. Full database/object-store capture, additional exchanges, Deribit, GEX, and broad replay infrastructure remain deferred.

## Binance USDⓈ-M P0 contract

The P0 provider uses official Binance USDⓈ-M Futures public endpoints and tracks both exchange and receipt timestamps. The adapter requires documented diff-depth events with `U`, `u`, and `pu`, reconciled against the REST order-book snapshot; any broken continuity moves the book out of `LIVE` and forces resynchronization. It also consumes aggregate trades, individual book ticker/mark price streams as required, funding/open-interest REST data, and official liquidation events where the documented stream supplies them.

The public Binance WebSocket reference documents the USDⓈ-M endpoint, diff-depth update identifiers, and the depth/book-ticker payload schema. The adapter will retain the endpoint and documentation reference in code alongside capability and terms notes. [Binance USDⓈ-M Futures public streams](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/ws-streams/public)

## P0 non-negotiable output

The first visible result must be Binance Futures BTCUSDT real L2 and trades feeding a synchronized local book, Time & Sales, CVD, delta, footprint, DOM, bid/ask imbalance, microprice, funding, OI, OI delta, mark/index, documented liquidation events, feed health, and provenance inside the existing chart/research workspace. It must not become a separate metrics dashboard.

## P0 constraints

No live execution, accounts, secrets in browsers, market-data scraping, fabricated values, or unsupported inference. Absorption, liquidity pull, and later GEX remain separately modelled/labelled research outputs; they are not direct exchange facts. The current plan defers durable high-frequency storage until the P0 data flow, measured resource cost, and replay fixture requirements are proven.
