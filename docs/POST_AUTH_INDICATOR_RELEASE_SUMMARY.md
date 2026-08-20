# Post-Authentication Product Release Summary

**Prepared:** 2026-08-20  
**Branch:** `product/orderflow-research-terminal`  
**Release commit:** `1c176cc`  
**Production branch remains:** `render-hosted-research-terminal` at `2a739a2`

## Completed product work

ZTerminal now has a visible terminal account control rather than a decorative profile treatment. A guest sees a direct sign-in entry. A signed-in account sees verified session-backed identity display data, workspace context, account navigation, and secure logout. This visual control does not change the server-side Google identity or session-verification boundary.

The Research workspace is now **code-first**. A user needs only a successfully compiled closed ZS strategy source and a verified historical candle window to run a historical evaluation. The citation/protocol workflow remains available as an explicitly optional tab for research discipline; it is no longer required to backtest a strategy. The worker still interprets a closed AST only and does not execute JavaScript, access a network, persist source, or create orders.

The terminal received a restrained graphite refinement that flattens decorative chrome, improves research-panel hierarchy, and preserves the existing teal/violet base palette. The native catalog is integrated inside Indicator Lab and uses the same closed candle runtime as custom formulas.

| Area | Delivered result | Boundary retained |
|---|---|---|
| Account visibility | Guest/signed-in terminal control, workspace disclosure, account navigation, logout | Server-verified Google subject and HTTP-only session remain authoritative |
| Backtesting | Closed strategy code plus verified candles is sufficient | No JavaScript/Pine execution, network, broker, or automated action |
| Indicator catalog | 14 transparent native presets across trend, momentum, volatility, and price context | Loaded OHLCV only; bounded numeric inputs; no tape/depth/cross-symbol inputs |
| Formula vocabulary | SMA, EMA, WMA, RSI, standard deviation, highest/lowest, ROC, ATR, arithmetic helpers | Parser rejects dynamic execution, host APIs, imports, future bars, and unknown sources |
| User interface | Flattened graphite surfaces and clearer research-workflow states | Public-market research and execution-disabled disclosures remain visible |

## Indicator-library decision

TradingView’s Advanced Charts documentation explicitly states that Pine Script is not supported in its libraries and that end users cannot author or change indicator code there.[1] TradingView’s publishing guidance also requires per-script license review and applies platform-specific reuse rules.[2] Consequently, ZTerminal does **not** import, scrape, execute, or redistribute TradingView community Pine scripts.

Instead, ZTerminal implements transparent, independently authored formulas through its closed runtime. The catalog’s source/decision evidence is in [Indicator Research Sources](./INDICATOR_RESEARCH_SOURCES.md). TA-Lib was used only as a breadth reference for established indicator families, not as a browser dependency.[3]

## Validation evidence

| Gate | Result |
|---|---|
| TypeScript | `pnpm check` passed |
| Unit regression | `pnpm test` passed: **25 test files, 88 tests** |
| Production build | `pnpm build` passed |
| Safe-runtime catalog fixture | Every native preset compiled and evaluated on deterministic OHLCV fixtures |
| Local browser review | Guest terminal account entry visible; code-first Research drawer rendered; catalog rendered; SMA selected, validated, and added to a verified live local chart |
| Source control | Pushed to GitHub product branch at `1c176cc` |

## Release boundary

The direct Google sign-in and CSRF-refresh hotfix are already live in production at `2a739a2` / Render deployment `dep-da3e8ie7bikc739q8rgg`. The work described in this document is **not yet deployed**; it is staged and pushed on `product/orderflow-research-terminal`. Promotion to the Render production branch is deliberately left for explicit user authorization.

## References

[1]: https://www.tradingview.com/charting-library-docs/latest/custom_studies/ "TradingView Advanced Charts: Custom indicators"
[2]: https://www.tradingview.com/pine-script-docs/writing/publishing/ "TradingView Pine Script: Publishing scripts"
[3]: https://ta-lib.org/ "TA-Lib"
