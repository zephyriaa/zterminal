# OF2 Order-Flow Context Contract

**Status:** Product-branch implementation contract
**Purpose:** Expose additional professional context while preserving the difference between verified historical candles and current bounded public tape.

## UTC Session Candle-Volume Context

`calculateUtcSessionVolumeProfile()` selects the latest UTC calendar-day segment from the currently loaded verified OHLCV candles. It groups a full candle’s reported volume into the price bin containing that candle’s **close**, then returns session-local POC, VAH, VAL, bins, bounds, count, and a fixed source identifier:

```text
UTC_SESSION_CANDLE_CLOSE_VOLUME
```

| Property | Meaning | It does not mean |
|---|---|---|
| POC | Highest reported candle-volume bin in the latest loaded UTC day. | Exchange tick-volume-at-price POC. |
| VAH / VAL | Bin boundaries that cover the configured 70% of reported session candle volume. | A traded-value distribution reconstructed from intrabar prints. |
| UTC session | `00:00:00.000Z` through the following UTC midnight. | User-local, exchange-local, or an arbitrary trading session. |
| Candle count | Valid loaded bars within the UTC day. | Completeness beyond the supplied historical coverage contract. |

A profile is `null` when the data cannot produce a valid non-flat distribution. The UI must withhold it rather than carrying a prior value forward or inventing a tick-level representation.

## Selected-Venue Large Tape Prints

`findLargeTapePrints()` consumes only the currently selected provider’s current bounded normalized public tape. It orders/deduplicates by exchange trade ID, filters on the absolute **reported contract size**, and returns venue, symbol, trade ID, time, price, reported size, exchange-reported taker side, and the active threshold.

| Property | Contract |
|---|---|
| Threshold | Positive finite **reported-size** threshold chosen by the user in the local interface. |
| Side | `BUY` or `SELL` only from the exchange-reported signed size; never inferred from price movement. |
| Scope | Selected venue, selected symbol, current bounded tape buffer only. |
| Withholding | No print rows render unless that selected tape is `LIVE`. |
| Notional | No USD or “$10K” notional claim; multipliers/settlement conventions are not normalized across providers. |

> Large-print evidence is descriptive current market data, not a signal, alert, order, position, execution route, or evidence of an institutional participant.
