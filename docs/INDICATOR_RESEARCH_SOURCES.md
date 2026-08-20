# Indicator Research Source Ledger

**Research date:** 2026-08-20

## TradingView integration boundary

| Source | Verified finding | Product consequence |
| --- | --- | --- |
| [TradingView Advanced Charts — Custom indicators](https://www.tradingview.com/charting-library-docs/latest/custom_studies/) | TradingView’s Advanced Charts custom-study API supports custom indicators, but Pine Script is not supported in the libraries. | Do not promise a native Pine runtime or direct community-indicator import. Custom studies are a separately authored JavaScript integration path, not an import mechanism for Pine. |
| [TradingView Advanced Charts FAQ](https://www.tradingview.com/charting-library-docs/latest/resources/Frequently-Asked-Questions/) | The FAQ likewise states Pine Script is not supported in Advanced Charts or Trading Platform and directs users to custom JavaScript indicators. | ZTerminal should keep its closed, browser-safe indicator/strategy runtime rather than add an arbitrary script executor. |
| [TradingView Pine Script — Publishing scripts](https://www.tradingview.com/pine-script-docs/writing/publishing/) | TradingView publication documentation notes that open-source scripts use Mozilla Public License 2.0 by default, while authors may specify an alternative license. | A public TradingView listing does not give a blanket right to scrape, republish, or bulk-port community work. Any individually considered script requires author/license review and attribution. |
| [TradingView Lightweight Charts](https://www.tradingview.com/lightweight-charts/) | Lightweight Charts is a chart-rendering library; it is not the TradingView community-script catalog. | Preserve existing attribution and build native calculated studies on top of ZTerminal’s own candle data and render surfaces. |
| [Lightweight Charts plugin examples](https://tradingview.github.io/lightweight-charts/plugin-examples/) | The project documents plugin/primitive examples, including indicator-style visualizations. | Use as rendering-pattern reference only; formulas and output must be independently implemented/tested in ZTerminal. |

## Candidate formula-primitives survey

| Candidate | Initial research signal | Required audit before adoption |
| --- | --- | --- |
| [trading-signals](https://www.npmjs.com/package/trading-signals) | Published as a TypeScript technical-indicator library with an MIT license according to its package listing. | Pin version; inspect license and repository; validate formulas against golden vectors; measure browser bundle/real-time behavior; use only formula primitives, never a strategy/execution layer. |
| [technicalindicators](https://github.com/anandanand84/technicalindicators) | TypeScript/JavaScript indicator project that states it includes technical indicators and pattern recognition. | Verify current license, maintenance, browser compatibility, numerical behavior, and exact formula alignment before use. |
| [TA-Lib](https://ta-lib.org/) | A C/C++ technical-analysis library catalog with many indicators. | Useful as an external formula/catalog reference, but not the preferred in-browser dependency due native/runtime integration costs. |

## Current conclusion

ZTerminal should build a **native, source-attributed indicator catalog** with declarative metadata, parameter bounds, warm-up requirements, trusted OHLCV inputs, and golden-vector tests. It must not fetch, execute, or redistribute TradingView Pine/community scripts. Future support for user-supplied references may guide an explicit manual conversion into the closed ZS/indicator grammar but must retain author/license disclosure and reject protected/invite-only or unclear-license sources.

## Direct documentation review evidence

TradingView’s official Advanced Charts custom-indicator page was reviewed directly on 2026-08-20. It states that its Advanced Charts and Trading Platform products support more than 100 indicators and permit **developer-authored JavaScript custom indicators** through a `custom_indicators_getter` interface. The same page states that end users cannot create or change existing indicator code in that UI and explicitly says: “Pine Script® is not supported in the libraries.” This confirms that neither a Lightweight Charts integration nor a hypothetical Advanced Charts integration provides a supported route to import or run TradingView community Pine studies. ZTerminal will retain a closed native indicator/runtime model and avoid a Pine execution surface.

Source: [TradingView Advanced Charts — Custom indicators](https://www.tradingview.com/charting-library-docs/latest/custom_studies/).

The TradingView Pine Script publishing documentation was reviewed directly on 2026-08-20. It says that open-source scripts use MPL 2.0 by default but authors can specify alternative licenses in source code. It also says that TradingView’s script-publishing rules govern reuse of code from open-source scripts and take precedence over open-source-license provisions for publication on that platform. ZTerminal therefore will not bulk-import, scrape, execute, or republish community Pine scripts. Any future individual conversion reference requires inspection of the exact source license, author attribution, and an independently authored safe ZTerminal implementation; protected and invite-only scripts remain excluded.

Source: [TradingView Pine Script — Publishing scripts](https://www.tradingview.com/pine-script-docs/writing/publishing/).

The `anandanand84/technicalindicators` repository was reviewed directly on 2026-08-20. GitHub describes it as JavaScript technical indicators written in TypeScript with browser pattern recognition and shows an MIT license. The visible repository history is materially older than the current ZTerminal stack, so it is not being added as a blind production dependency. It remains a formula/reference candidate only; ZTerminal’s initial catalog will use independently tested native implementations with explicit warm-up and input contracts.

Source: [anandanand84/technicalindicators](https://github.com/anandanand84/technicalindicators).

TA-Lib’s official site was reviewed directly on 2026-08-20 as an independent indicator-catalog reference. It identifies approximately 200 indicators, including ADX, MACD, RSI, Stochastic, and Bollinger Bands, and says its core is C/C++ under a BSD license. ZTerminal will not ship TA-Lib in the browser because the current product is a TypeScript/browser-first application; the catalog instead uses formula-level, independently tested, dependency-free native implementations. TA-Lib is retained as a scope/reference source for future indicator-family prioritization.

Source: [TA-Lib](https://ta-lib.org/).
