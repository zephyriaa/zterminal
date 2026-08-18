# Indicator Lab Validation

## Scope

Indicator Lab allows a researcher to author a constrained candle-based study within the terminal. Its validation boundary is defined by the closed interpreter in [`shared/indicators/indicatorRuntime.ts`](../shared/indicators/indicatorRuntime.ts), with user interaction provided by [`client/src/components/terminal/IndicatorLabDrawer.tsx`](../client/src/components/terminal/IndicatorLabDrawer.tsx) and visual rendering performed by [`client/src/components/terminal/ProfessionalChart.tsx`](../client/src/components/terminal/ProfessionalChart.tsx).

> **Security model:** This is not JavaScript, Pine Script, or a general-purpose scripting environment. A formula is parsed into a closed AST and evaluated only against the loaded candle series. There is no `eval`, host execution, network capability, filesystem access, import surface, callback mechanism, or trade/execution integration.

## Supported authoring surface

| Surface | Allowed contract |
|---|---|
| Candle sources | `open`, `high`, `low`, `close`, `volume`, `hl2`, `hlc3`, `ohlc4` |
| Functions | `sma`, `ema`, `rsi`, `abs`, `min`, `max` |
| Inputs | Up to eight bounded numeric inputs |
| Formula size | Maximum 1,200 characters |
| Output | A chart series evaluated only over the verified, currently loaded candle window |

## Explicitly denied capabilities

| Capability | Status | Reason |
|---|---|---|
| Arbitrary JavaScript execution | Denied | Prevents browser/host code execution through a saved formula. |
| Pine Script compatibility | Denied | Pine is a general scripting language outside this deliberately constrained contract. |
| Requests or external APIs | Denied | Keeps custom studies deterministic and candle-only. |
| Account credential access | Denied | The runtime receives candle values and bounded inputs only. |
| Trading, alerts, or broker actions | Denied | The terminal remains research-only. |

## Validation evidence

A formula was entered through the browser UI, validated by the closed runtime, and added to the active chart as a custom series. The interaction was exercised with the terminal’s verified candle data, confirming that the UI does not add a study before validation succeeds.

| Check | Evidence | Result |
|---|---|---|
| Overlay arithmetic evaluation | `indicatorRuntime.test.ts` deterministic test | Pass |
| SMA evaluation | `indicatorRuntime.test.ts` deterministic test | Pass |
| Escape-hatch rejection | `indicatorRuntime.test.ts` rejects non-DSL code surface | Pass |
| Bounded input enforcement | `indicatorRuntime.test.ts` validates limit handling | Pass |
| Formula validation and add-to-chart UI path | Browser exercised | Pass |
| Static type check | `pnpm check` | Pass |
| Combined regression suite | `pnpm test` — 23 files, 80 tests | Pass |
| Production build | `pnpm build` | Pass |

## Interpretation limit

A user-created study is a reproducible transformation of the loaded candle window; it is not a prediction, recommendation, alert, or assurance of market performance. The study is bounded by the historical-data provenance shown by the terminal and does not change the provenance of that source data.
