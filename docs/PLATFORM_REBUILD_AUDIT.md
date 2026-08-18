# Platform Rebuild Audit

**Audit date:** 2026-08-19 (GMT+4)  
**Audited revision:** `product/orderflow-research-terminal` at `4275a77`; production application at [zterminal.onrender.com](https://zterminal.onrender.com)

## Baseline Health

The local repository is clean. TypeScript validation, the full Vitest suite, and the production build all passed: **22 test files and 74 tests**. The deployed revision provides a chart-first public research workstation with live Gate.io market data when the source is current, intentional degraded states for other tapes, and a strict no-execution boundary.

| Audit area | Current condition | Decision implication |
|---|---|---|
| Frontend route structure | `/` renders the entire terminal directly. `App.tsx` has no public landing or protected terminal route. | Add a public landing route and move the terminal to a deliberate product route such as `/terminal`. |
| Authentication | The stack already has Manus OAuth, `auth.me`, session logout, protected tRPC procedures, and a `users` schema. | Individual identity is technically supported, but must not be advertised as durable accounts until production configuration is complete. |
| Durable account data | The existing `users`, `workspaces`, and `researchDrafts` tables support ownership, but Render’s Environment panel contains no variables or linked environment group. | `DATABASE_URL`, `OAUTH_SERVER_URL`, and session-secret configuration are currently blocking production account persistence. No credentials will be invented or added without user-provided values. |
| UI composition | The workstation is feature-rich but `Home.tsx` combines the app shell, market header, drawers, order-flow panels, research state, local workspace, and keyboard behavior in one large page component. | Split into page-level routes and focused composition components; reduce duplicate controls and move optional evidence into progressive disclosure. |
| Indicators | Existing chart studies are predefined, direct TypeScript calculations inside `ProfessionalChart`. | A user-defined indicator facility requires a closed formula language/runtime and typed output contract; it cannot safely execute arbitrary JavaScript. |
| Data credibility | Current live order flow is scoped to selected public venue tapes and reconciled Gate.io depth. | Preserve venue labels, live-only gates, and no-consolidation/no-prediction wording. |

## Free Public Order-Flow Source Research

The following public-exchange candidates have authoritative documentation and can potentially extend research coverage without a provider credential. They are candidate **venue-specific** sources, not permission to claim a consolidated market-wide tape.

| Candidate | Public capability documented | Engineering constraints | Candidate decision |
|---|---|---|---|
| Coinbase Exchange | Its market-data WebSocket is available without authentication and documents real-time trade/order updates. Its Level 2 channel is recommended for keeping a book in sync; the feed warns that sequence gaps and out-of-order messages must be handled. [1] | USD-quoted products; snapshot/update reconciliation and gap recovery are mandatory. | Strong candidate for a future spot-specific trade + L2 adapter. |
| Kraken Spot | Its WebSocket v2 `book` channel provides aggregated L2 price levels, snapshot/update semantics, selectable depth, timestamps, and a top-of-book checksum. [2] | Spot symbols and units differ from current perpetual contracts; checksum and sequential-update handling are mandatory. | Strong candidate for a future spot-specific depth adapter. |
| OKX | Its documentation describes public WebSocket channels without authentication, recommends WebSockets for market data/order-book depth, and lists a public endpoint. [3] | Region-specific API domains and rate/connection limits require deployment-location validation; public trade and books channel semantics must be separately confirmed before implementation. | Research candidate, not yet admitted to the provider catalog. |

> **Source rule:** Any added source will remain independently selectable and labelled by venue, instrument, market type, units, and live status. It will be withheld on a stale, degraded, unavailable, checksum-invalid, or unreconciled state.

## Initial Product Direction

The next implementation plan should place a focused public landing page at `/`, reserve `/terminal` for the research workstation, and offer a visible account entry point. In the absence of production database/OAuth configuration, authentication UI must distinguish sign-in availability from durable-account availability rather than promising cloud persistence. The first custom-indicator iteration should be a safe, candle-only formula builder with clear input/period/output controls, no network/I/O, no account access, no strategy execution, no alerts, and no broker route.

## References

[1]: https://docs.cdp.coinbase.com/exchange/websocket-feed/overview "Coinbase Exchange WebSocket Overview"
[2]: https://docs.kraken.com/exchange/api-reference/spot-websocket-v2/book "Kraken WebSocket v2 Book"
[3]: https://www.okx.com/docs-v5/en/ "OKX API Documentation"

## Custom Indicator Product Research

TradingView’s documented authoring model demonstrates two useful product ideas: named, bounded user inputs that trigger a recomputation across loaded chart data, and explicit visual output choices. [4] [5] Its scripts can also have multiple plots and calculations; ZTerminal will **not** replicate the Pine runtime, external data requests, alerts, strategies, libraries, or arbitrary code execution.

| First safe ZTerminal capability | Deliberately excluded from the first release |
|---|---|
| User-owned indicator name, one or more bounded numeric inputs, explicit candle source, expression tree, line/histogram visual, color, and visibility. | JavaScript, Pine Script compatibility, user functions, loops, network requests, cross-symbol/timeframe reads, alerts, optimization, strategies, order creation, broker routes, or live order-flow history. |
| Candle-only built-ins: `close`, `open`, `high`, `low`, `volume`, `hl2`, SMA, EMA, RSI, arithmetic, comparisons, and conditional outputs. | External sources, private data, credentials, depth/tape inputs outside their current bounded live window, and any look-ahead input. |
| Deterministic parse/validate/evaluate process with a compact AST and explicit diagnostics. | `eval`, `Function`, Web Workers running arbitrary source, or server-side execution of user text. |
| Local-only draft saving until database/OAuth configuration is complete; later, user-owned persistence through the existing protected workspace boundary. | Durable or shared indicator claims without production account storage. |

[4]: https://www.tradingview.com/pine-script-docs/concepts/inputs/ "TradingView Pine Script Inputs"
[5]: https://www.tradingview.com/pine-script-docs/visuals/plots/ "TradingView Pine Script Plots"
[6]: https://www.tradingview.com/pine-script-docs/primer/first-indicator/ "TradingView Pine Script First Indicator"

## Production Procedure Smoke Test

Direct public calls to the deployed tRPC procedures returned successful responses for the application shell, anonymous `auth.me`, market capability catalog, Gate.io snapshot, and historical-bar contract. The first order-flow read after the service had been idle returned a connecting/degraded tape and synchronizing depth state. A recheck after eight seconds returned **LIVE** selected Gate.io tape; depth correctly remained **SYNCING/DEGRADED** until snapshot-plus-sequenced-delta reconciliation completes. This is a valid fail-closed startup state, but its presentation should be made clearer in the redesigned terminal so users understand it as **warming/reconciling** rather than an unexplained terminal failure.

The anonymous `auth.me` response is `null`, which is correct for a public landing route. Protected account routes must handle this state as an invitation to authenticate, not a query error or automatic redirect from the public home page.

## Local Entry-Flow Verification

The new public `/` route was browser-checked at desktop width. It presents a focused hero, a compact product preview, explicit research/data boundaries, and clear terminal/sign-in calls to action without rendering the dense workstation on first load. The guest `/account` route was also checked: it displays a dedicated sign-in explanation and guest terminal continuation rather than treating anonymous access as a runtime error. These pages retain the established dark teal/violet visual identity while materially reducing initial interaction density.

## Local Indicator Lab Verification

The terminal’s new Indicator Lab was browser-checked after verified Gate.io candles loaded. The default bounded EMA-spread formula compiled as a **local closed candle runtime** and reported 97 loaded verified bars. Selecting **Add to chart** closed the drawer, displayed an explicit local-only confirmation, and rendered the validated custom series without changing market-data provenance, order-flow gates, or execution boundaries. The page simultaneously showed Gate.io tape returning to `LIVE` after its short warm-up and retained degraded labels for Binance/Bybit.

## Coinbase Exchange Adapter Research Record

Coinbase Exchange documents a public market-data WebSocket at `wss://ws-feed.exchange.coinbase.com`. Its `matches` channel is appropriate for a bounded public trade tape but may drop messages; the documentation directs clients to use heartbeat trade IDs to detect missed trades. Coinbase’s documented `match.side` is the **maker** side, so the adapter deliberately records the opposite direction as a derived taker-side value and labels the venue as `Coinbase Exchange USD Spot`. [7] The provider’s ordinary Level 2 channel requires authentication, while its `level2_batch` channel is documented as unauthenticated; this release does **not** render Coinbase depth because it has not yet added the required snapshot, synchronization, checksum/gap, and browser validation contract. [7] [8]

[7]: https://docs.cdp.coinbase.com/exchange/websocket-feed/channels "Coinbase Exchange WebSocket Channels"
[8]: https://docs.cdp.coinbase.com/exchange/websocket-feed/authentication "Coinbase Exchange WebSocket Authentication"
[9]: https://docs.cdp.coinbase.com/exchange/websocket-feed/rate-limits "Coinbase Exchange WebSocket Rate Limits"

## Coinbase Selector Browser Check

The public-feed strip now displays Coinbase Exchange USD Spot as a distinct selectable tape venue alongside the existing Gate.io, Binance USDⓈ-M, and Bybit feeds. While the current chart was `QQQX_USDT`, Coinbase correctly reported a degraded/non-current state rather than displaying substituted tape. Selecting `BTC_USDT` preserved the prior verified chart until the new canonical Gate.io window was available, confirming that the new selected-tape feature did not relax the existing last-verified-chart boundary.

### Live Coinbase BTC/USD Verification

With the canonical `BTC_USDT` market selected, the local feed-health strip reached `LIVE` for **Coinbase Exchange USD Spot**. Selecting that source surfaced a clear notice that Coinbase public tape was selected while the verified chart history and DOM remained Gate.io-only. The selected-venue large-print panel identified Coinbase and disclosed its derived taker-side convention. During this check, the Flow Pulse panel was found to retain Gate.io depth after an external tape selection; it was corrected to label the state **DEPTH ONLY** and explicitly explain that selected external tape is excluded rather than combined with Gate.io perpetual depth. The updated behaviour was included in subsequent static, targeted, full-regression, and production-build validation.
