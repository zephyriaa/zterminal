# Provider and commercial feasibility — stage 2

Official documentation refreshed 2026-10-30 (Asia/Baku). Read together with [01-baseline.md](01-baseline.md): the main terminal currently uses a single-venue Gate.io/Binance gateway; standalone parsers do not establish additional live integrations. This stage makes no application changes, purchases, agreement acceptance or vendor contact.

## Recommendation and decision boundary

For incremental crypto support, complete Bybit first: current instrument/history groundwork already exists. For futures research and replay, shortlist Databento. For an entitled futures-account workflow, investigate Rithmic using the actual requested native/direct API route. For a customer-facing multi-asset offering, obtain a dxFeed proposal before choosing infrastructure. These are conditional recommendations, not claims of account eligibility, production approval or superior measured performance.

The user's target market choice is pending. Distribution model, audience size, client platform and budget remain unspecified. No paid vendor is selected. The scope that can progress without a purchase is source/fixture work for an existing public crypto path; commercial redistribution remains a distinct unresolved question even when an endpoint is public.

## Capability and integration comparison

Legend: documented means vendor documentation supports the offering, not that ZTerminal has access. Unconfirmed means this investigation did not establish the exact product/entitlement; it is not a claim the vendor lacks it.

| Candidate | Documented useful data | Transport/access | Main integration implication | Unconfirmed gate |
| --- | --- | --- | --- | --- |
| Bybit | Linear market definitions, bars, taker-side public trades and price-level order books [B1-B3] | Public REST/WebSocket market-data path | Complete the current gateway rather than add another transport to the UI | Regional availability, precise stream semantics and commercial reuse terms; no assumption that public access grants redistribution |
| Databento | CME-family futures/options-on-futures dataset, MBP/MBO, matching live/history formats and intraday replay [D1-D3] | Live Raw/TCP and DBN; historical API; official native clients | Persistent native/server adapter required for web delivery; retain exact order lifecycle if selecting MBO | Dataset/schema/account entitlement, historical coverage for chosen dates, total commercial/exchange fees |
| dxFeed / dxLink | Quotes, Greeks, candles, history and price-level DOM [X1] | WebSocket and SDKs; user-scoped token support | Strong candidate for browser/native multi-user delivery; MBP DOM is not proof of MBO | Exact exchange package, retained history/depth, aggregation and commercial agreement |
| Rithmic | Normalized exchange data/reference metadata, historical ticks and API suite [R1] | R\|API+ C++/.NET or separate R\|Protocol; official kit and conformance | Distinguish native plugin proposal from the unavailable web Protocol boundary | Kit, SDK/plugin contract, account/FCM access, capabilities and production approval |
| CQG | Streaming L1/L2, historical ticks and bars [C1] | Authorized protobuf/WSS service | Futures/broker-driven alternative, not necessary for the first crypto slice | Partner/account terms, exact exchanges and historical-depth access |
| Deribit | Book, trade, ticker and options-related channels; incremental change IDs [E1] | Public channels plus authenticated raw interval where required | Useful crypto-options expansion, requiring appropriate product/units/expiry semantics | Complete historical-depth/replay scope and allowed commercial storage/reuse |
| Kraken | Spot L2 snapshots/deltas with checksum [K1-K2] | Spot WebSocket v2 | Useful additional spot venue after a spot identity model exists | History coverage, regional availability and commercial reuse |
| Massive | Stock/options business FMV stream; exchange trades/quotes via feed expansions [M1-M2] | Product-specific business subscriptions and streams | Estimated FMV cannot supply a real execution tape/footprint | Exact exchange expansion, history/depth package and commercial rights |
| Alpaca | Equities trade/quote/bar streams, separate IEX/SIP/delayed feeds; options offering [A1-A2] | Authenticated HTTP/WebSocket; individual vs broker-partner subscriptions | Suitable scoped equity chart candidate; IEX volume is not consolidated volume | Independent-terminal redistribution terms, options feed tier and exact commercial package; these sources do not prove full depth |

No full-depth MBO or historical-book equivalence is inferred across vendors. All crypto venues remain distinct instruments; a stock-linked perpetual is not a direct equity feed. Individual trades, aggregated trades and message batching require provider-specific interpretation, not just a common event name.

## Commercial models

| Requirement | User brings an entitled account | ZTerminal supplies data to users |
| --- | --- | --- |
| Identity/access | Vendor-supported user session; local/native path where required | Appropriate service agreement, downstream entitlement model and user/feed isolation |
| Entitlements | Account/exchange/device/session-specific | Customer reporting and professional-status/device/session treatment defined by agreement |
| Distribution | User keys do not automatically permit a hosted relay | Display/non-display, redistribution and derived analytics rights must cover intended use |
| Recording/replay/export | Confirm each permission and retention period independently | Confirm server storage, client cache, backups, replay and export rights independently |
| Costs | Plan plus applicable exchange/device/session fees | Vendor service plus exchange/distribution/reporting/infrastructure costs |

Databento's pricing material exposes dataset/publisher restrictions, and different extracted sections mix legacy usage billing with newer plans; it is unsuitable for deriving a definitive all-in quote. Massive explicitly distinguishes commercial redistribution from individual subscriptions. dxLink documents short-lived user token patterns, but that is a technical access model rather than a license grant. [D3, M2, X1]

## Price evidence and limits

As accessed 2026-10-30; monetary entries are USD/month where specified by the source. No fees below are an approved budget or a like-for-like vendor comparison.

| Candidate/product | Public evidence | What remains outside that number |
| --- | --- | --- |
| Databento CME displayed plans [D3] | Standard $199/month; Plus $1,750/month shown with annual commitment | Exact live-use eligibility, license charges and distribution terms require confirmation; extracted page also contains older pricing text, so these are observations, not a validated quote |
| Alpaca individual equities [A1] | Basic free/IEX; Algo Trader Plus $99/month/all-US-exchange coverage | Individual access does not establish multi-user redistribution; partner pricing is a separate model |
| dxFeed, Rithmic, CQG | No comparable validated ZTerminal quote obtained | Exchange list, users/devices, API/partner cost, retention, conformance and distribution |
| Massive business | Feed-expansion requirement confirmed; no all-in package priced here | Base subscription, actual trade/quote expansion, exchange approval/fees and rights |
| Bybit, Deribit, Kraken | Public-channel documentation reviewed; no subscription cost asserted for ZTerminal's intended use | Network/hosting costs and commercial terms; public API availability is not a redistribution conclusion |

No payment action was taken. Written vendor confirmation should settle inconsistent or account-specific terms before a paid integration is selected.

## Important implementation evidence for a possible Bybit slice

The standard `orderbook.<depth>.<symbol>` channel describes snapshot/delta replacement and deletion rules; its update IDs, cross-sequence and restart behavior must be interpreted for that exact channel. A separate full-orderbook page describes a different bootstrap/continuity procedure. Do not copy full-depth assumptions into the standard depth stream merely because Context7 retrieves both. The public trade schema includes string trade IDs and taker side, and instrument discovery needs pagination for the complete linear catalogue. [B1-B3]

Existing tests prove behavior of the current parser against authored fixtures, not agreement with every current vendor rule. Before reusing that parser, verify sequence assumptions against the selected official channel. Prefer bounded supported L2 over speculative MBO. No implementation is included in this stage.

## Alternatives and reasons to defer

- Do not add an aggregator dependency just to make one gateway provider work. Compare only if several adapters reveal concrete repeated requirements.
- Do not treat Coinbase as the smallest next feed: current route deliberately rejects its spot identity and the legacy product model needs extending.
- Do not add both Databento and Rithmic immediately. Their access models address different needs and introduce paid/access/conformance prerequisites absent from a crypto completion slice.
- Defer options analytics until contract metadata, timestamped OI/Greeks/IV and calculation assumptions are established. Availability of an options channel alone does not validate GEX.
- Direct exchange feeds and IQFeed were not sufficiently assessed to rank; they are not ruled out.

## Unsent vendor requirements brief

For each shortlisted paid provider, request the following only after vendor contact is explicitly authorized:

1. Can this ZTerminal web/Windows use case consume the selected exchanges as a personal/user-entitled application, a hosted commercial terminal, or both? What agreements/onboarding/conformance apply?
2. For one dated ES/NQ contract initially, what trades, L1, L2, MBO and historical book coverage are available, with what native side/ID/timestamp semantics and replay limits?
3. Are user-scoped browser tokens, a local native session and/or a hosted gateway supported? What user/device/concurrent-session limits apply?
4. What are the permitted cache/recording durations and replay/export/backup/derived-analytics rights, including when a user's subscription expires?
5. Provide an itemized USD quote for the specified exchange package and assumed user count, including professional status, display/non-display, distribution, SDK/partner/conformance fees and contract term. User count and budget must be supplied first; do not invent them.

No messages were sent.

## Official sources and access record

All accessed 2026-10-30. Content was read through live extraction; Bybit was additionally checked through Context7's official `/bybit-exchange/docs` source. An unfocused search returned third-party material, which was excluded. Some dynamic documentation extraction included navigation, duplicated examples or page-render errors; only identifiable relevant passages were used. These are documentation observations, not authenticated feed probes.

- B1: [Bybit standard order book](https://bybit-exchange.github.io/docs/v5/websocket/public/orderbook).
- B2: [Bybit public trades](https://bybit-exchange.github.io/docs/v5/websocket/public/trade).
- B3: [Bybit instrument information](https://bybit-exchange.github.io/docs/v5/market/instrument).
- D1: [Databento live API](https://databento.com/docs/api-live).
- D2: [Databento CME dataset](https://databento.com/docs/datasets/glbx-mdp3).
- D3: [Databento pricing/licensing](https://databento.com/pricing). The portal/live-data URL returned mostly navigation this pass; it is not treated as fresh confirmation of account terms.
- X1: [dxLink](https://kb.dxfeed.com/en/market-data-api/dxlink.html).
- R1: [Rithmic APIs](https://www.rithmic.com/apis).
- C1: [CQG Web API](https://partners.cqg.com/api-resources/web-api).
- E1: [Deribit subscriptions](https://docs.deribit.com/articles/notifications).
- K1: [Kraken L2 book](https://docs.kraken.com/exchange/api-reference/spot-websocket-v2/book).
- K2: [Kraken checksum guide](https://docs.kraken.com/exchange/guides/websockets/book-checksum-v2), inspected during the preceding research in this chat; fresh book extraction corroborates checksum-bearing snapshots.
- M1: [Massive business stream contents](https://massive.com/knowledge-base/article/does-the-business-plan-include-real-time-trades-and-quotes-or-only-fair-market-value).
- M2: [Massive redistribution](https://massive.com/knowledge-base/article/how-can-i-redistribute-massives-market-data).
- A1: [Alpaca market-data access/pricing](https://docs.alpaca.markets/us/docs/about-market-data-api).
- A2: [Alpaca stock stream](https://docs.alpaca.markets/us/docs/real-time-stock-pricing-data), inspected during the preceding research in this chat; fresh access documentation confirms individual/partner distinctions.

## Handoff

Stage 2 comparison is complete, with quote/rights/account unknowns retained rather than guessed. Only this report was added in this stage. No code/tests/dependencies changed, and no live market-data sessions were opened. Stage 3 should choose a target and produce the bounded spec. Bybit is the recommended default for an existing crypto completion; a paid futures choice requires the missing product/access decisions. The overall goal remains active.
