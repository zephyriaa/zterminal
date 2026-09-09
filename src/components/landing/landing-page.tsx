import React from "react";
import Image from "next/image";
import Link from "next/link";

import { HeroScene } from "./hero-scene";
import { WorkflowSequence } from "@/components/public/workflow-sequence";
import { PublicFooter } from "@/components/public/public-footer";
import "@/components/public/public-theme.css";

import styles from "./landing-page.module.css";

function Arrow() {
  return <span className={styles.arrow} aria-hidden="true">↗</span>;
}

export function LandingPage() {
  return (
    <main className={`${styles.page} publicScope`} id="main">
      <a className={styles.skipLink} href="#overview">Skip to content</a>

      {/* 01 HERO VIEWPORT: Exact 1672x941 projective laptop, particle waves, and approved copy */}
      <HeroScene />

      <div className={styles.content}>
        {/* 02 THE PROBLEM / MARKET CONTEXT */}
        <section className={styles.problemSection} aria-labelledby="problem-title">
          <div className={styles.problemCopy}>
            <p className={styles.eyebrow}>02 / MARKET REALITY</p>
            <h2 id="problem-title" className={styles.sectionHeading}>
              A chart alone is not evidence.
              <em>Without structure, every trade is a guess.</em>
            </h2>
            <p className={styles.leadText}>
              Traders look at an upward swing and invent a story. An isolated candlestick gives the illusion of understanding, but true market moves happen within volatility regimes, liquidity imbalances, and statistical bounds.
            </p>
            <p className={styles.bodyText}>
              ZTerminal replaces visual storytelling with quantitative context. Before deploying capital, know the regime, measure the historical expectancy, and inspect the distribution.
            </p>
            <div className={styles.telemetryPills}>
              <span className={styles.pill}>REGIME: VOLATILITY COMPRESSION</span>
              <span className={styles.pill}>ATR: 98.31 (5M)</span>
              <span className={styles.pill}>MULTI-TIMEFRAME CONTEXT</span>
            </div>
          </div>

          <div className={styles.problemInspector} aria-hidden="true">
            <div className={styles.inspectorHeader}>
              <span className={styles.inspectorTitle}>TELEMETRY SNAPSHOT · BTC/USDT</span>
              <span className={styles.inspectorStatus}>REGIME 01</span>
            </div>
            <div className={styles.inspectorMetrics}>
              <div className={styles.metricItem}>
                <span className={styles.metricLabel}>LAST PRICE</span>
                <span className={styles.metricVal}>79,049.00</span>
              </div>
              <div className={styles.metricItem}>
                <span className={styles.metricLabel}>VWAP (SESSION)</span>
                <span className={styles.metricVal}>79,167.26</span>
              </div>
              <div className={styles.metricItem}>
                <span className={styles.metricLabel}>RV (RELATIVE VOL)</span>
                <span className={styles.metricVal}>0.085%</span>
              </div>
              <div className={styles.metricItem}>
                <span className={styles.metricLabel}>OPEN WINDOW</span>
                <span className={styles.metricVal}>00:00–00:30 UTC</span>
              </div>
            </div>
            <div className={styles.inspectorRule}>
              <code>
                RULE: IF regime == COMPRESSION AND volume_surge &gt; 1.6 THEN ARM_SETUP ELSE WAIT
              </code>
            </div>
          </div>
        </section>

        {/* 03 THE WORKFLOW: The Research Loop */}
        <section className={styles.workflowSection} id="workflow" aria-labelledby="workflow-title">
          <div className={styles.sectionHeaderCentered}>
            <p className={styles.eyebrow}>03 / THE RESEARCH LOOP</p>
            <h2 id="workflow-title" className={styles.sectionHeading}>
              A deliberate sequence.
              <em>Conviction through verification.</em>
            </h2>
            <p className={styles.sectionLead}>
              Research → Validate → Monitor → Decide → Execute → Review. Every step is transparent; execution remains strictly in your hands.
            </p>
          </div>
          <WorkflowSequence />
        </section>

        {/* 04 MARKET CONTEXT: Real Interface Showcase */}
        <section className={styles.canvasSection} aria-labelledby="canvas-title">
          <div className={styles.canvasIntro}>
            <div>
              <p className={styles.eyebrow}>04 / MARKET CANVAS</p>
              <h2 id="canvas-title" className={styles.sectionHeading}>
                See the structure around the move.
              </h2>
            </div>
            <p className={styles.canvasDescription}>
              The market canvas renders millions of data points with hardware acceleration via TradingView Lightweight Charts. Volume profiles, moving averages, and session bounds compute directly on your GPU without cloud buffering.
            </p>
          </div>

          <figure className={styles.canvasShowcase}>
            <div className={styles.canvasFrame}>
              <div className={styles.canvasBar}>
                <div className={styles.canvasDots}>
                  <span />
                  <span />
                  <span />
                </div>
                <div className={styles.canvasInstrumentBadge}>
                  BTC / USDT · 5M CANVAS · PERPETUAL · DIRECT FEED
                </div>
                <div className={styles.canvasModeChip}>RESEARCH MODE</div>
              </div>
              <Image
                src="/landing/terminal-screenshot.png"
                alt="Full ZTerminal market canvas displaying real Bitcoin price action and indicators"
                width={3200}
                height={1800}
                sizes="(max-width: 900px) 95vw, 85vw"
                className={styles.canvasImage}
              />
            </div>
            <figcaption className={styles.canvasCaption}>
              <span>CURRENT PRODUCT · REAL MARKET CANVAS WITH MULTI-TIMEFRAME NAVIGATION</span>
              <span>LIGHTWEIGHT CHARTS ENGINE</span>
            </figcaption>
          </figure>
        </section>

        {/* 05 RESEARCH / VALIDATION: Python Research API */}
        <section className={styles.researchSection} aria-labelledby="research-title">
          <div className={styles.sectionHeaderCentered}>
            <p className={styles.eyebrow}>05 / RESEARCH &amp; VALIDATION</p>
            <h2 id="research-title" className={styles.sectionHeading}>
              Turn an intuition into
              <em>a testable mathematical rule.</em>
            </h2>
            <p className={styles.sectionLead}>
              Express ideas in standard Python with pandas and vectorbt. Run reproducible simulations locally with visible assumptions.
            </p>
          </div>

          <div className={styles.researchSplit}>
            <div className={styles.codeWindow}>
              <div className={styles.codeHeader}>
                <span className={styles.codeFile}>strategy_ema_cross.py</span>
                <span className={styles.codeLang}>PYTHON RESEARCH API</span>
              </div>
              <pre className={styles.codeBlock}>
                <code>
{`import zt
import pandas as pd

def strategy(df: pd.DataFrame) -> zt.Strategy:
    """Vectorized mean reversion with regime filter."""
    fast = zt.ema(df["close"], length=21)
    slow = zt.ema(df["close"], length=55)
    
    # Enter on explicit observed cross
    entries = zt.crossover(fast, slow)
    exits = zt.crossunder(fast, slow)
    
    return zt.Strategy(
        entries=entries,
        exits=exits,
        direction="long"
    )`}
                </code>
              </pre>
            </div>

            <div className={styles.evidencePanel}>
              <p className={styles.evidenceEyebrow}>EVIDENCE INSPECTOR · VERIFIED METRICS</p>
              <div className={styles.evidenceStats}>
                <div className={styles.statBox}>
                  <span className={styles.statLabel}>SHARPE RATIO</span>
                  <span className={styles.statNumber}>1.84</span>
                  <span className={styles.statFootnote}>365-day crypto calendar · rf=0%</span>
                </div>
                <div className={styles.statBox}>
                  <span className={styles.statLabel}>SORTINO RATIO</span>
                  <span className={styles.statNumber}>2.31</span>
                  <span className={styles.statFootnote}>Downside deviation only</span>
                </div>
                <div className={styles.statBox}>
                  <span className={styles.statLabel}>MAX DRAWDOWN</span>
                  <span className={styles.statNumber}>-11.4%</span>
                  <span className={styles.statFootnote}>Peak-to-trough account equity</span>
                </div>
                <div className={styles.statBox}>
                  <span className={styles.statLabel}>SAMPLE SIZE</span>
                  <span className={styles.statNumber}>N = 142</span>
                  <span className={styles.statFootnote}>56.2% closed-trade win rate</span>
                </div>
              </div>

              <div className={styles.assumptionsBox}>
                <p className={styles.assumptionsTitle}>EXPLICIT SIMULATION ASSUMPTIONS</p>
                <ul className={styles.assumptionsList}>
                  <li>Signals at completed-bar close fill at the following open.</li>
                  <li>No fill is manufactured beyond observed dataset liquidity.</li>
                  <li>Open positions marked to market; costs and commissions explicit.</li>
                  <li>Vectorized backtesting via Polars and Monte Carlo remain in active development.</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* 06 ORDER FLOW & LOCAL-FIRST ARCHITECTURE */}
        <section className={styles.archSection} aria-labelledby="arch-title">
          <div className={styles.archHeader}>
            <p className={styles.eyebrow}>06 / CLIENT-FIRST ARCHITECTURE</p>
            <h2 id="arch-title" className={styles.sectionHeading}>
              Compute at the edge.
              <em>Your machine does the heavy work.</em>
            </h2>
            <p className={styles.leadText}>
              Traditional SaaS forces market analysis through shared cloud servers, creating network latency, subscription bloat, and compute caps. ZTerminal moves the analytical workload to your local processor and storage.
            </p>
          </div>

          <div className={styles.archFlow}>
            <div className={styles.archTier}>
              <div className={styles.tierTag}>SHARED CLOUD LAYER</div>
              <h3 className={styles.tierName}>Server-Light Infrastructure</h3>
              <p className={styles.tierDetail}>Lightweight licensing, user authentication, and shared service metadata. Low bandwidth, minimal central footprint.</p>
              <div className={styles.tierSpecs}>
                <span>AUTH &amp; LICENSES</span>
                <span>METADATA SYNC</span>
                <span>STATUS SIGNALING</span>
              </div>
            </div>

            <div className={styles.archDivider}>
              <span className={styles.dividerArrow}>↓</span>
              <span className={styles.dividerText}>LOW BANDWIDTH ONLY</span>
            </div>

            <div className={styles.archTierActive}>
              <div className={styles.tierTagActive}>YOUR WINDOWS WORKSTATION</div>
              <h3 className={styles.tierName}>Native Client Shell (Tauri + Rust)</h3>
              <p className={styles.tierDetail}>Direct NVMe access, multi-threaded CPU parallelization, and zero web sandbox limitations.</p>
              <div className={styles.tierEngines}>
                <div className={styles.engineCard}>
                  <h4>DuckDB (SQL)</h4>
                  <p>Local columnar OLAP queries over historical parquet datasets.</p>
                </div>
                <div className={styles.engineCard}>
                  <h4>Polars (DataFrames)</h4>
                  <p>Zero-copy vectorized strategy simulation on local CPU cores.</p>
                </div>
                <div className={styles.engineCard}>
                  <h4>Lightweight Charts</h4>
                  <p>Hardware-accelerated GPU canvas rendering of millions of ticks.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 07 RISK, ALERTS & JOURNAL */}
        <section className={styles.trioSection} aria-labelledby="trio-title">
          <div className={styles.sectionHeaderCentered}>
            <p className={styles.eyebrow}>07 / WORKFLOW CONTINUUM</p>
            <h2 id="trio-title" className={styles.sectionHeading}>
              Risk, alerts, and journaling.
              <em>Structured for deliberate execution.</em>
            </h2>
          </div>

          <div className={styles.trioGrid}>
            <div className={styles.trioJournal}>
              <div className={styles.trioBadge}>01 / RESEARCH JOURNAL</div>
              <h3>Audit every decision</h3>
              <p>Capture the context behind each setup before price resolves. Link charts, notes, and hypotheses.</p>
              <div className={styles.journalNote}>
                <div className={styles.journalMeta}>
                  <span>BTC/USDT · 5M COMPRESSION</span>
                  <span>18:24 UTC</span>
                </div>
                <p className={styles.journalText}>
                  Strong relative strength on the 5m canvas after compression. Watching for continuation above 79,200. Session volume expanded 1.8x on breakout.
                </p>
                <div className={styles.journalTags}>
                  <span>#macros</span>
                  <span>#breakout</span>
                  <span>#risk</span>
                </div>
              </div>
            </div>

            <div className={styles.trioAlerts}>
              <div className={styles.trioBadge}>02 / CONTEXT-RICH ALERTS</div>
              <h3>Signal when regimes change</h3>
              <p>Never stare at a chart waiting for a setup. Trigger notifications based on statistical rules.</p>
              <div className={styles.alertCode}>
                <div className={styles.alertHeader}>TRIGGER LOGIC</div>
                <code>
                  IF close &gt; 79,167<br />
                  AND volume &gt; 1.5 * vol_ma20<br />
                  AND rsi &lt; 65<br />
                  THEN SIGNAL(&quot;Regime Breakout&quot;)
                </code>
              </div>
            </div>

            <div className={styles.trioRisk}>
              <div className={styles.trioBadge}>03 / RISK BOUNDARIES</div>
              <h3>Enforce capital discipline</h3>
              <p>Trading is risk management before it is profit pursuit. Keep limits prominent at every decision point.</p>
              <div className={styles.riskRules}>
                <div className={styles.riskItem}>
                  <span>POSITION MODEL</span>
                  <strong>One position · Zero leverage</strong>
                </div>
                <div className={styles.riskItem}>
                  <span>SLIPPAGE / FEES</span>
                  <strong>Explicit unmodeled frictions visible</strong>
                </div>
                <div className={styles.riskItem}>
                  <span>CAPITAL BUDGET</span>
                  <strong>Maximum 1.5% risk per setup</strong>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 08 LOCAL-FIRST MANIFESTO */}
        <section className={styles.localSection} aria-labelledby="local-title">
          <div className={styles.localContent}>
            <p className={styles.eyebrow}>08 / CLIENT-FIRST PHILOSOPHY</p>
            <h2 id="local-title" className={styles.hugeTypo}>
              Adding users should not
              <em>add servers.</em>
            </h2>
            <div className={styles.localColumns}>
              <p>
                ZTerminal is architected around a simple economic truth: client-side compute is free to host and scales infinitely with each user&apos;s machine.
              </p>
              <p>
                Your strategies, backtests, and proprietary models vectorize on your hardware and write to your local NVMe storage. They never leak into a multi-tenant cloud database.
              </p>
            </div>
          </div>
        </section>

        {/* 09 PHILOSOPHY */}
        <section className={styles.philosophySection} aria-labelledby="philo-title">
          <div className={styles.philoInner}>
            <p className={styles.eyebrow}>09 / CORE PHILOSOPHY</p>
            <h2 id="philo-title" className={styles.philoTitle}>
              Evidence over intuition.
              <span className={styles.philoEm}>Robustness over optimization.</span>
            </h2>
            <div className={styles.philoDivider} />
            <p className={styles.philoSub}>
              A compelling chart is not evidence. A stable strategy with honest limits is infinitely more valuable than an over-fitted backtest.
            </p>
          </div>
        </section>

        {/* 10 NATIVE WINDOWS */}
        <section className={styles.windowsSection} id="windows" aria-labelledby="windows-title">
          <div className={styles.windowsGrid}>
            <div>
              <p className={styles.eyebrow}>10 / WORKSTATION TARGET</p>
              <h2 id="windows-title" className={styles.sectionHeading}>
                The workstation belongs
                <em>on bare metal.</em>
              </h2>
            </div>
            <div className={styles.windowsCopy}>
              <p>
                ZTerminal is built natively for 64-bit Windows. Desktop research demands direct filesystem access, NVMe throughput, and local hardware concurrency.
              </p>
              <p>
                The desktop client is in active development. Official signed packages, checksums, and release notes are published exclusively through the verified release route.
              </p>
              <div className={styles.windowsActions}>
                <Link className={styles.primaryButton} href="/download">
                  Windows release status <Arrow />
                </Link>
                <Link className={styles.textLink} href="/docs/windows/install">
                  Installation guide <Arrow />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* 11 FINAL CTA */}
        <section className={styles.finalCta} aria-labelledby="final-title">
          <h2 id="final-title" className={styles.finalHeading}>
            <span>See more.</span>
            <em>Guess less.</em>
          </h2>
          <div className={styles.finalActions}>
            <Link className={styles.primaryButton} href="/download">
              Explore for Windows <Arrow />
            </Link>
            <Link className={styles.secondaryTextLink} href="/terminal">
              Launch web terminal <Arrow />
            </Link>
          </div>
          <p className={styles.finalDisclaimer}>
            Decision support for traders. No broker route. You retain control of execution.
          </p>
        </section>
      </div>

      <PublicFooter />
    </main>
  );
}
