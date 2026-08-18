# Recovery Validation Log

## 2026-08-18 — Local Canvas verification

The local recovery server was exposed through a temporary browser address. The recovered Canvas rendered the new Gate.io perpetual-symbol input, `1D` through `MAX` range controls, and the requested/verified coverage indicator. A live Gate.io `QQQX_USDT` snapshot completed successfully and displayed a price and 24-hour statistics.

The initial batched request also included `market.bars` with the exact range-contract parameters: `interval=15m`, `symbol=QQQX_USDT`, `from=1786924800000`, `to=1787011200000`, and `limit=97`. At the time of capture, the historical portion had not rendered, while the snapshot response was live. Subsequent validation must inspect the batch response and correct any request/coverage incompatibility before treating the chart slice as complete.


### Range-provider compatibility correction

Direct provider diagnosis established that Gate.io accepts `from`/`to` range bounds and accepts a latest-window `limit`, but rejects a query combining `from`, `to`, and `limit` with HTTP 400. The adapter now uses only `from`/`to` for bounded requests and retains `limit` only for legacy latest-window requests.

After the hot reload, the local Canvas successfully displayed a verified one-day QQQX/USDT data window from `2026-08-17 00:00:00 UTC` through `2026-08-18 00:00:00 UTC` with **97 bars**. The chart rendered data-backed VWAP, EMA 20/50, profile, and loaded range values. The browser-visible provenance indicator reported the exact effective coverage, and the public snapshot remained live.

This validates the P0/P1 range integrity slice for the default one-day, 15-minute path. Longer-window paging and degradation behavior remain separate follow-up checks.


## 2026-08-18 — Workspace-aware Research canvas preflight

After adding workspace schema, protected research procedures, and local-draft migration code, the local Canvas again loaded a live QQQX/USDT snapshot and a verified one-day 15-minute window. The browser displayed 97 effective bars and an exact UTC coverage interval before Research mode was opened. This confirms that the persistence additions did not regress the verified chart range path.


### Local research-draft preservation

In local browser verification, Research mode displayed the exact Gate.io symbol, interval, effective UTC coverage, and returned bar count next to the hypothesis and validation condition. With no authenticated workspace session, selecting **Save local research draft** persisted the artifact through the explicit browser-local path and displayed: “Local-only draft · sign in to migrate.” The notice made clear that the record was not synchronized or durable across browsers until authenticated migration succeeds.


### Protected workspace boundary and safe errors

An unauthenticated browser request to `research.listDrafts` returned HTTP 401 and the established `UNAUTHORIZED` code. Initial local inspection revealed that the default TRPC response exposed a server stack trace and local file paths. The shared TRPC error formatter was hardened to remove the stack from every browser response. Re-testing preserved the HTTP 401 and typed error while returning no stack or local path.


## 2026-08-18 — Shared feature-registry validation

The local Canvas continued to show the verified one-day Gate.io coverage after chart calculations were moved to the shared registry. The VWAP layer inspector displayed the feature identity `vwap · v1.0.0` and a deterministic dataset fingerprint (`fnv1a-24267964` for the observed window), alongside the provider source and 97 loaded bars. This makes the visual study’s version and exact normalized input identity available to the adjacent research workflow rather than leaving calculations solely inside the presentation component.


The volume-profile inspector was also verified locally. It disclosed that the feature is a candle-volume distribution rather than tick-level volume-at-price, then showed `volumeProfile · v1.0.0`, the same dataset fingerprint, a derived POC of `732.7631`, and a 70% value area of `732.6225 — 735.9975` for the loaded window. This establishes visible provenance for the shared calculation without misrepresenting it as order-flow data.


## 2026-08-18 — Reproducible evaluation preflight

Before opening the evaluation panel, the local Canvas loaded a verified QQQX/USDT one-day 15-minute dataset from `2026-08-17 00:30:00 UTC` through `2026-08-18 00:30:00 UTC`, comprising 97 bars and fingerprint `fnv1a-4e1a0fe8`. This exact normalized dataset is the sole input available to the browser-side research evaluation; no synthetic data, broker route, or forecast is introduced.


### Browser-visible next-bar evaluation

In Research mode, the recovered panel evaluated the same 97 verified bars with the labelled `EMA 20/50 + VWAP long-only` template. The UI disclosed that signals occur at bar close and fills occur at next bar open, showed the $100,000 fixed-capital and zero-cost defaults, and produced run `bt_a-8f8c43e4` with an input/result hash `fnv1a-8f8c43e4`. The panel reported one trade, net P&L `+0.12`, return `+0.00%`, and maximum drawdown `-0.73`, then visibly stated that the output is not investment advice and makes no broker-route, forecast, optimization, or intrabar-fill claim.


## 2026-08-18 — Post-security-update smoke test

After restarting the local service from the updated locked dependency tree, the public Gate.io snapshot and verified one-day, 15-minute historical window loaded successfully. The Canvas showed 97 effective bars, exact UTC coverage, `vwap · v1.0.0`, and fingerprint `fnv1a-49d35ff2`. This confirms the security dependency updates did not regress the core recovered market-data and feature-provenance path.


The post-upgrade unauthenticated `research.listDrafts` check returned HTTP 401 and the typed `UNAUTHORIZED` code. The response retained no local source path or server stack trace, confirming that the shared error formatter remained effective after the tRPC update.
