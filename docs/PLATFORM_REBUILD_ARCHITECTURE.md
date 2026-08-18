# Platform Rebuild Architecture

**Status:** Approved implementation plan derived from the platform audit  
**Scope:** Public landing, account-aware terminal entry, interface simplification, safe custom indicators, and source-faithful order-flow expansion.

## Product Routing

The public product should have a clear conversion and access path rather than placing an unauthenticated visitor directly into a dense workstation.

| Route | Audience | Purpose | Access rule |
|---|---|---|---|
| `/` | Everyone | Premium landing page explaining verified research, public feeds, order-flow boundaries, and the terminal’s no-execution stance. | Public. |
| `/terminal` | Visitors and signed-in users | Full research terminal. Guests may explore current public data; authenticated users receive account-aware workspace controls. | Public market viewing; durable actions visibly require a signed-in, configured account. |
| `/account` | Signed-in users | Account profile, storage state, indicator library, and research-draft list. | Authentication required; present a clear sign-in entry for guests. |

The landing page will use the existing dark teal/violet identity, but will remove dense terminal controls, live ticker clutter, and every optional evidence panel. Its primary calls to action will be **Open terminal** and **Sign in**. The terminal will retain its chart-first layout but move optional panels into intentional drawers and only surface status that affects the current user decision.

## Account Rollout

The current runtime already supports OAuth sessions and a `users` table, as well as user-owned workspaces and research drafts. Production persistence cannot be truthfully enabled until the Render service has a database connection plus the OAuth/session configuration required by the existing runtime.

| Increment | Can be implemented now | Requires production configuration |
|---|---|---|
| Account-aware navigation | Yes. Show the session state, sign-in, sign-out, and a truthful durable-storage status. | No. |
| Public landing and protected account route | Yes. Public content remains available; account actions can call the existing auth flow. | No. |
| Durable research drafts and indicator library | Client contract and protected procedures can be designed and tested with unavailable-storage behavior. | Yes: `DATABASE_URL`, OAuth configuration, and a persistent session secret. |
| Multi-user cloud workspaces | Not claimed until migration and production database verification pass. | Yes. |

> No password system or arbitrary credential storage will be added. The account model remains provider-backed OAuth with per-user ownership enforced by protected server procedures.

## Custom Indicator v1

The first user-created indicator experience will be called **Indicator Lab**. It will resemble the useful workflow of a chart editor—name, inputs, preview, output style, and add-to-chart—without asserting Pine Script compatibility or executing user-provided code.

| Contract | v1 inclusion |
|---|---|
| Data inputs | Loaded verified OHLCV bars only: `open`, `high`, `low`, `close`, `volume`, `hl2`, `hlc3`, `ohlc4`. |
| Operations | Literals, named inputs, arithmetic, comparison, boolean conditionals, SMA, EMA, RSI, and absolute value. |
| Output | One primary series per definition, rendered as an overlay line or a separate-pane histogram. Explicit color, width, visibility, and label. |
| Execution | Deterministic parser → AST validation → pure evaluator. No host access, I/O, network, `eval`, `Function`, dynamic import, user loops, or arbitrary JavaScript. |
| Time integrity | Only current/past loaded bars; no look-ahead, unsupported higher-timeframe query, or historical order-flow data. |
| Persistence | Browser-local drafts by default; per-user cloud saving only after storage configuration is verified. |
| Explicit exclusions | Strategies, backtests, alerts, trading signals, optimization, orders, broker routes, private data, social publishing, and shared code library. |

## Free Public Order-Flow Roadmap

The current selected-venue Gate.io tape and reconciled Gate.io depth remain the primary production source. Candidate expansion is sequential, not concurrent.

| Priority | Candidate | Proposed scope | Admission gate |
|---|---|---|---|
| 1 | Coinbase Exchange | Public spot trade tape and Level 2 book for separately labelled `BTC-USD`/supported spot products. | Live message capture, sequence/gap handling, snapshot reconciliation, bounded-memory lifecycle tests, browser validation. [1] |
| 2 | Kraken Spot | Public L2 book for independently labelled spot symbols. | Snapshot/update checksum verification, sequential processing, symbol/unit contract, bounded-memory lifecycle tests. [2] |
| 3 | OKX public market data | Research spike only. | Region/domain compatibility, exact trade/book channel semantics, deployment connectivity, rate-limit handling, and source terms review. [3] |

None of these sources authorizes a combined liquidity, combined CVD, or historical order-flow claim. Every adapter remains provider and market-type specific, live-only where the underlying source is live-only, and withheld on any invalid synchronization state.

## Implementation Sequence

The immediate platform foundation will add the public landing route, account-aware navigation, a protected account page with truthful persistence messaging, terminal entry routing, and a refactored page shell. It will not wait for database credentials because it has safe public and local-only behavior.

The next slice will add the pure Indicator Lab compiler/evaluator and chart renderer with contract tests before a UI preview. A free-provider expansion will follow only after one candidate is proven in the release environment; Coinbase is the current highest-confidence candidate because its official market-data feed is explicitly unauthenticated and documents Level 2 synchronization semantics. [1]

## References

[1]: https://docs.cdp.coinbase.com/exchange/websocket-feed/overview "Coinbase Exchange WebSocket Overview"
[2]: https://docs.kraken.com/exchange/api-reference/spot-websocket-v2/book "Kraken WebSocket v2 Book"
[3]: https://www.okx.com/docs-v5/en/ "OKX API Documentation"
