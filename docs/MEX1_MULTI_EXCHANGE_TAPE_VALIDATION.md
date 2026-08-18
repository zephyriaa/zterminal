# MEX1 — Multi-Exchange Public Trade-Tape Validation

**Status:** Complete as an evidence-backed foundation. **Scope:** bounded, read-only public trade tapes and visible feed health. **Branch:** `product/orderflow-research-terminal`.

## Product Boundary

MEX1 adds a common live public-tape contract for Gate.io USDT perpetuals, Binance USDⓈ-M perpetuals, and Bybit linear perpetuals. It does **not** claim multi-venue chart history, consolidated pricing, cross-venue depth, historical tick replay, execution, broker connectivity, or private-account data.

| Venue | Public transport | Normalized taker-side rule | MEX1 observed status | Released claim |
|---|---|---|---|---|
| Gate.io | Existing verified public WebSocket tape | Signed exchange `size` | `LIVE` for BTC/USDT and QQQX/USDT | Bounded tape; CVD; Time & Sales; exact-price live footprint |
| Binance USDⓈ-M | Public aggregate-trade WebSocket adapter | `m=true` means buyer was maker, therefore taker sold | `DEGRADED` in the release environment | Adapter and deterministic semantic fixtures only; live transport remains verification-pending |
| Bybit Linear | V5 `publicTrade.{symbol}` WebSocket | Exchange-reported `S` field (`Buy`/`Sell`) | `LIVE` for BTC/USDT | Bounded public tape with stale/reconnect/idle-expiry safeguards |

> **Fail-closed rule:** A venue that is stale, reconnecting, degraded, or unavailable is visibly labeled and its tape is not rendered as live order flow.

## Validation Evidence

The bounded read-only probe captured a current Bybit BTCUSDT public trade in `docs/evidence/multi-exchange-trade-spike.json`, including Bybit’s reported taker side. The same probe did not receive a Binance WebSocket event within the bounded capture window. A direct public REST reachability test to `https://fapi.binance.com/fapi/v1/ping` returned HTTP 200, so the observed limitation is recorded as a WebSocket transport/verification gap rather than a general Binance-network failure.

The local browser verification at `http://localhost:3003` rendered the supplied ZTerminal mark and the three-venue health strip. For BTC/USDT, the strip showed Gate.io and Bybit as `LIVE` and Binance as `DEGRADED`; it did not treat the degraded venue as live. The complete observation is retained in `docs/evidence/multi-exchange-ui-observation.md`.

## Quality Gates

| Gate | Result |
|---|---|
| `pnpm check` | Passed |
| Multi-exchange trade-normalization fixtures | Passed |
| Bounded multi-exchange stream lifecycle fixtures | Passed |
| Shared order-flow and provider-contract regression fixtures | Passed |
| Local rendered health-strip verification | Passed with Binance explicitly degraded |

## References

[1]: https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/ws-streams/public "Binance USDⓈ-M Futures public WebSocket streams"
[2]: https://bybit-exchange.github.io/docs/v5/websocket/public/trade "Bybit V5 public trade stream"
[3]: https://bybit-exchange.github.io/docs/v5/websocket/public/orderbook "Bybit V5 public order-book stream"
