# ZTerminal Design-Regression Recovery Record

## Purpose

This record documents the approved recovery from a dashboard-oriented terminal layout to a **chart-native, layer-driven research canvas**. It accompanies the frontend implementation on the isolated product branch and is not a production-release record.

## Removed or demoted chrome

| Previous presentation pattern | Recovery action |
|---|---|
| Terminal wordmark and broad workspace header | Replaced by a compact Z-mark-only chart control strip. |
| Separate terminal destinations for chart, research, studies, and indicators | Replaced by contextual chart actions, utility rail controls, and on-demand sheets. |
| Large market summary/context area | Removed from permanent presentation; symbol, timeframe, price/change, provider state, and account controls are compacted into the single control strip. |
| Permanent multi-panel right-side order-flow dock | Replaced by one active truthful context pane mounted below the chart. |
| Indicator Lab as a separate visual destination | Made available from the Layer Panel, which also lists installed local closed-runtime indicators. |

## Preserved functional contracts

| Contract | Preservation approach |
|---|---|
| Historical market data and chart state | Existing verified candles, coverage, loading, recovery, range, timeframe, replay, and Lightweight Charts attribution remain unchanged. |
| Native studies and safety gates | The existing research-layer registry and availability logic still determine whether each layer can be toggled or must be gated. |
| Public order-flow evidence | DOM, tape, large prints, footprint, Flow Pulse, and CVD continue to depend on current public data; stale/degraded/unavailable data remains withheld. |
| Custom Indicator Lab | The existing closed AST validation and local-only behavior remain unchanged; installed indicators are now visible under `My indicators` within Layers. |
| Research/backtest | The existing code-first strategy compilation, deterministic browser-worker evaluation, optional protocol, marker rendering, data provenance, and no-execution boundary remain unchanged. |
| Workspace and account isolation | Existing guest-local fallback, signed-in explicit sync, revision conflict review, and account control remain present. |
| Execution boundary | No broker, order-entry, paper-trading, or credential route was added. |

## Explicit capability gates

Fear & Greed and simplified COT are shown only as compact source-gated lower-rail utilities. They display `UNAVAILABLE — source integration required` and contain no values until a provider, timestamp, cadence, and classification contract is approved. GEX, options walls, and resting liquidity remain gated or omitted; no placeholder values are rendered.

## Validation required before release

The implementation must pass `pnpm check`, `pnpm test`, and `pnpm build`. Visual validation must confirm the Z-only desktop header, dominant chart density, single lower context pane, responsive sheets, layer availability gates, research/backtest linking, workspace controls, fail-closed evidence states, and PWA update behavior. Production deployment remains subject to explicit user approval.

## Local desktop visual inspection

The local terminal was inspected at a verified Gate.io `QQQX_USDT` 15-minute window after public data loaded. The recovered screen presented a Z-only compact header, visible timeframe controls, a single market quote, contextual actions, a dominant price canvas, verified 97-bar history, active VWAP/EMA/profile/structure legend, candle volume pane, momentum pane, compact history controls, and source-gated Fear & Greed/COT utility indicators. The verified chart rendered meaningful market structure rather than the earlier loading/empty state. Public feed provider selection, live/degraded labels, non-execution footer, and Lightweight Charts attribution remained visible.

## Interactive canvas inspection

The Layer Panel opened from the compact chart action and showed the approved grouped taxonomy: Price, Structure, Flow, Value, Positioning, Liquidity, and My indicators. Existing study toggles remained reachable. GEX was explicitly marked as requiring a data provider; resting liquidity displayed a verified-public-source requirement; and the custom indicator entry point disclosed its closed local runtime.

Opening Research from the same compact chart action replaced the Layer Panel with a right-side chart-connected sheet. Strategy is the default first tab, Backtest is the next action, and Protocol is explicitly marked optional. The sheet retained the verified chart in view, the closed-source strategy editor, compile action, and no-execution boundary.
