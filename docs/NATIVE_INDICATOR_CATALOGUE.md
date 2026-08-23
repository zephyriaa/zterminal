# Native Indicator Catalogue

ZTerminal’s public chart library renders only deterministic calculations derived from the verified bar series already shown on the chart. It does not retrieve, copy, decompile, or execute third-party scripts. The initial native catalogue includes session VWAP, EMA, SMA, WMA, VWMA, Bollinger Bands, Donchian Channels, and observed exchange volume.

| Native study | Chart treatment | Input boundary |
| --- | --- | --- |
| EMA, SMA, WMA, VWMA | Price overlay | Verified close and, where applicable, verified bar volume |
| Session VWAP | Price overlay | Verified bar typical price and volume, reset at the selected chart timezone boundary |
| Bollinger Bands | Price overlay | SMA plus population standard deviation over the configured lookback |
| Donchian Channels | Price overlay | Rolling verified high and low values |
| Volume | Lower chart pane | Verified exchange-reported bar volume |

The catalogue is deliberately limited to the studies implemented and testable in the public TypeScript renderer. TA-Lib groups the same families under overlap, volatility, and volume functions, while StockCharts describes Bollinger Bands and Donchian Channels as price overlays. TradingView’s charting documentation also distinguishes built-in indicators from custom studies and notes that Pine Script is not supported directly in charting libraries.[1] [2] [3]

Python-authored and Pine-review artifacts remain separate. They require the dedicated validated Python API, isolated worker, PostgreSQL queue, and Rust engine before any execution or result can be enabled. The public release must continue to return an explicit unavailable state until those systems are provisioned.

## References

[1]: https://ta-lib.org/functions/ "TA-Lib function catalogue"
[2]: https://chartschool.stockcharts.com/table-of-contents/technical-indicators-and-overlays "StockCharts technical indicators and overlays"
[3]: https://www.tradingview.com/charting-library-docs/latest/ui_elements/indicators/ "TradingView Charting Library indicator documentation"
