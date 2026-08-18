# ZTerminal Premium Rebuild Audit

## Audit scope

This audit covers the production service at `https://zterminal.onrender.com`, the recovery checkout at `/home/ubuntu/zterminal-recovery`, and the user-supplied premium terminal reference image. The objective is not a cosmetic reskin. It is to replace the constrained bespoke chart interaction model with a reliable, extensible professional charting workspace while preserving the verified-data and research-integrity controls delivered in the recovery release.

## Initial production evidence

The public service was reachable during the audit. Its health endpoint returned a healthy application state with execution disabled. The application also served a live Gate.io QQQX/USDT snapshot and a verified 97-bar historical window. This confirms that the recovery data path is operating, but it does not establish premium charting quality or broad product functionality.

| Area | Evidence | Assessment |
|---|---|---|
| Data freshness | Live public snapshot and bounded historical dataset loaded in production | Retain and improve visibility. |
| Coverage integrity | Exact UTC range and returned bar count are disclosed | Retain; move this information into a more polished contextual status treatment. |
| Chart engine | The primary chart is hand-drawn inside a 1030×470 SVG with fixed geometry and no interaction state beyond a replay slice | Replace. It cannot credibly support professional pan, zoom, crosshair, autoscale, annotations, responsive scaling, or multi-pane studies. |
| Layout | Page uses many small utility panels and hardcoded widths | Replace with a full-screen chart-first workstation and progressive disclosure. |
| Product controls | Symbol input, interval, range, studies, research draft, and evaluation exist but are fragmented | Consolidate into an intentional top command bar, chart controls, and inspectable drawer. |
| Specialist layers | CVD and GEX are explicitly unavailable, yet remain placed alongside rendered studies | Keep visible as gated roadmap capabilities rather than presenting them as normal chart tools. |

## Root causes of the cheap and fragile experience

The chart is a monolithic inline SVG renderer in `client/src/pages/Home.tsx`. It fixes chart coordinates, candle width, overlay placement, profile position, and y-axis labels. It provides no pointer model, no crosshair, no viewport/window state, no price or time scale behavior, no robust loading/error state within the visual canvas, no drawing/annotation substrate, and no genuine multi-pane study architecture. The stylesheet compacts the entire app into small font sizes and narrow permanent sidebars, leaving the chart visually cramped and making high-value information difficult to parse.

The supplied reference illustrates the target interaction hierarchy: a quiet full-screen shell; chart-dominant composition; clear chart and study toolbars; left drawing rail; precise grid, price scale, and current-price marker; volume profile integrated into the chart; professional overlays; multi-pane lower studies; and restrained neon accents rather than decoration-heavy panels.

## Confirmed scope boundaries

The replacement must retain the existing truthful Gate.io data contract, explicit coverage, feature version/fingerprint, research-only backtesting boundaries, and clear unavailable states. It must not claim real-time tick-derived CVD, options-derived GEX, broker execution, or cloud workspace persistence until the required providers and environment configuration exist.

## Next audit actions

The remaining audit will inspect API responses and unsupported-symbol/error paths, test current production controls where possible, inventory existing testing coverage, select a reliable chart-rendering architecture compatible with the current React stack, and create measurable acceptance criteria for the redesign.

## Controlled local functional result

A local instance successfully loaded the same Gate.io snapshot and verified 97-bar data window after its initial loading state. The underlying current data path therefore functions for the default instrument. The rendered result nevertheless confirms the quality failure: the chart occupies a restricted central pane, its visual scale is constrained by fixed SVG geometry, price-axis labels do not correspond to normal scale ticks, volume profile bars appear as detached blocks, and the interface exposes multiple dense utility regions before it establishes a premium charting workspace.

The production service intermittently closed browser and shell connections during this audit while text extraction still returned successful responses. This is a hosting/network reliability issue to diagnose separately; it is not evidence that the market router itself has failed.

## Instrument-switch result

The local UI successfully switched from QQQX/USDT to BTC/USDT and updated the snapshot, historical series, indicators, coverage, and fingerprint. This confirms the supported-symbol path works. The stale notice remained visible after the data had finished loading, which is a product-state defect: users are told that data is still loading after it is present. The premium rebuild will replace this generic notice bar with data-state-aware status feedback and remove stale asynchronous messages automatically.

## Unsupported-instrument result

An unsupported symbol correctly produces no fabricated quote or candles, which is the right data-integrity behavior. The UX is not acceptable: the terminal changes the primary title to the invalid symbol, then leaves an empty chart with a generic waiting card and no recovery action. The redesign must preserve the last verified chart until replacement data arrives, present a clear inline unsupported-market state, offer a return-to-last-market action, and surface searchable supported-market suggestions instead of creating a blank terminal.

## Long-range behavior

The 1M BTC/USDT request returned 2,001 bars and correctly disclosed partial effective coverage because the provider request was bounded. This demonstrates a valuable integrity behavior to retain. It also exposes a serious renderer limitation: 2,001 candles are compressed into the same fixed SVG geometry, creating unreadable visual noise with no zoom, pan, visible-range control, or density management. The premium chart engine must make the effective window and provider limit visible while supporting native pan/zoom and sensible initial visible ranges.

## Premium rebuild browser validation

The local premium workstation loaded verified QQQX/USDT data and rendered a native interactive chart rather than the fixed SVG. The validated view includes native candlesticks, EMA/VWAP lines, POC/VAH/VAL and loaded-window structure labels, right price scale, time scale, volume pane, RSI/momentum pane, true chart attribution, and visible coverage context. The chart-first layout materially resolves the previous cramped-card composition and long-range rendering architecture.

## Research workflow validation after rebuild

The revised drawer behavior now keeps only one contextual surface open, preserving chart prominence. Research mode retained the verified data contract and completed a deterministic evaluation (`bt_a-c033950b`) over the loaded 97-bar window, with a displayed dataset fingerprint, historical-only treatment, and the existing no-broker/no-advice warning. A subtle refresh label now distinguishes background polling from an initial empty-state load.

## Long-window validation after rebuild

A longer QQQX/USDT request returned 2,001 bars and truthfully displayed partial coverage. Unlike the prior fixed SVG renderer, the native chart selected a legible latest visible range and retained its scales, studies, volume pane, and momentum pane. The effective range remained inspectable in the data contract rather than being mistaken for full requested coverage.

## Native interaction validation

Pointer movement across the rebuilt chart updated the displayed OHLC and timestamp context for the hovered historical candle, confirming active native crosshair behavior rather than a static chart illustration. The same 2,001-bar screen retained visible price/time scales and multi-pane rendering while the hovered bar was identified.
