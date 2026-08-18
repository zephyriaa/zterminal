# Recovery Validation Log

## 2026-08-18 — Local Canvas verification

The local recovery server was exposed through a temporary browser address. The recovered Canvas rendered the new Gate.io perpetual-symbol input, `1D` through `MAX` range controls, and the requested/verified coverage indicator. A live Gate.io `QQQX_USDT` snapshot completed successfully and displayed a price and 24-hour statistics.

The initial batched request also included `market.bars` with the exact range-contract parameters: `interval=15m`, `symbol=QQQX_USDT`, `from=1786924800000`, `to=1787011200000`, and `limit=97`. At the time of capture, the historical portion had not rendered, while the snapshot response was live. Subsequent validation must inspect the batch response and correct any request/coverage incompatibility before treating the chart slice as complete.


### Range-provider compatibility correction

Direct provider diagnosis established that Gate.io accepts `from`/`to` range bounds and accepts a latest-window `limit`, but rejects a query combining `from`, `to`, and `limit` with HTTP 400. The adapter now uses only `from`/`to` for bounded requests and retains `limit` only for legacy latest-window requests.

After the hot reload, the local Canvas successfully displayed a verified one-day QQQX/USDT data window from `2026-08-17 00:00:00 UTC` through `2026-08-18 00:00:00 UTC` with **97 bars**. The chart rendered data-backed VWAP, EMA 20/50, profile, and loaded range values. The browser-visible provenance indicator reported the exact effective coverage, and the public snapshot remained live.

This validates the P0/P1 range integrity slice for the default one-day, 15-minute path. Longer-window paging and degradation behavior remain separate follow-up checks.
