# OF2 Professional Order-Flow Context Audit

**Branch:** `product/orderflow-research-terminal`
**Date:** 2026-08-18
**Scope:** Remaining professional order-flow context after live Flow Pulse and bounded tape foundations.

## Existing Evidence Surfaces

| Existing surface | Source | Truthful present capability | Limitation |
|---|---|---|---|
| Loaded-window volume profile | Verified Gate.io OHLCV candles | POC, VAH, and VAL from candle close-price bins across the currently loaded window. | It is not tick-level volume-at-price and does not reset by session. |
| Flow Pulse | Selected bounded public tape plus Gate.io reconciled depth | Current 30-second signed tape delta and current depth imbalance evidence. | It is live-only, venue-labelled, non-predictive, and neither input can be replayed historically. |
| Time & Sales / live footprint | Selected public taker-signed bounded trade tape | Exact printed price, reported size, and exchange-reported taker side in the current buffer. | No historical tick archive, no complete market volume, and no cross-venue consolidation. |
| Live DOM | Gate.io snapshot plus sequenced public deltas | Current top-of-book levels. | No historical depth or executable-liquidity representation. |

## Source Limits That Govern This Slice

The current historical data contract contains **candle OHLCV only**. It cannot support a claim that POC/VAH/VAL was computed from intrabar ticks. A truthful extension can group each verified candle’s reported volume into its closing-price bin, reset the calculation at a labelled UTC-day boundary, and visibly call the result **UTC session candle-volume context**.

The normalized public tape exposes `price` and exchange-reported `signedSize`, but the terminal has no verified common contract multiplier or quote-notional metadata across Gate.io, Binance USDⓈ-M, and Bybit Linear. Therefore a configurable **$10K** cutoff would be misleading. The truthful product primitive is a selected-venue **reported-size threshold**, never a dollar-notional assertion. A trade remains a displayed current tape event, not a signal, order, or inferred institutional participant.

## Proposed Small Slice

| Addition | Source and scope | Fail-closed behavior |
|---|---|---|
| UTC session candle-volume context | Latest UTC-day segment of the loaded verified Gate.io candle window; close-price bins, POC/VAH/VAL, and explicit candle-volume provenance. | Does not render when the verified bars cannot produce a non-flat session distribution. |
| Large tape prints | Selected venue’s current bounded public tape, filtered by a user-set reported-size threshold. | Withholds all rows when the selected tape is not `LIVE`; never substitutes candle volume or stale tape. |

> Neither addition predicts direction, combines venues, reconstructs historical tick data, reports dollar notional, places/alerts/orders, nor contributes an automated strategy input.

## Browser Baseline Observation

After a reload, neither new context panel rendered by default. The workstation recovered to a verified 97-bar Gate.io 15-minute window, while Flow Pulse independently displayed current selected-tape and reconciled-depth evidence. This preserves the intended separation: candle context comes only from the historical window and selected-venue print evidence requires explicit study opt-in plus a current tape.

With the UTC session-volume study enabled, the local workstation rendered a compact panel showing `VERIFIED`, the explicit label **“Latest UTC day · candle-close volume bins · not tick volume-at-price”**, POC/VAH/VAL, a 70% value-area label, and 77 verified session candles. The panel occupied the opt-in dock without replacing the chart or claiming a tick-derived profile.

With the large-print study enabled while Gate.io tape was `LIVE`, the panel showed **“current bounded tape · reported size, not USD notional”**, a local **Minimum reported size** control labelled in selected-venue contract units, eight current rows, and **“Not a trade signal.”** The displayed rows retained exchange-reported buy/sell signs and current timestamps. No cross-venue consolidation or dollar-notional conversion appeared.

After selecting the `DEGRADED` Binance USDⓈ-M tape, the workstation retained the Gate.io candle panel with its independent provenance but changed Large tape prints to `DEGRADED` and displayed **“Large prints withheld — Awaiting a current selected public trade-tape window.”** No Gate.io rows were substituted. The existing context banner also stated that chart history and DOM remained Gate.io-only.
