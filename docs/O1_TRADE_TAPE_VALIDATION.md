# O1 Trade-Tape Transport Validation

## Evidence Completed

The official Gate.io documentation and bounded public probes confirmed the documented endpoint, decimal-size header, taker-sign definition, trade event fields, and order-book snapshot/delta reconciliation condition. Sanitized captures are retained under `docs/evidence/`.

## Local API Smoke Observation

A first request to `market.tradeTape(BTC_USDT, limit=5)` truthfully returned `CONNECTING` / `DEGRADED` with an empty trade array before any public event had been observed. A subsequent browser view did not issue a fresh query and therefore displayed the original cached HTTP response. The next validation action is a fresh API request and server-session inspection; no user-facing CVD or tape layer has been enabled.

A fresh local `market.tradeTape(BTC_USDT, limit=5)` request then returned `LIVE` with five normalized public Gate.io trades, exchange timestamps, sequential IDs, both positive and negative signed sizes, `lastTradeAt`, `lastMessageAt`, and zero reconnect attempts. The procedure exposed no credential, account, execution, or private-order surface.

The local workstation loaded the existing verified QQQX/USDT 15-minute window with 97 disclosed bars and native chart panes before CVD activation. This establishes that the order-flow addition is being tested on the canonical verified-candle workstation rather than a separate or simulated display.

Opening Studies exposed CVD as an opt-in Flow study while GEX remained gated. Immediately after enabling CVD, the chart displayed `CVD · degraded` and did not render a synthetic CVD pane. This is the required initial no-data state while the bounded public stream is connecting.

The default QQQX/USDT stream remained visibly `degraded` rather than fabricating CVD when no qualifying public trades were observed in the bounded staleness window. Switching to BTC/USDT retained the last verified QQQX chart until the new market was confirmed, while correctly keeping CVD degraded during the instrument transition.

A hot reload reset local UI state to its default QQQX/USDT chart and disabled the opt-in CVD toggle. The reset did not alter market contracts or server state; the final disclosure check is therefore repeated from a clean workstation state.

On the liquid BTC/USDT perpetual, CVD transitioned to `LIVE` with a bounded 500-trade public-tape window and a distinct additional chart pane. The CVD pane was not shown until live events were available; GEX remained unavailable.

The final BTC/USDT CVD detail verification passed. The live chart label showed `CVD · 500 live tape trades`; the study described exchange-reported signed taker size, listed `Gate.io public taker-signed trade tape` as source, identified the loaded window as `Current bounded public tape`, and stated `Rendered from live public trade tape`. It did not make a candle-derived or historical-tick claim.

## Quality Gates

The full Vitest suite completed before the production build, and the production build completed before the dependency audit. The final audit returned a non-zero status for **33 transitive findings**: 7 low and 26 moderate, with no critical or high severity finding reported. These are tracked as the dependency-security backlog for the later security-hardening slice and block no local O1 behavior validation. Production promotion remains out of scope until the planned release and security gates are reviewed.
