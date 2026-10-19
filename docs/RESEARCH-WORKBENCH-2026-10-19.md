# Python workbench repair and execution assumptions

The connected Helper did not imply a runnable strategy: Run also required market metadata, and a failed edge request left the button disabled without exposing the reason. Run now prepares/retries the exact selected market, with visible metadata and history failures. Old Helpers retain an explicitly labeled basic mode; advanced features require Helper 1.2.

## Implemented

- Non-executing Python AST inspection discovers literal CONFIG, SDK PARAMETERS and params access. Defaults become typed controls; only declared numeric bounds become sliders. Required values have no invented default. Overrides affect top-level CONFIG before strategy execution.
- Supported indicator windows resolve a conservative pre-roll. Exponential seed residual targets 1e-6. Pre-roll remains archived but cannot trade or contribute to scored returns/exposure. Unresolved windows require a manual minimum. History must cover the exact selected dates; provider retention errors never silently shorten or substitute the market.
- Market fills use adverse ticks, contract multipliers, minimum size/notional, explicit taker fees and either fixed friction or prior ATR/volume square-root impact. Participation choices cap entries at 0.1%, 1%, or 5% of prior 20-bar mean volume. Exits remain uncapped. The coefficient is a recorded scenario, not calibrated depth reconstruction.
- Gate fees/units are captured from public contract metadata. Binance retail/VIP 9 presets disclose reference assumptions rather than verified current account tiers. Historical funding is optional and captured with a hashed settlement schedule. Missing schedules fail explicitly. Gate marks use the last completed candle as a proxy; Binance uses settlement marks. Settlements inside the last candle are included.
- Compilation blocks known future shifts, centered windows, backfills and forward positional indexing with source locations. Sampled prefix checks provide an additional runtime screen. Automatic background health runs three chronological folds plus 500 seeded resampled paths without consuming the reserved final 20%. Sparse results remain insufficient; scores are heuristic, not calibrated overfitting probabilities.

## Verification

A browser run paired the packaged Windows Helper, discovered fast/slow inputs, fetched 2,369 real Gate BTC_USDT hourly candles (2,160 selected plus 209 pre-roll), completed the report and automatic health analysis. The report retained the selected scored start and final holdout. Narrow dock testing exposed and fixed a viewport-versus-container layout issue. The user's production drafts and original dirty checkout were preserved; browser testing used a separate origin and disposable Helper archive.

Automated coverage includes metadata retry, exact dataset identity, pre-roll and holdout boundaries, parameter compilation, causal fills, funding signs/timing, archive reconciliation, immutable background analysis and existing Helper process limits. Test counts and publication evidence are recorded in the task's local artifacts directory.

## Deliberate limits

Coinbase remains unavailable because this workbench currently supports Gate/Binance USDT perpetual candle datasets. Current captured units/fees do not establish historical rule changes. No leverage, liquidation, limit orders or millisecond book simulation is implied. Arbitrary trusted Python is neither securely sandboxed nor provably causal; unknown prior experiments, survivorship and selection bias cannot be certified from one script. Automatic checks do not consume the final holdout.

## Industry references

- [TradingView strategy properties](https://www.tradingview.com/support/solutions/43000628599-strategy-properties/) informed the explicit capital, sizing, friction and fill-timing controls.
- [MultiCharts walk-forward analysis](https://www.multicharts.com/features/walk-forward/) informed chronological validation, with diagnostics disclosed separately from the immutable base result.
- [Coinbase Advanced fees](https://help.coinbase.com/en/coinbase/trading-and-funding/advanced-trade/advanced-trade-fees) require actual product/account rules; the UI does not invent them.
- [Gate futures API](https://www.gate.com/docs/developers/apiv4/en/futures/) supplies actual contract metadata, candles and recorded funding.
- [Binance's dated VIP announcement](https://www.binance.com/en/support/announcement/detail/88ee9834fef947de96e01b77e888414e) is not evidence of a user's current account tier; presets are scenarios.
