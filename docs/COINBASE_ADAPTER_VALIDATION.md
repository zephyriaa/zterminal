# Coinbase Exchange Public-Spot Adapter Validation

## Scope

This record validates the free public-trade tape adapter for Coinbase Exchange USD spot. The adapter is implemented through [`shared/market/multiExchangeContracts.ts`](../shared/market/multiExchangeContracts.ts), [`server/multiExchangeTradeStream.ts`](../server/multiExchangeTradeStream.ts), [`server/routers.ts`](../server/routers.ts), and the explicitly venue-labelled terminal panels in [`client/src/pages/Home.tsx`](../client/src/pages/Home.tsx).

The source is Coinbase Exchange’s unauthenticated public WebSocket feed at `wss://ws-feed.exchange.coinbase.com`, subscribed to the `matches` and `heartbeat` channels. No credential, private account endpoint, trading endpoint, or order-submission capability is used.

## Product mapping and data contract

| Canonical terminal market | Coinbase product | Data type | Availability |
|---|---|---|---|
| `BTC_USDT` | `BTC_USD` | Public spot matches | Supported |
| `ETH_USDT` | `ETH_USD` | Public spot matches | Supported |
| Other canonical `*_USDT` symbols | No assumed product mapping | No substituted data | Explicitly degraded/unavailable |

> **Venue and product separation:** Coinbase data is USD spot trade tape. The primary chart, historical candles, quote metrics, CVD source, and DOM remain Gate.io perpetual data unless and until their own venue-specific contracts are released.

## Normalisation and liveness controls

| Control | Implemented behaviour |
|---|---|
| Side normalisation | Coinbase publishes the resting maker side. The adapter inverts it to a derived taker side before emitting the signed public trade. |
| Product mapping | Terminal `BTC_USDT` and `ETH_USDT` map only to Coinbase `BTC_USD` and `ETH_USD`; unsupported markets do not fall back silently. |
| Heartbeats | The public heartbeat stream is monitored for transport liveness. |
| Sequence check | Non-contiguous match identifiers trigger bounded tape reset/degradation rather than a misleading continuous tape claim. |
| Bounded retention | Only the current capped public tape window is retained. No historical tick reconstruction is claimed. |
| Consumer state | UI panels expose `LIVE`, `STALE`, `DEGRADED`, or `UNAVAILABLE`; non-live tape is withheld from live studies. |

## Browser verification

The local terminal was checked with `BTC_USDT` selected. The feed-health strip reported **Coinbase Exchange USD Spot — LIVE** alongside the already live Gate.io chart feed. Selecting Coinbase showed a visible provenance notice stating that the public spot tape was selected while chart history and DOM remained Gate.io-only. The selected-venue large-print panel then identified the tape as Coinbase Exchange USD Spot and disclosed that the taker side is derived from inverted maker side.

| Browser check | Result |
|---|---|
| Coinbase health chip visible | Pass |
| Coinbase `BTC_USD` public feed reached `LIVE` | Pass |
| Venue-specific selected-tape label rendered | Pass |
| Maker-side inversion / derived taker-side language rendered | Pass |
| Gate.io chart and DOM explicitly retained | Pass |
| Cross-venue Flow Pulse tape/depth combination withheld | Pass — UI now labels this state `DEPTH ONLY` and explains the exclusion |

## Automated validation

| Gate | Result |
|---|---|
| Coinbase normalisation fixture, including maker-to-taker inversion | Pass |
| Stream lifecycle and heartbeat-gap behaviour | Pass |
| Provider catalog contract | Pass |
| Workspace selection persistence | Pass |
| `pnpm check` | Pass |
| `pnpm test` | Pass — 23 test files, 80 tests |
| `pnpm build` | Pass |

## Deliberate limits

Coinbase depth is **not** exposed: it requires a separately designed snapshot and gap-recovery contract. Coinbase tape is not used to construct CVD, because CVD remains sourced strictly from the live Gate.io tape paired with the canonical Gate.io perpetual market. Flow Pulse is prevented from combining Coinbase USD-spot tape with Gate.io perpetual depth. The adapter does not provide candles, historical trades, executions, broker routing, or trade recommendations.
