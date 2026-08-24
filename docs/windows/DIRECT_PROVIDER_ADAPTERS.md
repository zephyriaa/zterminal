# Direct Provider Adapters — Local-First Boundary

**Status:** Initial adapter contract approved for implementation. Public market-data connections are made by the installed terminal directly to a permitted provider; Render is not a relay, cache, WebSocket fan-out layer, or fallback source.

## Initial scope

| Provider | Product | Initial local capability | Explicitly excluded |
|---|---|---|---|
| Binance | Spot public market data | Direct aggregate-trade stream normalization and later locally managed order-book synchronization. | Account streams, API keys, trading, order routing, account balances, or provider fallback. |
| Gate | Spot/Futures public market data | Adapter boundary and protocol research; implementation follows only after a schema-version compatibility test. | Private channels, authentication, trading, and automatic substitution for Binance. |

The Binance spot documentation exposes public aggregate trade, book ticker, depth, and kline streams over its WebSocket endpoints; an aggregate-trade event includes aggregate ID, price, quantity, event/trade time, and the provider’s buyer-is-maker field.[1] The Gate documentation distinguishes publicly subscribable channels from authenticated private channels and publishes separate JSON and SBE market-data contracts.[2]

> A direct provider connection is not evidence that every user is entitled to every provider, instrument, or jurisdiction. The local client must surface `Unavailable`, `Gap`, `Stale`, or `Disconnected` rather than route to Render or silently choose another provider.

## Required implementation rules

The local adapter must be opt-in from the native client, use an allowlisted `wss://` endpoint, use no credentials for public channels, and retain provider/environment/status/sequence provenance in every normalized event. It must close/reconnect explicitly, rotate long-lived connections according to provider requirements, and record a gap on discontinuity instead of manufacturing a continuous chart.

The first adapter tests use saved provider-shaped messages only. A manual Windows live-connection smoke test occurs after compile-time parsing and local storage integration pass; it must not involve account credentials or any execution capability.

## References

[1]: https://developers.binance.com/en/docs/catalog/core-trading-spot-trading/api/ws-streams/ "Binance Spot WebSocket Market Streams"

[2]: https://www.gate.com/docs/developers/apiv4/ws/en/ "Gate Spot WebSocket v4"
