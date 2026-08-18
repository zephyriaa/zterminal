# OF2 Order-Flow Context Validation

**Branch:** `product/orderflow-research-terminal`
**Validation date:** 2026-08-18
**Release state:** Product-branch validation only. No recovery merge, production-branch modification, or Render deployment is authorized by this record.

## Delivered Capability

OF2 completes the next truthful order-flow context slice with two distinct opt-in surfaces. **UTC session volume** is calculated from the latest UTC-day segment of verified Gate.io historical candles, while **Large tape prints** is calculated from the currently selected venue’s bounded live public trade tape. Their source contracts are separate and remain visible in the interface.

| Surface | Data source | Visible data | Explicit limitations |
|---|---|---|---|
| UTC session volume | Latest UTC-day subset of loaded verified Gate.io OHLCV bars | Candle-close-bin POC, VAH, VAL, a compact bin histogram, 70% value area, and verified session-candle count. | Not tick volume-at-price, no intrabar reconstruction, no user/exchange-local session, no prediction. |
| Large tape prints | Selected venue’s current bounded normalized public tape | Exchange-reported time, price, contract size, taker side, and a local minimum reported-size filter. | Not USD notional, not historical ticks, not cross-venue flow, not an institutional-participant claim, no signal/alert/order. |

## Contract and Test Evidence

| Check | Result |
|---|---|
| UTC session isolation | Passed: a deterministic fixture excludes a prior UTC day and returns the exact latest UTC-day start/end, candle count, bins, POC, and value area. |
| Candle-only provenance | Passed: the fixed source identifier is `UTC_SESSION_CANDLE_CLOSE_VOLUME`; the UI says `candle-close volume bins · not tick volume-at-price`. |
| Invalid/flat session withholding | Passed: no profile is returned when verified bars cannot form a valid non-flat distribution. |
| Large-print ordering and threshold | Passed: tests preserve normalized exchange ordering, provider/symbol identity, taker sign, and only retain prints at or above the positive reported-size threshold. |
| No dollar-notional fabrication | Passed: the contract contains a reported-size threshold only; no multiplier or USD conversion is supplied. |
| Current selected-tape gate | Passed: large prints are queried and rendered only when the selected public tape is `LIVE`. |
| Full quality gates | `pnpm check` passed; `pnpm test` passed with **22 test files / 72 tests**; `pnpm build` passed; `git diff --check` passed. |

## Browser Evidence

The browser first confirmed the new studies were absent by default. Once enabled with Gate.io current and the 97-bar verified 15-minute chart window, UTC session volume rendered a `VERIFIED` panel with POC/VAH/VAL, 77 verified session candles, a 70% value-area note, and the explicit candle-close/non-tick label. Large tape prints rendered a `LIVE` Gate.io panel with a local minimum reported-size control labelled **selected venue contract units**, current buy/sell rows, and the labels **not USD notional** and **Not a trade signal**.

The selected tape was then switched to `DEGRADED` Binance USDⓈ-M. Large tape prints became `DEGRADED` and displayed **“Large prints withheld — Awaiting a current selected public trade-tape window.”** Gate.io rows were not substituted. The tape selection was restored to Gate.io `LIVE` after validation.

## Preserved Boundaries

> This work does not provide historical tick data, true tick-level volume profile, CVD history, DOM history, large-order dollar notional, cross-venue liquidity, large-trade alerts, GEX, broker routing, paper trading, execution, or directional prediction. It remains public-market research context only.

## Files Covered

| File | Change |
|---|---|
| `shared/features/registry.ts` | Adds latest UTC-day candle-close volume profile contract. |
| `shared/features/registry.test.ts` | Adds UTC-day isolation and source-aware candle-volume fixtures. |
| `shared/market/orderFlowContracts.ts` | Adds deterministic selected-venue reported-size large-print contract. |
| `shared/market/orderFlowContracts.test.ts` | Adds threshold, ordering, side, provider, and invalid-threshold coverage. |
| `client/src/lib/terminalWorkspace.ts` | Registers `UTC session volume` and `Large tape prints` studies with explicit limitations. |
| `client/src/pages/Home.tsx` | Adds opt-in panels, live tape gating, study-drawer provenance, and threshold control. |
| `client/src/index.css` | Adds compact premium dock styling for both panels. |
| `docs/OF2_ORDER_FLOW_CONTEXT_CONTRACT.md` | Defines source, math, and non-claim boundaries. |
| `docs/OF2_ORDER_FLOW_CONTEXT_AUDIT.md` | Records source audit and browser observations. |
