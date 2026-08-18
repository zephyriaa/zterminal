# Chart Attribution Update

## Decision

The in-chart Lightweight Charts attribution logo has been disabled with the chart configuration’s `attributionLogo: false` option. It is replaced by a small external ZTerminal footer notice that reads:

> TradingView Lightweight Charts™ Copyright (c) 2025 TradingView, Inc.

The notice links to `https://www.tradingview.com/` and is rendered on the public application page outside the chart surface.

## Compliance basis

The official Lightweight Charts documentation requires that TradingView is named as the product creator and that a public application page includes the attribution notice from the project’s `NOTICE` file and a link to TradingView. The official NOTICE identifies **TradingView Lightweight Charts™** and **Copyright (c) 2025 TradingView, Inc.** The chosen footer treatment preserves those required elements while keeping the analytical chart canvas ZTerminal-branded.

## Local validation

The updated chart loaded verified QQQX/USDT data, native chart panes, overlays, price/time scales, and crosshair behavior. No TradingView attribution logo was present inside the chart canvas. The public footer rendered the required external attribution link.

## References

[1] [Lightweight Charts — License and attribution](https://tradingview.github.io/lightweight-charts/docs)

[2] [TradingView Lightweight Charts NOTICE](https://github.com/tradingview/lightweight-charts/blob/master/NOTICE)

## Production deployment

Pull request [#3](https://github.com/zephyriaa/zterminal/pull/3) was merged as commit `b6ebef0f4a3d912beeac54bd26ff44e4e4b4e51a` into `render-hosted-research-terminal`. Render deployed that commit under deployment `dep-da23u6dg1s2s73diu240` and reported **Your service is live** at `https://zterminal.onrender.com`. The production log confirms the Vite/Express build completed successfully and the service started on the assigned port. As with the prior release, Render logged that `OAUTH_SERVER_URL` is not configured; this leaves optional authenticated workspaces unavailable without affecting the public chart workspace.

## Public smoke test

The production workstation loaded verified QQQX/USDT market data with a 97-bar, 15-minute UTC coverage window and rendered the native candlestick, study, volume, and momentum panes. Browser DOM and visual inspection confirmed that the chart surface contains no `#tv-attr-logo` node. The only displayed TradingView attribution is the required external footer link, which contains the NOTICE text and points to `https://www.tradingview.com/`.
