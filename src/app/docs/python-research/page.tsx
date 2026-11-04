import type { Metadata } from "next";
import Link from "next/link";
import { EXAMPLES } from "@/lib/local-research/examples";
import styles from "../docs.module.css";

export const metadata: Metadata = {
  title: "Python Research API — ZTerminal Documentation",
  description: "Write vectorbt and pandas trading strategies in Python, execute locally, and inspect reproducible backtest evidence.",
};

function Arrow() {
  return <span className={styles.arrow} aria-hidden="true">↗</span>;
}

export default function PythonResearchDocumentationPage() {
  const exampleCode = EXAMPLES[0]?.source || `# Default strategy example\nimport zt\nimport pandas as pd`;

  return (
    <article className={styles.docArticle}>
      <Link href="/docs" className={styles.backLink}>← Documentation index</Link>

      <p className={styles.eyebrow}>ZTERMINAL SDK / VERSION 1</p>
      <h1 className={styles.docTitle}>
        Python Research API{" "}
        <em>Write → validate → inspect.</em>
      </h1>
      <p className={styles.docLead}>
        The ZTerminal Research API runs real Python and vectorbt on your computer. Pair the local helper once, write a strategy in standard pandas, and run vectorized backtests with visible empirical limits. Python strategy code executes through the paired local helper on your machine rather than on the ZTerminal web server.
      </p>

      <div className={styles.callout}>
        <strong>Looking to write strategies with AI?</strong> Read the comprehensive{" "}
        <Link href="/docs/backtesting" className={styles.textLink}>
          Backtesting &amp; AI Strategy Guide <Arrow />
        </Link>{" "}
        for system prompts, backtest settings schemas, and ready-to-test code recipes.
      </div>

      {/* LOCAL EXECUTION SECTION */}
      <section data-public-reveal="content" className={styles.docSection}>
        <h2 className={styles.sectionTitle}>Local execution &amp; user permissions</h2>
        <p className={styles.sectionPara}>
          Install the private package and start the ZTerminal Research Helper. Enter its eight-digit authentication code in the terminal. Your browser or OS may prompt for local network permissions. Scripts run under your user permissions; process limits do not constitute a remote multi-tenant sandbox. Run only code you trust.
        </p>
      </section>

      {/* STRATEGY SPECIFICATION */}
      <section data-public-reveal="content" className={styles.docSection}>
        <h2 className={styles.sectionTitle}>Authoring a testable strategy</h2>
        <p className={styles.sectionPara}>
          The engine provides an observed, UTC-indexed pandas DataFrame with standard columns: <code>open</code>, <code>high</code>, <code>low</code>, <code>close</code>, and <code>volume</code>. Your strategy returns an aligned boolean series through <code>zt.Strategy</code>.
        </p>

        <div className={styles.codeContainer}>
          <div className={styles.codeBar}>
            <span>strategy_sdk_v1.py</span>
            <span>CPYTHON 3.12.10 HELPER</span>
          </div>
          <pre className={styles.codeSnippet}>
            <code>{exampleCode}</code>
          </pre>
        </div>

        <p className={styles.sectionPara}>
          Built-in indicators such as <code>zt.ema</code>, <code>zt.sma</code>, <code>zt.rsi</code>, <code>zt.crossover</code>, and <code>zt.crossunder</code> operate directly on observed series. Full vectorbt methods may also be imported to compute vectorized signals and multi-asset matrices.
        </p>
      </section>

      {/* SIMULATION ASSUMPTIONS */}
      <section data-public-reveal="content" className={styles.docSection}>
        <h2 className={styles.sectionTitle}>Explicit simulation assumptions</h2>
        <p className={styles.sectionPara}>
          The model discloses execution limits. Signal shifting cannot prove arbitrary Python free of look-ahead bias:
        </p>
        <ul className={styles.bulletList}>
          <li>
            <strong>Bar-Close Execution:</strong> Signals triggered at completed-bar close fill at the following bar&apos;s open price.
          </li>
          <li>
            <strong>OHLCV fidelity:</strong> Candles do not reveal depth, queue position or fill probability. Market fills apply captured deterministic price adjustments.
          </li>
          <li>
            <strong>Single Position:</strong> One synthetic unlevered position, long or short. Entry notional is reserved. No pyramiding, automatic reversal, funding, borrowing, margin or liquidation.
          </li>
          <li>
            <strong>Mark-to-Market Accounting:</strong> Open positions are marked to market and tracked separately from realized closed-trade statistics.
          </li>
        </ul>
      </section>

      <section data-public-reveal="content" className={styles.docSection}>
        <h2 className={styles.sectionTitle}>Research workflow and contract v2</h2>
        <p className={styles.sectionPara}>Write, import and save Python before pairing. Browser saves remain origin-local; export source and retain Helper revisions for durable copies. The editor supplies syntax highlighting, line numbers and SDK completions, not Python language-server diagnostics. If loading fails, use the accessible plain-text fallback.</p>
        <p className={styles.sectionPara}>Define strategy(data, params) returning zt.Strategy. Inputs are float64 OHLCV with UTC candle-open timestamps. Signals must be exactly aligned boolean Series without missing values. Numeric plots may contain warm-up NaNs, never infinity. PARAMETERS can declare SDK integer, number, boolean and string defaults and constraints. Undeclared supplied keys fail when declarations exist. Warm-up bars cannot trade; the first eligible completed-bar signal fills after the configured delay, normally at the next open. Final signals without a later bar remain unfilled.</p>
        <p className={styles.sectionPara}>Only market signals are supported. Limit, stop and bracket orders are rejected. Quantity rounds down to step and price rounds adversely to tick. Fees apply per fill, half the full spread applies per side, and slippage is separate. Minimum size and capital constraints can reject an order. Cash plus reserved capital plus unrealized P&amp;L equals equity. Synthetic shorts cannot spend sale proceeds. Open positions are marked without hypothetical exit fees.</p>
        <p className={styles.sectionPara}>New runs reserve the final 20% before Python executes. Chronological 60/20/20 validation and three expanding walk-forward folds select bounded-grid parameters on training net return only. Scored segments start flat and close at their final close with modeled costs. Declared overlapping outcomes require purge/embargo. Explicit final-holdout requests record reuse. An unreserved earlier backtest already exposed its holdout.</p>
        <p className={styles.sectionPara}>Risk ratios use complete UTC daily account returns, a 365-day crypto calendar, zero risk-free rate and at least 30 observations. CAGR needs one year. Stationary bootstrap needs 60 daily returns and five expected blocks. Trade permutation changes order; IID trades destroy dependence; random-length daily blocks preserve local dependence under stationarity assumptions. All simulation frequencies are conditional historical outputs, not calibrated probabilities of future profit.</p>
        <p className={styles.sectionPara}>The deterministic edge assessment uses visible conservative screening rules and requires forward validation. It does not assign a probability of alpha. Methods: <a href="https://users.ssc.wisc.edu/~behansen/718/Politis%20Romano.pdf">Politis–Romano stationary bootstrap</a> and <a href="https://doi.org/10.2139/ssrn.2460551">Bailey–López de Prado selection-bias research</a>. PBO and Deflated Sharpe are unavailable without complete required inputs. MultiCharts comparison has not been performed.</p>
        <p className={styles.sectionPara}>Ordinary jobs retain 180-second wall and 120-second CPU limits. Research analyses allow 1800 seconds wall and 1200 seconds CPU, 2 GB memory and one process. Limits include 100 grid combinations, two million evaluated bars and ten million sampled observations per simulation. Cancellation terminates the process tree. Arbitrary local Python retains your file/network permissions; this is not a secure sandbox.</p>
      </section>
      {/* REPRODUCIBILITY */}
      <section data-public-reveal="content" className={styles.docSection}>
        <h2 className={styles.sectionTitle}>Reproducible audit archive</h2>
        <p className={styles.sectionPara}>
          Every successful simulation run records its complete source code, parameter configuration, observed dataset slice, and cryptographic SHA-256 hash in the local helper archive. You can click any historical trade in the log to inspect exact entry and exit candles without active market data connectivity.
        </p>
        <div className={styles.callout}>
          <strong>Audit Principle:</strong> Archives retain source, data, settings and computed evidence. Hashes establish retained identity, not market-data authenticity.
        </div>
      </section>

      {/* QUICK LINKS */}
      <section data-public-reveal="content" className={styles.docSection}>
        <h2 className={styles.sectionTitle}>Explore the workstation</h2>
        <p className={styles.sectionPara}>
          Open the terminal workspace to inspect existing strategy templates or review migration options.
        </p>
        <div className={styles.linkRow}>
          <Link href="/terminal" className={styles.primaryButtonSmall}>
            Launch web terminal <Arrow />
          </Link>
          <Link href="/docs/backtesting" className={styles.textLink}>
            AI &amp; Backtesting Guide <Arrow />
          </Link>
          <Link href="/docs/zscript" className={styles.textLink}>
            Read ZScript migration notes <Arrow />
          </Link>
        </div>
      </section>
    </article>
  );
}
