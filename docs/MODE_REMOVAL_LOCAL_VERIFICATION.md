# Mode-Removal Local Verification

**Verified:** 2026-08-21

The local `/terminal` route was reviewed after restoring the pre-mode baseline (`c513b89`) for the terminal shell, styling, Strategy Tester drawer, and preference contracts.

The interface is a single compact chart-first workspace. The header contains the ZTerminal mark, market search, timeframes, **Indicators**, **Strategy Tester**, data/provider status, and account access. It does not display **Focus**, **Canvas**, or **Research** workspace controls. The terminal presents the verified Gate.io BTC/USDT chart as the central surface, with the Market and Flow Pulse panels retained as intentional overlays, not workspace modes.

Native studies remain rendered in the chart context, including VWAP, EMA 20/50, volume profile, structure, flow pulse, UTC session volume, and large tape prints. The order-flow and data-contract surfaces remain source-labelled and research-only.

The visual inspection found no mode-switcher UI, persistent Layers column, mode-specific layout cards, or lower Context Deck.

The automatic PWA update registration is deliberately outside this restoration and must remain in `client/src/main.tsx`.

## Overlay verification

The compact **Indicators** header button opens a right-side overlay titled **Indicators**. The overlay exposes Built-ins, Favorites, My indicators, and Data-gated tabs; searchable categories; and verified native studies including moving averages, VWAP, RSI, MACD, Stochastic, ATR, Bollinger Bands, volume studies, and session range. This confirms the indicator catalogue remains functional without a workspace mode or persistent Layers column.

The compact **Strategy Tester** header button opens a right-side historical strategy-testing overlay, not a workspace switch. The overlay provides Strategy, Properties, Overview, Trades, and optional Protocol tabs; a closed ZS strategy source editor; compilation; and a **Run on verified window** action. It explicitly reports the loaded verified-bar count and next-bar-open fill convention, while retaining the no-execution boundary.

The supplied EMA crossover starter compiled successfully as a closed AST and completed an historical evaluation over the 366-bar verified Gate.io BTC/USDT 1d window. The resulting overlay produced a reproducibility contract, equity curve, summary metrics, trade count, and run/hash identifiers while retaining the explicit no-order-routing boundary.
