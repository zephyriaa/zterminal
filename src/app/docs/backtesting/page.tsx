import type { Metadata } from "next";
import Link from "next/link";
import styles from "../docs.module.css";

export const metadata: Metadata = {
  title: "AI Strategy & Backtesting Guide — ZTerminal Documentation",
  description:
    "Complete guide for writing Python trading strategies with AI (ChatGPT, Claude, Cursor) and configuring deterministic, look-ahead-free backtests in ZTerminal.",
};

function Arrow() {
  return <span className={styles.arrow} aria-hidden="true">↗</span>;
}

const AI_SYSTEM_PROMPT = `You are an expert quantitative developer writing trading strategies for ZTerminal.
Always adhere strictly to the following ZTerminal Python Research SDK specifications:

1. ENVIRONMENT & IMPORTS:
   - Runtime: CPython 3.12 with pandas, numpy, and vectorbt.
   - Import the SDK: import zterminal as zt
   - Standard data tools: import pandas as pd, import numpy as np

2. FUNCTION SIGNATURE:
   - Every strategy must declare: def strategy(data, params):
   - data is a pandas DataFrame with UTC DatetimeIndex and float64 columns: ['open', 'high', 'low', 'close', 'volume'].
   - params is a flat dictionary of strategy parameters passed from the ZTerminal UI (e.g. params.get("fast", 9)).

3. RETURN OBJECT:
   - Return an instance of zt.Strategy:
     return zt.Strategy(
         entries=entries_series,         # Aligned boolean pd.Series (Long entries)
         exits=exits_series,             # Aligned boolean pd.Series (Long exits)
         short_entries=short_entries,   # Optional: Aligned boolean pd.Series (Short entries)
         short_exits=short_exits,       # Optional: Aligned boolean pd.Series (Short exits)
         plots={"Plot Name": series}    # Optional: Dict of aligned numeric pd.Series for chart overlay
     )

4. SIGNAL INTEGRITY & ALIGNMENT (CRITICAL):
   - All signal series (entries, exits, short_entries, short_exits) MUST match data.index exactly.
   - Signals MUST be boolean (True/False) with NO missing values (NaNs). Always use .fillna(False).
   - Plots can contain numeric floats with warm-up NaNs, but never infinity (inf).

5. ANTI-LOOKAHEAD RULES (ZERO FUTURE LEAKAGE):
   - Signals evaluated on completed bar close i are executed by ZTerminal at bar open i+1.
   - When calculating breakout channels, rolling highs, or rolling lows, NEVER use current bar's close/high/low without shifting.
   - CORRECT: upper = data.high.shift(1).rolling(20).max()
   - INCORRECT (look-ahead): upper = data.high.rolling(20).max()

6. EXECUTION CONSTRAINTS:
   - Market orders only. Limit, stop, and bracket orders are not accepted in the boolean signal engine.
   - Single synthetic unlevered position at a time (no pyramiding). Subsequent entry signals while already in a position are ignored.
   - Opposite entry signals trigger position exit or reversal.

7. COMPANION JSON PARAMETERS:
   - Always output a valid, flat JSON object companion that users can paste into ZTerminal's "Strategy parameters" field.
   - Example: {"fast": 9, "slow": 21, "rsi_period": 14}`;

const EMA_CROSS_STRATEGY = `# Trend-Following EMA Crossover with Volume Confirmation
# Designed for ZTerminal Python Research SDK v1.0
import zterminal as zt
import pandas as pd

def strategy(data, params):
    # 1. Extract and cast parameters with defaults
    fast_period = int(params.get("fast_period", 12))
    slow_period = int(params.get("slow_period", 26))
    vol_period = int(params.get("vol_period", 20))
    vol_mult = float(params.get("vol_mult", 1.2))

    # 2. Compute indicators
    fast_ema = zt.ema(data.close, fast_period)
    slow_ema = zt.ema(data.close, slow_period)
    avg_vol = zt.sma(data.volume, vol_period)

    # 3. Formulate signal conditions
    # Completed bar close volume exceeds moving average by multiplier
    volume_confirmed = data.volume > (avg_vol * vol_mult)
    
    # Fast EMA crosses above Slow EMA with volume confirmation
    raw_entries = zt.crossover(fast_ema, slow_ema) & volume_confirmed
    # Exit when Fast EMA crosses back below Slow EMA
    raw_exits = zt.crossunder(fast_ema, slow_ema)

    # 4. Clean signals: strictly boolean, zero NaNs
    entries = raw_entries.fillna(False).astype(bool)
    exits = raw_exits.fillna(False).astype(bool)

    # 5. Return strategy with indicator overlays
    return zt.Strategy(
        entries=entries,
        exits=exits,
        plots={
            f"Fast EMA ({fast_period})": fast_ema,
            f"Slow EMA ({slow_period})": slow_ema,
            f"Avg Volume ({vol_period})": avg_vol,
        },
    )`;

const EMA_CROSS_JSON = `{
  "fast_period": 12,
  "slow_period": 26,
  "vol_period": 20,
  "vol_mult": 1.2
}`;

const MEAN_REVERSION_STRATEGY = `# Mean-Reversion RSI + Bollinger Bands (Long & Short)
# Designed for ZTerminal Python Research SDK v1.0
import zterminal as zt
import pandas as pd

def strategy(data, params):
    # 1. Strategy parameters
    bb_period = int(params.get("bb_period", 20))
    bb_std = float(params.get("bb_std", 2.0))
    rsi_period = int(params.get("rsi_period", 14))
    rsi_oversold = float(params.get("rsi_oversold", 30))
    rsi_overbought = float(params.get("rsi_overbought", 70))

    # 2. Bollinger Bands (computed on prior completed bars)
    basis = zt.sma(data.close, bb_period)
    dev = data.close.rolling(bb_period).std()
    upper_band = basis + (dev * bb_std)
    lower_band = basis - (dev * bb_std)

    # 3. RSI indicator
    rsi = zt.rsi(data.close, rsi_period)

    # 4. Long signals: Price closes below lower band and RSI is oversold
    raw_long_entries = (data.close < lower_band) & (rsi < rsi_oversold)
    # Long exit: Price reverts above middle basis band or RSI exceeds 50
    raw_long_exits = (data.close >= basis) | (rsi >= 50)

    # 5. Short signals: Price closes above upper band and RSI is overbought
    raw_short_entries = (data.close > upper_band) & (rsi > rsi_overbought)
    # Short exit: Price reverts below middle basis band or RSI drops under 50
    raw_short_exits = (data.close <= basis) | (rsi <= 50)

    return zt.Strategy(
        entries=raw_long_entries.fillna(False).astype(bool),
        exits=raw_long_exits.fillna(False).astype(bool),
        short_entries=raw_short_entries.fillna(False).astype(bool),
        short_exits=raw_short_exits.fillna(False).astype(bool),
        plots={
            "BB Upper": upper_band,
            "BB Basis": basis,
            "BB Lower": lower_band,
            "RSI": rsi,
        },
    )`;

const MEAN_REVERSION_JSON = `{
  "bb_period": 20,
  "bb_std": 2.0,
  "rsi_period": 14,
  "rsi_oversold": 30,
  "rsi_overbought": 70
}`;

const BREAKOUT_STRATEGY = `# Anti-Lookahead Donchian Breakout Channel with ATR Trailing Filter
# Designed for ZTerminal Python Research SDK v1.0
import zterminal as zt
import pandas as pd
import numpy as np

def strategy(data, params):
    lookback = int(params.get("lookback", 20))
    exit_lookback = int(params.get("exit_lookback", 10))

    # IMPORTANT: Anti-lookahead discipline.
    # We must shift(1) so the current bar is compared against PRIOR completed highs/lows.
    upper_channel = data.high.shift(1).rolling(lookback).max()
    lower_channel = data.low.shift(1).rolling(exit_lookback).min()

    # Enter Long when bar close breaks out above prior 20-bar high
    raw_entries = data.close > upper_channel
    # Exit Long when bar close falls below prior 10-bar low
    raw_exits = data.close < lower_channel

    return zt.Strategy(
        entries=raw_entries.fillna(False).astype(bool),
        exits=raw_exits.fillna(False).astype(bool),
        plots={
            f"Prior {lookback}-Bar High": upper_channel,
            f"Prior {exit_lookback}-Bar Low": lower_channel,
        },
    )`;

const BREAKOUT_JSON = `{
  "lookback": 20,
  "exit_lookback": 10
}`;

export default function BacktestingAIGuidePage() {
  return (
    <article className={styles.docArticle}>
      <Link href="/docs" className={styles.backLink}>← Documentation index</Link>

      <p className={styles.eyebrow}>AI &amp; STRATEGY ENGINEERING</p>
      <h1 className={styles.docTitle}>
        Backtesting &amp; AI Strategy Guide{" "}
        <em>Code with AI → Configure → Backtest locally.</em>
      </h1>
      <p className={styles.docLead}>
        ZTerminal combines standard CPython 3.12 execution, strict anti-lookahead rules (<code>synthetic_next_open_v2</code>), and cryptographic reproducibility. This guide shows you how to instruct your AI assistant (ChatGPT, Claude, Cursor, Copilot, or local models) to write production-grade Python strategies and configure realistic backtests in seconds.
      </p>

      {/* CORE ARCHITECTURE */}
      <section data-public-reveal="content" className={styles.docSection}>
        <h2 className={styles.sectionTitle}>1. How ZTerminal Backtesting Works</h2>
        <p className={styles.sectionPara}>
          Before prompting an AI to generate code, it is critical to understand ZTerminal&apos;s architectural boundaries:
        </p>

        <ul className={styles.bulletList}>
          <li>
            <strong>Local Helper Execution:</strong> Your Python strategy runs locally on your workstation via the ZTerminal Research Helper. Proprietary strategy code, model weights, and custom parameters never leave your machine or touch a cloud server.
          </li>
          <li>
            <strong>Next-Bar-Open Execution Model:</strong> A signal generated at completed bar close <code>bar[i]</code> fills at the following bar&apos;s open price <code>bar[i+1].open</code>. You cannot trade on the bar that produced the signal.
          </li>
          <li>
            <strong>Market Orders &amp; Single Unlevered Position:</strong> The strategy engine processes market fills with direction-aware slippage and fees. Sizing is single-position unlevered (long or short). Pyramiding is disallowed: signals received while holding a position are ignored until an exit or reversal fires.
          </li>
          <li>
            <strong>Cryptographic Audit Guarantee:</strong> Every run hashes its source code, parameters, observed dataset, and trades with SHA-256 and commits them to a local SQLite database (<code>%LOCALAPPDATA%\ZTerminal\ResearchPreview\research.sqlite3</code>). Results are permanently reproducible.
          </li>
          <li>
            <strong>20% Out-of-Sample Holdout Discipline:</strong> By default, ZTerminal reserves the final 20% of your chosen date range before Python runs. This ensures you always have untouched forward data for unbiased validation.
          </li>
        </ul>
      </section>

      {/* AI SYSTEM PROMPT */}
      <section data-public-reveal="content" className={styles.docSection}>
        <h2 className={styles.sectionTitle}>2. Universal AI System Prompt (Copy &amp; Paste)</h2>
        <p className={styles.sectionPara}>
          Copy and paste the prompt below into your AI assistant. You can use it as <strong>Custom Instructions</strong> in ChatGPT, a <strong>System Prompt</strong> in Claude Projects, or save it inside a <code>.cursorrules</code> file in your IDE.
        </p>

        <div className={styles.codeContainer}>
          <div className={styles.codeBar}>
            <span>ZTERMINAL_AI_SYSTEM_PROMPT.md</span>
            <span>SYSTEM INSTRUCTIONS FOR LLMS</span>
          </div>
          <pre className={styles.codeSnippet}>
            <code>{AI_SYSTEM_PROMPT}</code>
          </pre>
        </div>

        <div className={styles.callout}>
          <strong>Tip for AI Chats:</strong> After pasting this system prompt, simply state your strategy idea in natural language (e.g., <em>&ldquo;Write a 1-hour BTC momentum breakout strategy using a 20-bar Donchian channel with 1.5x ATR trailing stop and volume filter&rdquo;</em>).
        </div>
      </section>

      {/* PYTHON SDK SPECIFICATION */}
      <section data-public-reveal="content" className={styles.docSection}>
        <h2 className={styles.sectionTitle}>3. Python Strategy SDK Reference</h2>
        <p className={styles.sectionPara}>
          Every strategy must implement a top-level <code>strategy(data, params)</code> function returning <code>zt.Strategy</code>.
        </p>

        <div className={styles.tableContainer}>
          <table className={styles.docTable}>
            <thead>
              <tr>
                <th>Component</th>
                <th>Type</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><code>data.open</code></td>
                <td><code>pd.Series (float64)</code></td>
                <td>Candle open prices indexed by UTC timestamp.</td>
              </tr>
              <tr>
                <td><code>data.high</code></td>
                <td><code>pd.Series (float64)</code></td>
                <td>Candle high prices. Must be shifted by <code>.shift(1)</code> for prior breakouts.</td>
              </tr>
              <tr>
                <td><code>data.low</code></td>
                <td><code>pd.Series (float64)</code></td>
                <td>Candle low prices. Must be shifted by <code>.shift(1)</code> for prior breakouts.</td>
              </tr>
              <tr>
                <td><code>data.close</code></td>
                <td><code>pd.Series (float64)</code></td>
                <td>Completed candle close prices. Used for indicator calculation.</td>
              </tr>
              <tr>
                <td><code>data.volume</code></td>
                <td><code>pd.Series (float64)</code></td>
                <td>Trading volume observed during the candle interval.</td>
              </tr>
              <tr>
                <td><code>params</code></td>
                <td><code>dict</code></td>
                <td>User-configurable values from the UI. Access via <code>params.get(&quot;key&quot;, default)</code>.</td>
              </tr>
              <tr>
                <td><code>entries</code></td>
                <td><code>pd.Series (bool)</code></td>
                <td>Long entry signals. Must be boolean without NaNs (use <code>.fillna(False)</code>).</td>
              </tr>
              <tr>
                <td><code>exits</code></td>
                <td><code>pd.Series (bool)</code></td>
                <td>Long exit signals. Must be boolean without NaNs.</td>
              </tr>
              <tr>
                <td><code>short_entries</code></td>
                <td><code>pd.Series (bool) | None</code></td>
                <td>Optional short entry signals for two-sided strategies.</td>
              </tr>
              <tr>
                <td><code>short_exits</code></td>
                <td><code>pd.Series (bool) | None</code></td>
                <td>Optional short exit signals for two-sided strategies.</td>
              </tr>
              <tr>
                <td><code>plots</code></td>
                <td><code>dict[str, pd.Series]</code></td>
                <td>Named indicator curves displayed on the terminal chart overlay.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h3 className={styles.sectionTitle}>Built-In Indicators in <code>zt</code></h3>
        <p className={styles.sectionPara}>
          ZTerminal provides optimized, vectorized indicators out-of-the-box:
        </p>
        <ul className={styles.bulletList}>
          <li><code>zt.sma(series, period=20)</code>: Simple Moving Average.</li>
          <li><code>zt.ema(series, period=20)</code>: Exponential Moving Average.</li>
          <li><code>zt.rsi(series, period=14)</code>: Relative Strength Index (0 to 100).</li>
          <li><code>zt.crossover(series_a, series_b)</code>: True when series_a crosses above series_b.</li>
          <li><code>zt.crossunder(series_a, series_b)</code>: True when series_a crosses below series_b.</li>
        </ul>
        <p className={styles.sectionPara}>
          You can also import and use standard <code>pandas</code>, <code>numpy</code>, and <code>vectorbt</code> functions directly in your strategy file.
        </p>
      </section>

      {/* BACKTEST SETTINGS REFERENCE */}
      <section data-public-reveal="content" className={styles.docSection}>
        <h2 className={styles.sectionTitle}>4. Backtest Settings &amp; Execution Configuration</h2>
        <p className={styles.sectionPara}>
          In the ZTerminal workbench, expand the <strong>Dataset &amp; capital</strong> and <strong>Advanced / execution assumptions</strong> panels to configure your backtest. Have your AI generate the exact JSON parameters that match your strategy logic.
        </p>

        <div className={styles.tableContainer}>
          <table className={styles.docTable}>
            <thead>
              <tr>
                <th>Setting</th>
                <th>Default</th>
                <th>Recommended</th>
                <th>Explanation</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Provider</strong></td>
                <td><code>gateio</code></td>
                <td><code>gateio</code> or <code>binance</code></td>
                <td>Market data provider for high-resolution perpetual futures candles.</td>
              </tr>
              <tr>
                <td><strong>Native Symbol</strong></td>
                <td><code>BTC_USDT</code></td>
                <td><code>BTC_USDT</code> (Gate) / <code>BTCUSDT</code> (Binance)</td>
                <td>Exchange contract pair. Units and ticks are auto-verified.</td>
              </tr>
              <tr>
                <td><strong>Timeframe</strong></td>
                <td><code>1h</code></td>
                <td><code>15m</code>, <code>1h</code>, <code>4h</code>, <code>1d</code></td>
                <td>Bar interval. Higher timeframes suffer less from spread and noise.</td>
              </tr>
              <tr>
                <td><strong>Initial Capital</strong></td>
                <td><code>10,000</code></td>
                <td><code>10,000</code></td>
                <td>Starting balance in quote currency (USDT).</td>
              </tr>
              <tr>
                <td><strong>Date Range</strong></td>
                <td>90 days</td>
                <td>90 to 730 days</td>
                <td>Historical test window. Must encompass multiple market regimes.</td>
              </tr>
              <tr>
                <td><strong>Fees (bps)</strong></td>
                <td><code>10</code></td>
                <td><code>5</code> to <code>10</code></td>
                <td>Exchange taker commission in basis points (10 bps = 0.10% per fill).</td>
              </tr>
              <tr>
                <td><strong>Slippage (bps)</strong></td>
                <td><code>5</code></td>
                <td><code>3</code> to <code>10</code></td>
                <td>Execution slippage in basis points applied adversely to fill price.</td>
              </tr>
              <tr>
                <td><strong>Spread (bps)</strong></td>
                <td><code>0</code></td>
                <td><code>1</code> to <code>3</code></td>
                <td>Half the bid/ask spread applied on entry and exit.</td>
              </tr>
              <tr>
                <td><strong>Cash Allocation</strong></td>
                <td><code>0.10</code></td>
                <td><code>0.10</code> to <code>0.50</code></td>
                <td>Fraction of current equity allocated per position (0.1 = 10%).</td>
              </tr>
              <tr>
                <td><strong>Warm-up Bars</strong></td>
                <td><code>0</code></td>
                <td><code>50</code></td>
                <td>Initial bars suppressed while moving averages and indicators stabilize.</td>
              </tr>
              <tr>
                <td><strong>Execution Delay</strong></td>
                <td><code>1</code></td>
                <td><code>1</code></td>
                <td>Bars between signal generation and fill (1 = fill at next bar open).</td>
              </tr>
              <tr>
                <td><strong>Reserve Holdout</strong></td>
                <td><code>true</code></td>
                <td><code>true</code></td>
                <td>Reserves the final 20% of data untouched for forward evaluation.</td>
              </tr>
              <tr>
                <td><strong>Direction</strong></td>
                <td><code>Long only</code></td>
                <td><code>Long only</code> or <code>Both</code></td>
                <td>Restricts trades to long-only or permits synthetic shorting.</td>
              </tr>
              <tr>
                <td><strong>Strategy Seed</strong></td>
                <td><code>42</code></td>
                <td><code>42</code></td>
                <td>Integer seed ensuring 100% deterministic pseudo-random processes.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* STRATEGY BLUEPRINTS */}
      <section data-public-reveal="content" className={styles.docSection}>
        <h2 className={styles.sectionTitle}>5. Battle-Tested Strategy Blueprints</h2>
        <p className={styles.sectionPara}>
          Below are three complete, production-ready templates you can copy directly into the ZTerminal editor or use as prompt few-shot examples for your AI.
        </p>

        {/* BLUEPRINT 1 */}
        <h3 className={styles.sectionTitle}>Blueprint A: Trend-Following Dual EMA with Volume Filter</h3>
        <p className={styles.sectionPara}>
          Enters when a fast exponential moving average crosses above a slow EMA, backed by an expansion in volume.
        </p>

        <div className={styles.codeContainer}>
          <div className={styles.codeBar}>
            <span>ema_cross_volume.py</span>
            <span>STRATEGY CODE</span>
          </div>
          <pre className={styles.codeSnippet}>
            <code>{EMA_CROSS_STRATEGY}</code>
          </pre>
        </div>

        <div className={styles.codeContainer}>
          <div className={styles.codeBar}>
            <span>params.json</span>
            <span>UI PARAMETERS CONFIG</span>
          </div>
          <pre className={styles.codeSnippet}>
            <code>{EMA_CROSS_JSON}</code>
          </pre>
        </div>

        {/* BLUEPRINT 2 */}
        <h3 className={styles.sectionTitle}>Blueprint B: Mean-Reversion RSI &amp; Bollinger Bands (Long &amp; Short)</h3>
        <p className={styles.sectionPara}>
          Fades extreme price deviations outside Bollinger Bands when RSI confirms oversold or overbought conditions. Exits when price returns to the mean basis line.
        </p>

        <div className={styles.codeContainer}>
          <div className={styles.codeBar}>
            <span>mean_reversion_bb_rsi.py</span>
            <span>STRATEGY CODE</span>
          </div>
          <pre className={styles.codeSnippet}>
            <code>{MEAN_REVERSION_STRATEGY}</code>
          </pre>
        </div>

        <div className={styles.codeContainer}>
          <div className={styles.codeBar}>
            <span>params.json</span>
            <span>UI PARAMETERS CONFIG</span>
          </div>
          <pre className={styles.codeSnippet}>
            <code>{MEAN_REVERSION_JSON}</code>
          </pre>
        </div>

        {/* BLUEPRINT 3 */}
        <h3 className={styles.sectionTitle}>Blueprint C: Anti-Lookahead Donchian Breakout</h3>
        <p className={styles.sectionPara}>
          Buys new 20-bar highs and sells when price breaks below a 10-bar low. Demonstrates the mandatory use of <code>.shift(1)</code> to prevent look-ahead contamination.
        </p>

        <div className={styles.codeContainer}>
          <div className={styles.codeBar}>
            <span>donchian_breakout.py</span>
            <span>STRATEGY CODE</span>
          </div>
          <pre className={styles.codeSnippet}>
            <code>{BREAKOUT_STRATEGY}</code>
          </pre>
        </div>

        <div className={styles.codeContainer}>
          <div className={styles.codeBar}>
            <span>params.json</span>
            <span>UI PARAMETERS CONFIG</span>
          </div>
          <pre className={styles.codeSnippet}>
            <code>{BREAKOUT_JSON}</code>
          </pre>
        </div>
      </section>

      {/* PROMPTING TEMPLATES */}
      <section data-public-reveal="content" className={styles.docSection}>
        <h2 className={styles.sectionTitle}>6. Ready-to-Use AI Prompt Templates</h2>
        <p className={styles.sectionPara}>
          Use these prompt templates with your AI assistant to generate and refine new trading ideas:
        </p>

        <div className={styles.codeContainer}>
          <div className={styles.codeBar}>
            <span>PROMPT TEMPLATE: NEW STRATEGY</span>
            <span>PROMPT</span>
          </div>
          <pre className={styles.codeSnippet}>
            <code>{`I want to create a new ZTerminal Python strategy using the following concept:
- Asset: BTC_USDT on 1-hour candles
- Core Idea: Trend following with pullbacks
- Entry Long: Price is above the 200 EMA and the 14-period RSI pulls back below 40 then crosses back above 40
- Exit Long: RSI exceeds 70 or price closes below the 50 EMA
- Plots: Include 200 EMA, 50 EMA, and RSI
- Constraints: Ensure all signals are boolean with .fillna(False). Shift historical extrema to avoid look-ahead.
Please provide:
1. Complete Python code for def strategy(data, params):
2. Companion JSON parameters object for the ZTerminal UI.`}</code>
          </pre>
        </div>

        <div className={styles.codeContainer}>
          <div className={styles.codeBar}>
            <span>PROMPT TEMPLATE: PINE SCRIPT CONVERSION</span>
            <span>PROMPT</span>
          </div>
          <pre className={styles.codeSnippet}>
            <code>{`Convert the following TradingView Pine Script strategy into a ZTerminal Python strategy:
[Paste Pine Script code here]

Requirements:
- Adhere strictly to ZTerminal's def strategy(data, params) signature.
- Convert ta.sma, ta.ema, ta.rsi, and ta.crossover to zt functions.
- Replace bar-magnifier or intrabar logic with completed-bar signals (fill on next open).
- Provide the companion JSON parameter object.`}</code>
          </pre>
        </div>

        <div className={styles.codeContainer}>
          <div className={styles.codeBar}>
            <span>PROMPT TEMPLATE: DEBUGGING &amp; REFINEMENT</span>
            <span>PROMPT</span>
          </div>
          <pre className={styles.codeSnippet}>
            <code>{`My ZTerminal backtest produced the following diagnostic or unexpected behavior:
[Paste error message or strategy code here]

Please audit the strategy for:
1. Look-ahead bias (un-shifted rolling windows).
2. NaNs in boolean series.
3. Index alignment mismatch with data.index.
4. Correct parameter parsing with fallback defaults.`}</code>
          </pre>
        </div>
      </section>

      {/* METRICS & VALIDATION */}
      <section data-public-reveal="content" className={styles.docSection}>
        <h2 className={styles.sectionTitle}>7. Evaluating Backtest Evidence &amp; Statistical Rigor</h2>
        <p className={styles.sectionPara}>
          When your backtest finishes, ZTerminal presents detailed quantitative metrics:
        </p>
        <ul className={styles.bulletList}>
          <li>
            <strong>Net Return &amp; CAGR:</strong> Compound annual growth rate computed on a 365-day crypto calendar. Requires at least 365 days of data.
          </li>
          <li>
            <strong>Max Drawdown &amp; Duration:</strong> Peak-to-trough equity reduction and the time required to regain previous highs.
          </li>
          <li>
            <strong>Sharpe &amp; Sortino Ratios:</strong> Annualized risk-adjusted return calculated from daily account returns (minimum 30 observations required).
          </li>
          <li>
            <strong>Profit Factor &amp; Win Rate:</strong> Gross profits divided by gross losses. Examine average win vs. average loss to ensure the strategy does not rely on rare outliers.
          </li>
          <li>
            <strong>Politis–Romano Stationary Bootstrap:</strong> Runs Monte Carlo simulations by resampling blocks of historical returns. Tests whether the strategy&apos;s equity curve holds up under alternative sequence orderings.
          </li>
          <li>
            <strong>Holdout Forward Verification:</strong> Test your strategy against the reserved final 20% holdout. If the holdout performance diverges significantly from training, the strategy is overfit.
          </li>
        </ul>
      </section>

      {/* PITFALLS CHECKLIST */}
      <section data-public-reveal="content" className={styles.docSection}>
        <h2 className={styles.sectionTitle}>8. Common AI Pitfalls &amp; Quality Checklist</h2>
        <div className={styles.tableContainer}>
          <table className={styles.docTable}>
            <thead>
              <tr>
                <th>Common Mistake</th>
                <th>Why It Fails</th>
                <th>How to Fix It</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Unshifted rolling extrema</strong></td>
                <td><code>data.high.rolling(20).max()</code> includes current bar high. The strategy trades on price levels that haven&apos;t happened yet.</td>
                <td>Always add <code>.shift(1)</code> before rolling: <code>data.high.shift(1).rolling(20).max()</code>.</td>
              </tr>
              <tr>
                <td><strong>NaNs in boolean signals</strong></td>
                <td>Missing values cause signal evaluation errors during fill generation.</td>
                <td>Always append <code>.fillna(False).astype(bool)</code> to <code>entries</code> and <code>exits</code>.</td>
              </tr>
              <tr>
                <td><strong>Using un-vectorized loops</strong></td>
                <td>Iterating row-by-row with <code>for row in data.iterrows()</code> causes timeouts on large datasets.</td>
                <td>Use vectorized pandas operations, <code>zt</code> helpers, or <code>vectorbt</code> methods.</td>
              </tr>
              <tr>
                <td><strong>Hardcoded parameters</strong></td>
                <td>Hardcoded values prevent sensitivity sweeps and parameter tuning in the UI.</td>
                <td>Extract values via <code>params.get(&quot;param_name&quot;, default)</code> and provide the JSON object.</td>
              </tr>
              <tr>
                <td><strong>Attempting limit/bracket orders</strong></td>
                <td>ZTerminal&apos;s boolean engine accepts market signals only. Limit/stop bracket calls will fail.</td>
                <td>Model stop-loss or profit-target conditions directly as boolean exit conditions.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* WORKFLOW SUMMARY */}
      <section data-public-reveal="content" className={styles.docSection}>
        <h2 className={styles.sectionTitle}>9. End-to-End Workflow in 4 Steps</h2>
        <ol className={styles.stepList}>
          <li>
            <strong>1. Generate Code with AI:</strong> Send the system prompt and your idea to your AI assistant. Receive the Python code and JSON parameters.
          </li>
          <li>
            <strong>2. Connect ZTerminal Helper:</strong> Launch <code>ZTerminalResearchHelper.exe</code> on your computer, copy the 8-digit code, open the terminal&apos;s <strong>Python Strategy</strong> tab, and click <strong>Connect Helper</strong>.
          </li>
          <li>
            <strong>3. Paste Code &amp; Settings:</strong> Paste the generated Python code into the editor. Expand <strong>Parameters</strong> and paste the JSON config. Select your symbol and date range.
          </li>
          <li>
            <strong>4. Run &amp; Inspect:</strong> Click <strong>Run Backtest</strong>. Examine the equity curve, trade ledger, drawdown analysis, and Monte Carlo bootstrap confidence bands.
          </li>
        </ol>

        <div className={styles.linkRow}>
          <Link href="/terminal" className={styles.primaryButtonSmall}>
            Open Terminal Workbench <Arrow />
          </Link>
          <Link href="/docs/python-research" className={styles.textLink}>
            Read Python Research API Reference <Arrow />
          </Link>
          <Link href="/docs" className={styles.textLink}>
            Documentation Index <Arrow />
          </Link>
        </div>
      </section>
    </article>
  );
}
