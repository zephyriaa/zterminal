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
        Python Research API
        <em>Write → validate → inspect.</em>
      </h1>
      <p className={styles.docLead}>
        The ZTerminal Research API runs real Python and vectorbt on your computer. Pair the local helper once, write a strategy in standard pandas, and run vectorized backtests with visible empirical limits. Python code never leaves your machine.
      </p>

      {/* LOCAL EXECUTION SECTION */}
      <section className={styles.docSection}>
        <h2 className={styles.sectionTitle}>Local execution &amp; user permissions</h2>
        <p className={styles.sectionPara}>
          Install the private package and start the ZTerminal Research Helper. Enter its eight-digit authentication code in the terminal. Your browser or OS may prompt for local network permissions. Scripts run under your user permissions; process limits do not constitute a remote multi-tenant sandbox. Run only code you trust.
        </p>
      </section>

      {/* STRATEGY SPECIFICATION */}
      <section className={styles.docSection}>
        <h2 className={styles.sectionTitle}>Authoring a testable strategy</h2>
        <p className={styles.sectionPara}>
          The engine provides an observed, UTC-indexed pandas DataFrame with standard columns: <code>open</code>, <code>high</code>, <code>low</code>, <code>close</code>, and <code>volume</code>. Your strategy returns an aligned boolean series through <code>zt.Strategy</code>.
        </p>

        <div className={styles.codeContainer}>
          <div className={styles.codeBar}>
            <span>strategy_sdk_v1.py</span>
            <span>PYTHON 3.11+</span>
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
      <section className={styles.docSection}>
        <h2 className={styles.sectionTitle}>Explicit simulation assumptions</h2>
        <p className={styles.sectionPara}>
          ZTerminal insists on visible execution limits to eliminate look-ahead bias and curve-fitting illusions:
        </p>
        <ul className={styles.bulletList}>
          <li>
            <strong>Bar-Close Execution:</strong> Signals triggered at completed-bar close fill at the following bar&apos;s open price.
          </li>
          <li>
            <strong>No Fictional Liquidity:</strong> Fills are never manufactured beyond observed market depth.
          </li>
          <li>
            <strong>Single Position Default:</strong> One position at a time, zero unmodeled leverage, no automatic compounding or pyramiding unless explicitly specified.
          </li>
          <li>
            <strong>Mark-to-Market Accounting:</strong> Open positions are marked to market and tracked separately from realized closed-trade statistics.
          </li>
        </ul>
      </section>

      {/* REPRODUCIBILITY */}
      <section className={styles.docSection}>
        <h2 className={styles.sectionTitle}>Reproducible audit archive</h2>
        <p className={styles.sectionPara}>
          Every successful simulation run records its complete source code, parameter configuration, observed dataset slice, and cryptographic SHA-256 hash in the local helper archive. You can click any historical trade in the log to inspect exact entry and exit candles without active market data connectivity.
        </p>
        <div className={styles.callout}>
          <strong>Audit Principle:</strong> Research is only evidence if it can be reproduced exactly. ZTerminal ensures every metric traces back to a verified timestamped snapshot.
        </div>
      </section>

      {/* QUICK LINKS */}
      <section className={styles.docSection}>
        <h2 className={styles.sectionTitle}>Explore the workstation</h2>
        <p className={styles.sectionPara}>
          Open the terminal workspace to inspect existing strategy templates or review migration options.
        </p>
        <div className={styles.linkRow}>
          <Link href="/terminal" className={styles.primaryButtonSmall}>
            Launch web terminal <Arrow />
          </Link>
          <Link href="/docs/zscript" className={styles.textLink}>
            Read ZScript migration notes <Arrow />
          </Link>
        </div>
      </section>
    </article>
  );
}
