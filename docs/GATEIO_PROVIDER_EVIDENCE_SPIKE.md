# Gate.io Provider Evidence Spike

**Purpose:** Establish the verified facts required before implementing or enabling ZTerminal real-time order-flow surfaces.

**Status:** In progress. The evidence below supports a provider-contract design only. It does **not** yet authorize a `LIVE` CVD, DOM, footprint, or Time & Sales feature claim.

## Verified from the official Gate Futures WebSocket documentation

| Provider capability | Verified fact | ZTerminal implication |
|---|---|---|
| USDT futures endpoint | Gate documents `wss://fx-ws.gateio.ws/v4/ws/usdt` as the real-trading USDT futures WebSocket URL. | A public read-only adapter can target this endpoint without a user API key for public market channels. |
| Protocol health | Gate uses WebSocket protocol ping/pong and documents an application-level `futures.ping` / `futures.pong` path. | The adapter must maintain protocol liveness and expose a stale/disconnected state after bounded heartbeat failure. |
| Public trades | `futures.trades` is documented as a public-trades channel with a contract-list subscription payload. Trade notifications include `size`, `id`, `create_time`, `create_time_ms`, `price`, `contract`, and `is_internal`; Gate explicitly states that positive size means the taker is a buyer and negative size means the taker is a seller. | A trade-tape contract can normalize exchange time, trade ID, price, signed size, contract, and internal flag. CVD may be implemented as exchange-reported taker-signed size after real-event and reconnect fixtures pass. |
| Decimal precision | Gate documents `X-Gate-Size-Decimal: 1`; without it, fractional sizes can be truncated toward zero. | Any WebSocket adapter must set this header and parse sizes as decimal strings, never assume integer quantities. |
| Best bid/offer | `futures.book_ticker` is documented as a real-time BBO channel. | A BBO surface can be added independently from full depth when verified and tested. |
| Incremental depth | Gate documents `futures.order_book_update` as the recommended more-timely, lower-traffic alternative to legacy order-book updates. A documented subscription example is `[contract, "100ms", "100"]`. | DOM must be based on the recommended update channel, not an unsequenced rendering shortcut. |
| Depth recovery | Gate documents the snapshot-and-delta recovery procedure: cache updates; retrieve a REST `order_book` snapshot with `with_id=true`; find a cached message satisfying `U <= baseId + 1` and `u >= baseId + 1`; then apply absolute level sizes. | The adapter must buffer before snapshot, reconcile update IDs, replace absolute level quantities, detect gaps, and mark depth stale/unavailable rather than synthesize data. |
| Sequence fields | Incremental updates include `U` and `u`, alongside bid/ask updates and level count. | Sequence continuity is a hard contract invariant and a mandatory fixture test. |

## Resolved CVD Evidence and Remaining Transport Gates

Gate’s public `futures.trades` documentation explicitly states: **“Positive size means taker is buyer, negative seller.”** This resolves the basic direction contract for a CVD computation: aggregate the signed public trade size in chronological exchange-time order and label the result as **exchange-reported taker-signed flow**.[1]

CVD is now eligible for a controlled implementation slice, but it must remain `UNAVAILABLE` until implementation fixtures prove ordering, deduplication, reconnect behavior, and display-state handling. The following transport questions remain open:

- Whether `is_internal` must be included, excluded, or separately labeled in the aggregation methodology.
- How trade IDs behave across reconnects and symbol subscriptions.
- Current public rate, connection, subscription, and replay limitations relevant to a production fan-out service.
- Whether the current Render tier can sustain the intended public connection lifecycle.

## Required Next Tests

1. Capture sanitized public `futures.trades` messages and test signed-size aggregation, chronological ordering, deduplication, and `is_internal` treatment against the published taker-side definition.
2. Capture a `futures.order_book_update` buffer plus a REST `with_id=true` snapshot, then test successful reconciliation and an intentional sequence-gap failure.
3. Confirm reconnect, ping timeout, subscription acknowledgement, and stale timeout behavior under controlled fixtures.
4. Confirm the deployed hosting environment can sustain the intended public connection lifecycle; do not change hosting tier without a measured requirement and user approval.

## References

[1] [Gate Futures WebSocket v4.0.0](https://www.gate.com/docs/developers/futures/ws/en/)

[2] [Gate API v4](https://www.gate.com/docs/developers/apiv4/en/)

## Captured Public Transport Evidence

A bounded, read-only transport probe against `BTC_USDT` completed on 2026-08-18. It subscribed successfully to `futures.trades` using the documented decimal-size header and captured both a positive (`"30"`) and a negative (`"-2"`) string-valued size, with exchange millisecond timestamps and sequential trade IDs. This is consistent with Gate’s documented positive-taker-buyer / negative-taker-seller definition; the raw sanitized capture is retained at [`evidence/gateio-trade-spike.json`](./evidence/gateio-trade-spike.json).

A separate bounded depth probe subscribed to `futures.order_book_update` at `100ms` / 100 levels while fetching a REST `with_id=true` snapshot. The capture returned a snapshot identity of `121779446002`, 100 bids, 100 asks, string-valued depth quantities, a cached update satisfying the documented recovery condition at index 21, and contiguous subsequent update ranges. The sanitized evidence is retained at [`evidence/gateio-depth-spike.json`](./evidence/gateio-depth-spike.json).

> These captures prove that the documented public event shapes and reconciliation procedure are observable from the current environment. They do **not** yet prove that a long-running production stream meets uptime, reconnect, load, or multi-subscriber requirements. CVD and DOM remain unavailable until the canonical adapter implements the corresponding lifecycle and fixture tests.
