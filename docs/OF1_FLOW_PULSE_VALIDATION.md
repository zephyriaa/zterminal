# OF1 Flow Pulse Validation

**Branch:** `product/orderflow-research-terminal`
**Scope:** Professional live order-flow evidence panel
**Validation date:** 2026-08-18
**Release state:** Validated on the product branch only. This record does **not** authorize a merge to `render-hosted-research-terminal` or a Render deployment.

## Objective

OF1 introduces an optional **Flow Pulse** study that makes bounded, current order-flow evidence easier to read without presenting it as an alert, forecast, recommendation, or execution control. The slice adds a 30-second selected-venue tape-delta view and a separately labelled Gate.io top-level-depth imbalance view.

> Flow Pulse describes observed current public data only. It does not generate automated alerts, estimate future price direction, consolidate liquidity across venues, or create any broker/execution route.

## Data Contract and Guardrails

| Surface | Input | Contract | Withhold behavior |
|---|---|---|---|
| 30-second tape delta | The currently selected bounded public trade tape | `calculateLiveTapeBuckets()` orders current normalized signed trades, preserves exchange-reported taker side, and aggregates buy/sell size into fixed 30-second buckets. | The tape section does not render values unless the selected tape state is `LIVE`. |
| Depth imbalance | Current Gate.io reconciled public order book | `summarizeDepthImbalance()` sums valid positive top-level bid and ask size, then describes their current normalized imbalance. | The depth section does not render values until Gate.io depth is `LIVE` after snapshot-plus-sequenced-delta reconciliation. |
| Combined presentation | Selected tape plus Gate.io depth | Inputs remain independently venue-labelled and are displayed side-by-side only. | No cross-venue total, combined liquidity claim, or inferred execution quality is shown. |
| Study registry | `flowPulse` research layer | Registry detail explicitly states that the study creates no automated alert, prediction, or execution action. | The panel is opt-in through the Studies drawer. |

The Flow Pulse UI exposes the same boundary in three visible locations: the panel subtitle, its footer, and the Studies-drawer capability detail. The depth card also explicitly states that it is **not executable liquidity**.

## Deterministic Validation

The pure-contract fixtures cover ordered 30-second bucketing and depth-state semantics.

| Check | Result |
|---|---|
| Tape bucket retains signed public-tape direction | Passed: 30-second buckets produce the expected buy size, sell size, delta, and trade count. |
| Depth imbalance handles bid-heavy book | Passed: 8 bid units vs. 2 ask units returns `BID_HEAVY` with a normalized ratio of `0.6`. |
| Empty depth is fail-closed | Passed: empty sides return `EMPTY`, a null ratio, and zero net size. |
| Workspace capability contract | Passed: `flowPulse` is available only as live public tape plus Gate.io depth evidence and contains the explicit no-automation wording. |
| Static typing | `pnpm check` passed. |
| Full regression | `pnpm test` passed: **21 test files, 66 tests**. |
| Production bundle | `pnpm build` passed. |

## Browser Observation

The local workstation was opened at `http://localhost:3001` and Flow Pulse was enabled from **Studies**. The observed state showed:

1. Gate.io public tape in `LIVE` state and the panel status marked `CURRENT`.
2. A populated 30-second tape-delta card labelled **Gate.io** and showing exchange-reported trade count and a descriptive taker-flow balance label.
3. Gate.io depth still awaiting a reconcilable public update, with the depth card withholding any numeric imbalance and displaying the provider reason instead.
4. The selected Flow Pulse drawer detail stating its source as **“Live public tape + Gate.io reconciled depth when available”** and its no-automated-alert/prediction/execution boundary.

This confirms that live tape can render independently while depth remains unavailable, rather than using a fabricated depth imbalance or stale book.

## Files Covered

| File | Change |
|---|---|
| `shared/market/orderFlowContracts.ts` | Added `LiveTapeBucket`, `DepthImbalanceSummary`, `calculateLiveTapeBuckets()`, and `summarizeDepthImbalance()`. |
| `shared/market/orderFlowContracts.test.ts` | Added deterministic tape-bucket and depth-imbalance fixtures. |
| `client/src/lib/terminalWorkspace.ts` | Added the `flowPulse` capability and explicit non-automation provenance. |
| `server/terminalWorkspace.test.ts` | Added Flow Pulse registry-boundary assertions. |
| `client/src/pages/Home.tsx` | Added the opt-in Flow Pulse panel and live-query gating. |
| `client/src/index.css` | Added responsive Flow Pulse styling consistent with the existing dark teal/violet terminal palette. |

## Residual Limits

Flow Pulse is deliberately a **live-only research aid**. It does not provide a historical tape archive, historical DOM reconstruction, true volume-at-price profile, option-derived GEX, cross-exchange liquidity consolidation, divergence alerts, or trading automation. Binance USDⓈ-M remains `VERIFYING` until a release-environment WebSocket event is captured; non-live tape is withheld from the Flow Pulse tape card.

## Promotion Gate

This validation supports a commit and push to the product branch only. Production promotion remains blocked pending explicit user approval and the existing review-only controls on recovery PR #4.
