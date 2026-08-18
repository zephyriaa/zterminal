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
