# Additional data feeds for ZTerminal

Research date: 2026-10-30 (Asia/Baku). Deliverable: source inspection and public-documentation research, not a tested integration or vendor agreement.

## Recommendation

Complete the existing crypto provider paths first. For a new asset class, evaluate Databento for exchange-traded futures history, replay and order flow; compare dxFeed for a customer-facing multi-asset service. Keep Rithmic as a separate entitled-account integration, especially for the existing Windows plugin proposal. Add Deribit when crypto options become a product priority. These priorities are engineering judgments, conditional on audience and budget.

Assumption: the immediate scope is read-only data for charts, tape, DOM, footprint and research across web/native clients. Execution is outside this investigation. No vendor contact, purchases, credentials or deployment occurred.

## Current source evidence

The checkout is `codex/auth-drawing-rebuild` with extensive pre-existing staged, unstaged and untracked changes. This report is the only file added by this research. Findings describe the inspected working tree, not deployed behavior.

| Owning source | Observation | Consequence |
| --- | --- | --- |
| `src/lib/market/public-stream.ts` | Browser stream implementations for Gate.io, Binance, Bybit, Coinbase and OKX | Existing code is a starting point; it does not prove end-to-end availability |
| `src/app/api/bars/route.ts` | Accepts those five providers plus mock | History routing already spans more providers than the gateway |
| `mini-services/market-data/index.ts`, `src/app/api/contracts/route.ts` | Gateway adapters/discovery center on Gate.io and Binance; live catalogue verification names these two | Complete catalogue, history, streaming and UI acceptance together for other providers |
| `src/lib/market/capabilities.ts`, `connectors.ts` | Provider catalogues differ from implemented stream paths; Bybit/OKX remain labelled catalogued | Reconcile actual capabilities before expanding advertised support |
| `src/lib/market/types.ts` | Deribit, MEXC and Databento identifiers exist | An identifier does not establish an adapter |
| `src/app/api/connectors/rithmic/route.ts` | Valid requests return unavailable/503 pending official kit and conformance | Current connection form cannot establish a Rithmic session |
| `src/lib/market/contracts-v2.ts` | Lossless string values, nanosecond timestamps, unknown trade side, quality epochs and recording/history capabilities already exist | Reuse this boundary where suitable rather than introducing another generic feed abstraction |

## Provider shortlist

| Provider | Documented offering relevant to ZTerminal | Suggested role and unresolved gate |
| --- | --- | --- |
| Databento | Live Raw TCP API and historical HTTP access; official C++, Rust and Python clients; CME `GLBX.MDP3` supports trades, price-level depth and MBO [D1-D4] | First futures research candidate. Use a native/local adapter or persistent gateway for browser delivery. Confirm dataset, commercial rights and total fees before selection |
| dxFeed / dxLink | Token-authenticated WebSockets, web/native SDKs, real-time/history, quotes, Greeks, candles and price-level DOM; B2B2C user-token model [X1] | Compare with Databento for a multi-user product. Trial/production endpoint and exact exchange/history/depth entitlements require agreement. The documented dxLink DOM is MBP; do not assume MBO |
| Rithmic | R\|API+ C++/.NET and separate R\|Protocol route; official development kit, test environment and production conformance [R1] | Entitled-account futures access. Preserve the existing native R\|Trader Pro plugin proposal as a separate route from the web R\|Protocol placeholder; verify SDK/plugin contract before implementation |
| CQG | Protobuf over secure WebSockets, L1/L2 streams, historical ticks and bars, authorization against accessible markets [C1] | Later broker/FCM-driven alternative. Resolve commercial onboarding, account entitlements and historical-depth availability; tick history alone does not prove book replay |
| Deribit | Public book, ticker, trades, funding and options-related channels; incremental books use `change_id` and `prev_change_id`; raw book interval requires authentication [E1] | Next crypto venue if options/volatility analysis matters. Validate instrument units, strike/expiry/settlement and options analytics semantics before claiming GEX support |
| Kraken | Spot WebSocket v2 L2 snapshots/updates and top-ten-level CRC32 validation [K1-K2] | Additional spot venue after current crypto paths work fully. Preserve decimal precision, truncate to subscribed depth and rebuild on checksum failure |
| Massive | Stocks/options and other asset subscriptions; base business live stream uses estimated FMV, while real-time exchange trades/quotes require expansions [M1-M3] | Chart/options analytics candidate, conditional on the exact feed. FMV is unsuitable as a replacement for execution tape or footprint inputs. Redistribution needs commercial rights |
| Alpaca | Stock trade/quote/bar WebSockets with distinct IEX, SIP and delayed SIP feeds; subscription-specific access [A1-A2] | Useful scoped equity chart prototype or future brokerage-aligned path. IEX is one venue, not consolidated US volume; validate commercial rights separately. These channels do not establish full depth |

MEXC, IQFeed, direct exchange feeds and other vendors are not rejected; they were not sufficiently evaluated to rank in this first pass. No claim of an exhaustive market survey is made.

## Two commercial models to compare

1. **User brings an entitled account:** a local/native connector or vendor-authorized user session. Fits a Rithmic-oriented desktop workflow. Access, simultaneous-session limits and recording/export rights still need confirmation.
2. **ZTerminal supplies data to its users:** a commercial vendor agreement with appropriate exchange permissions, per-user entitlements and reporting. Fits a hosted multi-user product but can materially change costs.

A personal API subscription does not by itself establish redistribution rights. Databento passes through dataset/publisher licensing restrictions [D5]; Massive explicitly requires commercial licensing for redistribution [M3]. A user's API key does not settle the licensing question for a hosted proxy.

Do not budget from an individual plan headline. Request a written quote covering vendor service, exchange display/non-display use, distribution, professional/non-professional users, devices/sessions, historical depth, storage/replay/export, derived analytics and network costs. Public pricing pages are dataset-specific and extraction exposed differing licensing FAQ text, so this report intentionally avoids a firm monthly total.

## Integration implications from the source

- Keep venue, instrument, contract expiry, currency, multiplier and quantity units explicit. A stock-linked perpetual is not the underlying equity or its futures contract. Never silently substitute venues on failure.
- Legacy `TradeEvent` only admits buy/sell and uses numeric timestamps/sequences; V2 already supports unknown side and lossless strings. Preserve unknown aggressor classification and precision when bridging new feeds.
- V2 depth events describe price-level books. Genuine MBO needs order IDs and lifecycle semantics retained in the owning runtime; aggregating it to L2 discards queue information. A `supportsMBO` boolean or subscription label is insufficient.
- Legacy `ContractMetadata` has no option/spot product variant and only USD/USDT currencies. Scope any extension to selected instruments; do not force options or non-USD contracts into perpetual metadata.
- `src/lib/market/session.ts` documents simplified EST/session handling; inspect it alongside `market-sessions.ts` before routing production exchange sessions. Verify DST, holidays, overnight trading dates and early closes through the actual consuming path.
- `src/lib/market/chart-data.ts` requires positive OHLC values. Valid zero/negative-price instruments need a deliberate chart/import policy before support is advertised.
- Keep long-lived vendor secrets in the native runtime or server. A browser connection is appropriate only with the vendor's supported entitlement/session model, such as scoped user tokens. TCP feeds require a persistent process; do not put a continuous feed inside an ordinary request handler.

These are bounded source observations and proposed requirements, not a full architecture audit.

## Proposed execution order and acceptance

1. **Existing crypto completion:** exercise Bybit, OKX and Coinbase through discovery, instrument metadata, bars, stream, DOM and UI. Verify reconnect, gaps, regional access, stale states, delistings and absence of silent fallback. Choose one provider at a time.
2. **Futures feasibility:** obtain an internal sample of one ES or NQ dated contract from Databento under permitted terms. Compare historical/live schemas and reconstruct a known book. In parallel with the product decision, prepare an unsent requirements brief for dxFeed and Rithmic; vendor contact requires a separate instruction.
3. **Choose distribution model:** settle personal/native versus customer-facing service and obtain applicable agreements before a multi-user live-data rollout. Databento is the leading technical hypothesis for research; dxFeed may fit broader distribution better, subject to quotes and trials.
4. **One complete adapter:** verify exact instrument definitions, session boundaries, trades and unknown sides, snapshot recovery, bounded buffering, history/live overlap and visible feed status. Record licensed data only when permitted.
5. **Replay and load acceptance:** replay the same permitted event sample twice and compare book/study outputs; inject dropped, duplicate, out-of-order and reset events. Measure event lag, queue growth, memory and recovery against a recorded workload before claiming performance.
6. **Broader assets:** add Deribit options or an equities feed based on actual demand. Confirm Greeks/IV/open-interest timestamps and model inputs before presenting calculated exposures as market facts.

Open product decisions: priority market (crypto, CME futures, equities/options), personal use versus a product for other users, expected user count and monthly data budget. Research can proceed without these, but a final vendor purchase or implementation scope cannot be chosen reliably from documentation alone.

## Official sources inspected

- D1: [Databento live API](https://databento.com/docs/api-live) — TCP transport, live/replay and common record structures.
- D2: [Databento quickstart](https://databento.com/docs/quickstart) — historical/live access and supported clients.
- D3: [Databento CME dataset](https://databento.com/docs/datasets/glbx-mdp3) — dataset-specific depth, MBO and trade semantics.
- D4: [Databento MBO schema](https://databento.com/docs/schemas/mbo) — order events, IDs, side, sequence and precision. [Official Rust client](https://github.com/databento/databento-rs) also checked through Context7 for live subscriptions/snapshots.
- D5: [Databento pricing and licensing](https://databento.com/pricing), [live licensing guide](https://databento.com/docs/portal/live-data) — dataset and use-case licensing; obtain a current written quote.
- X1: [dxLink](https://kb.dxfeed.com/en/market-data-api/dxlink.html) — transport, user tokens, SDKs, DOM and onboarding.
- R1: [Rithmic APIs](https://www.rithmic.com/apis) — API flavors, development kit and production conformance. Existing local plugin research: `docs/windows/native-parity/ARCHITECTURE.md`.
- C1: [CQG Web API](https://partners.cqg.com/api-resources/web-api), [getting started](https://help.cqg.com/apihelp/Documents/gettingstarted.htm) — market data, authorization and protocol.
- E1: [Deribit subscriptions](https://docs.deribit.com/articles/notifications), [book endpoint](https://docs.deribit.com/api-reference/market-data/public-get_order_book) — channels, raw access and book recovery.
- K1: [Kraken book channel](https://docs.kraken.com/exchange/api-reference/spot-websocket-v2/book).
- K2: [Kraken checksum guide](https://docs.kraken.com/exchange/guides/websockets/book-checksum-v2).
- M1: [Massive business feed contents](https://massive.com/knowledge-base/article/does-the-business-plan-include-real-time-trades-and-quotes-or-only-fair-market-value).
- M2: [Massive business plans](https://massive.com/business).
- M3: [Massive redistribution](https://massive.com/knowledge-base/article/how-can-i-redistribute-massives-market-data).
- A1: [Alpaca stock streaming](https://docs.alpaca.markets/us/docs/real-time-stock-pricing-data).
- A2: [Alpaca market-data access](https://docs.alpaca.markets/us/docs/about-market-data-api).

Verification limits: repository files inspected directly; provider facts checked against official documentation using live web research. No authenticated feed sessions, geographical availability probes, runtime REA inspection, performance benchmarks or production tests were performed. Public documentation does not establish ZTerminal's eligibility or license terms. Application code was not changed.
