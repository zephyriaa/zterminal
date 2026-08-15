# Design Verification

## 2026-08-15

The hosted ZTerminal research terminal was checked at **1448 × 1086** and **390 × 844**. The desktop view preserves the supplied reference image's chart-first hierarchy through a compact indigo primary navigation, instrument context band, left utility rail, layered chart controls, central analytical canvas, contextual sidebar, CVD strip, and compact status dock.

The mobile view suppresses nonessential instrumentation while retaining timeframe control, chart surface, indicator context, historical-data disclosure, and an explicit non-execution status. The utility rail becomes a bounded expandable control, avoiding horizontal overflow.

The display is intentionally labelled as a research preview. Decorative analytical marks are not presented as verified market data, and every unavailable or not-connected state is visibly disclosed.

## Public Snapshot Integration Check

The server-side `market.snapshot` endpoint was tested directly after moving the request to the hosted HTTP client. It returned a live Gate.io public payload with price, 24-hour high/low, quote volume, bid, and ask. The first two visual captures of the client still showed its initial connecting state, so the next verification step is to inspect the browser query lifecycle before treating the interface as verified-live.

The persistent-browser verification completed successfully. After the query settled, the chart instrument strip showed a Gate.io public price of 731.31, a 24-hour change of -0.42%, high of 734.73, low of 728.83, quote volume of 14.63M, and bid/ask/spread in the market-context panel. Unsupported open interest, depth, bars, tape, alerts, and execution remain explicitly unavailable or disabled.

The historical-bars verification also completed successfully. The chart canvas now renders provider-labelled Gate.io 15-minute public candle and volume data, and the context panel reports `Gate.io · 15m`. VWAP, EMA, order-flow range, CVD, depth, public tape, alerts, and execution continue to be visibly unavailable until their own source and calculation contracts are implemented.
