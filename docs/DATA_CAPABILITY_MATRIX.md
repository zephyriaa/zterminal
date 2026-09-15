# Data Capability and Availability Matrix

This matrix prevents UI or strategy code from presenting unavailable data as an
empty but meaningful value. “Recordable” means only from the moment ZTerminal
has created a valid immutable manifest, unless a validated import says otherwise.

| Capability | Initial reality | Required source |
| --- | --- | --- |
| Standard indicators | Historical available | OHLCV |
| Bar volume profile | Historical approximate | OHLCV |
| Trade-accurate profile | Live / recordable | Executed trades |
| Big Trades, delta, CVD, footprint | Live / recordable | Aggressor-classified trades with price |
| Book/depth imbalance | Live / recordable | Snapshot plus contiguous deltas |
| Liquidity heatmap | Live / recordable | Reconstructable order book |
| Absorption/sweep | Derived estimate / recordable | Trades, optionally book state |
| Call/put walls | Live snapshot / recordable | Options instruments and OI |
| Gross gamma concentration | Live snapshot / recordable | OI, provider gamma, units, spot |
| Signed GEX / gamma flip | Explicit estimate only | Options snapshot + selected convention |
| Candle replay | Historical available | OHLCV |
| Order-flow replay/backtest | Recorded/imported only | Trade/depth event manifest |
| GEX replay/backtest | Recorded/imported only | Options snapshot manifest |

## Options/GEX v1 interpretation

Deribit BTC and ETH option instruments/snapshots are the initial source. A call
wall and put wall mean the strike with maximum open interest under the selected
filters. Gross gamma concentration uses provider gamma, OI, contract units, and
underlying price. It does not claim dealer positioning.

Signed GEX and gamma flip are disabled by default. Enabling them requires a
documented call-positive/put-negative heuristic and an `ESTIMATED` label in the
chart, inspector, strategy output, and report. No historical GEX period is
claimed before verified recording/import coverage exists.

## Required display provenance

Every derived order-flow or options layer displays its source, freshness,
granularity, integrity/gap state, and calculation version. Aggregate trades may
not be drawn as individual fills. A manifest gap makes a dependent calculation
unavailable rather than repaired, forward-filled, or silently ignored.
