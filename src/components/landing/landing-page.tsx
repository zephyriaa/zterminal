"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";

import { HeroScene } from "./hero-scene";
import { WorkflowSequence } from "@/components/public/workflow-sequence";
import { PublicFooter } from "@/components/public/public-footer";
import {
  MaskedHeading,
  FadeInView,
  ScaleReveal,
  StaggerContainer,
  StaggerItem,
  ParallaxText,
  EASE_OUT_EXPO,
} from "./motion-primitives";
import "@/components/public/public-theme.css";

import styles from "./landing-page.module.css";

function Arrow() {
  return <span className={styles.arrow} aria-hidden="true">↗</span>;
}

export function LandingPage() {
  return (
    <main className={`${styles.page} publicScope`} id="main">
      <a className={styles.skipLink} href="#overview">Skip to content</a>

      {/* 01 HERO VIEWPORT: Exact 1672x941 projective laptop, particle waves, and orchestrated entrance */}
      <HeroScene />

      <div className={styles.content}>
        {/* 02 THE PROBLEM / MARKET CONTEXT */}
        <section className={styles.problemSection} aria-labelledby="problem-title">
          <div className={styles.problemCopy}>
            <p className={styles.eyebrow}>02 / MARKET REALITY</p>
            <MaskedHeading
              as="h2"
              id="problem-title"
              className={styles.sectionHeading}
              lines={[
                { text: "A chart alone is not evidence." },
                { text: "Without structure, every trade is a guess.", italic: true },
              ]}
            />
            <FadeInView delay={0.1} yOffset={18}>
              <p className={styles.leadText}>
                Traders look at an upward swing and invent a story. An isolated candlestick gives the illusion of understanding, but true market moves happen within volatility regimes, liquidity imbalances, and statistical bounds.
              </p>
            </FadeInView>
            <FadeInView delay={0.18} yOffset={18}>
              <p className={styles.bodyText}>
                ZTerminal replaces visual storytelling with quantitative context. Before deploying capital, know the regime, measure the historical expectancy, and inspect the distribution.
              </p>
            </FadeInView>

            <StaggerContainer className={styles.telemetryPills} staggerDelay={0.06} delay={0.22}>
              <StaggerItem>
                <span className={styles.pill}>REGIME: VOLATILITY COMPRESSION</span>
              </StaggerItem>
              <StaggerItem>
                <span className={styles.pill}>ATR: 98.31 (5M)</span>
              </StaggerItem>
              <StaggerItem>
                <span className={styles.pill}>MULTI-TIMEFRAME CONTEXT</span>
              </StaggerItem>
            </StaggerContainer>
          </div>

          <ScaleReveal className={styles.problemInspector}>
            <div className={styles.inspectorHeader}>
              <span className={styles.inspectorTitle}>TELEMETRY SNAPSHOT · BTC/USDT</span>
              <span className={styles.inspectorStatus}>REGIME 01</span>
            </div>
            <StaggerContainer className={styles.inspectorMetrics} staggerDelay={0.06} delay={0.1}>
              <StaggerItem className={styles.metricItem}>
                <span className={styles.metricLabel}>LAST PRICE</span>
                <span className={styles.metricVal}>79,049.00</span>
              </StaggerItem>
              <StaggerItem className={styles.metricItem}>
                <span className={styles.metricLabel}>VWAP (SESSION)</span>
                <span className={styles.metricVal}>79,167.26</span>
              </StaggerItem>
              <StaggerItem className={styles.metricItem}>
                <span className={styles.metricLabel}>RV (RELATIVE VOL)</span>
                <span className={styles.metricVal}>0.085%</span>
              </StaggerItem>
              <StaggerItem className={styles.metricItem}>
                <span className={styles.metricLabel}>OPEN WINDOW</span>
                <span className={styles.metricVal}>00:00–00:30 UTC</span>
              </StaggerItem>
            </StaggerContainer>
            <div className={styles.inspectorRule}>
              <code>
                RULE: IF regime == COMPRESSION AND volume_surge &gt; 1.6 THEN ARM_SETUP ELSE WAIT
              </code>
            </div>
          </ScaleReveal>
        </section>

        {/* 03 THE WORKFLOW: The Research Loop */}
        <section className={styles.workflowSection} id="workflow" aria-labelledby="workflow-title">
          <div className={styles.sectionHeaderCentered}>
            <p className={styles.eyebrow}>03 / THE RESEARCH LOOP</p>
            <MaskedHeading
              as="h2"
              id="workflow-title"
              className={styles.sectionHeading}
              lines={[
                { text: "A deliberate sequence." },
                { text: "Conviction through verification.", italic: true },
              ]}
            />
            <FadeInView delay={0.12} yOffset={18}>
              <p className={styles.sectionLead}>
                Research → Validate → Monitor → Decide → Execute → Review. Every step is transparent; execution remains strictly in your hands.
              </p>
            </FadeInView>
          </div>
          <WorkflowSequence />
        </section>

        {/* 04 MARKET CONTEXT: Real Interface Showcase */}
        <section className={styles.canvasSection} aria-labelledby="canvas-title">
          <div className={styles.canvasIntro}>
            <div>
              <p className={styles.eyebrow}>04 / MARKET CANVAS</p>
              <MaskedHeading
                as="h2"
                id="canvas-title"
                className={styles.sectionHeading}
                lines={[{ text: "See the structure around the move." }]}
              />
            </div>
            <FadeInView delay={0.1} yOffset={16}>
              <p className={styles.canvasDescription}>
                The market canvas renders millions of data points with hardware acceleration via TradingView Lightweight Charts. Volume profiles, moving averages, and session bounds compute directly on your GPU without cloud buffering.
              </p>
            </FadeInView>
          </div>

          <ScaleReveal className={styles.canvasShowcase}>
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
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.85, ease: EASE_OUT_EXPO, delay: 0.1 }}
              >
                <Image
                  src="/landing/terminal-screenshot.png"
                  alt="Full ZTerminal market canvas displaying real Bitcoin price action and indicators"
                  width={3200}
                  height={1800}
                  sizes="(max-width: 900px) 95vw, 85vw"
                  className={styles.canvasImage}
                />
              </motion.div>
            </div>
            <figcaption className={styles.canvasCaption}>
              <span>CURRENT PRODUCT · REAL MARKET CANVAS WITH MULTI-TIMEFRAME NAVIGATION</span>
              <span>LIGHTWEIGHT CHARTS ENGINE</span>
            </figcaption>
          </ScaleReveal>
        </section>

        {/* 05 RESEARCH / VALIDATION: Python Research API */}
        <section className={styles.researchSection} aria-labelledby="research-title">
          <div className={styles.sectionHeaderCentered}>
            <p className={styles.eyebrow}>05 / RESEARCH &amp; VALIDATION</p>
            <MaskedHeading
              as="h2"
              id="research-title"
              className={styles.sectionHeading}
              lines={[
                { text: "Turn an intuition into" },
                { text: "a testable mathematical rule.", italic: true },
              ]}
            />
            <FadeInView delay={0.12} yOffset={16}>
              <p className={styles.sectionLead}>
                Express ideas in standard Python with pandas and vectorbt. Run reproducible simulations locally with visible assumptions.
              </p>
            </FadeInView>
          </div>

          <div className={styles.researchSplit}>
            <ScaleReveal className={styles.codeWindow} delay={0.08}>
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
            </ScaleReveal>

            <ScaleReveal className={styles.evidencePanel} delay={0.16}>
              <p className={styles.evidenceEyebrow}>EVIDENCE INSPECTOR · VERIFIED METRICS</p>
              <StaggerContainer className={styles.evidenceStats} staggerDelay={0.07}>
                <StaggerItem className={styles.statBox}>
                  <span className={styles.statLabel}>SHARPE RATIO</span>
                  <span className={styles.statNumber}>1.84</span>
                  <span className={styles.statFootnote}>365-day crypto calendar · rf=0%</span>
                </StaggerItem>
                <StaggerItem className={styles.statBox}>
                  <span className={styles.statLabel}>SORTINO RATIO</span>
                  <span className={styles.statNumber}>2.31</span>
                  <span className={styles.statFootnote}>Downside deviation only</span>
                </StaggerItem>
                <StaggerItem className={styles.statBox}>
                  <span className={styles.statLabel}>MAX DRAWDOWN</span>
                  <span className={styles.statNumber}>-11.4%</span>
                  <span className={styles.statFootnote}>Peak-to-trough account equity</span>
                </StaggerItem>
                <StaggerItem className={styles.statBox}>
                  <span className={styles.statLabel}>SAMPLE SIZE</span>
                  <span className={styles.statNumber}>N = 142</span>
                  <span className={styles.statFootnote}>56.2% closed-trade win rate</span>
                </StaggerItem>
              </StaggerContainer>

              <FadeInView delay={0.2} yOffset={14} className={styles.assumptionsBox}>
                <p className={styles.assumptionsTitle}>EXPLICIT SIMULATION ASSUMPTIONS</p>
                <ul className={styles.assumptionsList}>
                  <li>Signals at completed-bar close fill at the following open.</li>
                  <li>No fill is manufactured beyond observed dataset liquidity.</li>
                  <li>Open positions marked to market; costs and commissions explicit.</li>
                  <li>Vectorized backtesting via Polars and Monte Carlo remain in active development.</li>
                </ul>
              </FadeInView>
            </ScaleReveal>
          </div>
        </section>

        {/* 06 ORDER FLOW & LOCAL-FIRST ARCHITECTURE */}
        <section className={styles.archSection} aria-labelledby="arch-title">
          <div className={styles.archHeader}>
            <p className={styles.eyebrow}>06 / CLIENT-FIRST ARCHITECTURE</p>
            <MaskedHeading
              as="h2"
              id="arch-title"
              className={styles.sectionHeading}
              lines={[
                { text: "Compute at the edge." },
                { text: "Your machine does the heavy work.", italic: true },
              ]}
            />
            <FadeInView delay={0.12} yOffset={18}>
              <p className={styles.leadText}>
                Traditional SaaS forces market analysis through shared cloud servers, creating network latency, subscription bloat, and compute caps. ZTerminal moves the analytical workload to your local processor and storage.
              </p>
            </FadeInView>
          </div>

          <div className={styles.archFlow}>
            <FadeInView className={styles.archTier} delay={0.08}>
              <div className={styles.tierTag}>SHARED CLOUD LAYER</div>
              <h3 className={styles.tierName}>Server-Light Infrastructure</h3>
              <p className={styles.tierDetail}>Lightweight licensing, user authentication, and shared service metadata. Low bandwidth, minimal central footprint.</p>
              <div className={styles.tierSpecs}>
                <span>AUTH &amp; LICENSES</span>
                <span>METADATA SYNC</span>
                <span>STATUS SIGNALING</span>
              </div>
            </FadeInView>

            <motion.div
              className={styles.archDivider}
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, ease: EASE_OUT_EXPO }}
            >
              <span className={styles.dividerArrow}>↓</span>
              <span className={styles.dividerText}>LOW BANDWIDTH ONLY</span>
            </motion.div>

            <ScaleReveal className={styles.archTierActive} delay={0.14}>
              <div className={styles.tierTagActive}>YOUR WINDOWS WORKSTATION</div>
              <h3 className={styles.tierName}>Native Client Shell (Tauri + Rust)</h3>
              <p className={styles.tierDetail}>Direct NVMe access, multi-threaded CPU parallelization, and zero web sandbox limitations.</p>
              <StaggerContainer className={styles.tierEngines} staggerDelay={0.08} delay={0.12}>
                <StaggerItem className={styles.engineCard}>
                  <h4>DuckDB (SQL)</h4>
                  <p>Local columnar OLAP queries over historical parquet datasets.</p>
                </StaggerItem>
                <StaggerItem className={styles.engineCard}>
                  <h4>Polars (DataFrames)</h4>
                  <p>Zero-copy vectorized strategy simulation on local CPU cores.</p>
                </StaggerItem>
                <StaggerItem className={styles.engineCard}>
                  <h4>Lightweight Charts</h4>
                  <p>Hardware-accelerated GPU canvas rendering of millions of ticks.</p>
                </StaggerItem>
              </StaggerContainer>
            </ScaleReveal>
          </div>
        </section>

        {/* 07 RISK, ALERTS & JOURNAL */}
        <section className={styles.trioSection} aria-labelledby="trio-title">
          <div className={styles.sectionHeaderCentered}>
            <p className={styles.eyebrow}>07 / WORKFLOW CONTINUUM</p>
            <MaskedHeading
              as="h2"
              id="trio-title"
              className={styles.sectionHeading}
              lines={[
                { text: "Risk, alerts, and journaling." },
                { text: "Structured for deliberate execution.", italic: true },
              ]}
            />
          </div>

          <StaggerContainer className={styles.trioGrid} staggerDelay={0.1} delay={0.12}>
            <StaggerItem className={styles.trioJournal}>
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
            </StaggerItem>

            <StaggerItem className={styles.trioAlerts}>
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
            </StaggerItem>

            <StaggerItem className={styles.trioRisk}>
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
            </StaggerItem>
          </StaggerContainer>
        </section>

        {/* 08 LOCAL-FIRST MANIFESTO */}
        <section className={styles.localSection} aria-labelledby="local-title">
          <div className={styles.localContent}>
            <p className={styles.eyebrow}>08 / CLIENT-FIRST PHILOSOPHY</p>
            <ParallaxText fromY={16} toY={-16}>
              <MaskedHeading
                as="h2"
                id="local-title"
                className={styles.hugeTypo}
                lines={[
                  { text: "Adding users should not" },
                  { text: "add servers.", italic: true },
                ]}
              />
            </ParallaxText>
            <FadeInView delay={0.15} yOffset={20} className={styles.localColumns}>
              <p>
                ZTerminal is architected around a simple economic truth: client-side compute is free to host and scales infinitely with each user&apos;s machine.
              </p>
              <p>
                Your strategies, backtests, and proprietary models vectorize on your hardware and write to your local NVMe storage. They never leak into a multi-tenant cloud database.
              </p>
            </FadeInView>
          </div>
        </section>

        {/* 09 PHILOSOPHY */}
        <section className={styles.philosophySection} aria-labelledby="philo-title">
          <div className={styles.philoInner}>
            <p className={styles.eyebrow}>09 / CORE PHILOSOPHY</p>
            <ParallaxText fromY={14} toY={-14}>
              <MaskedHeading
                as="h2"
                id="philo-title"
                className={styles.philoTitle}
                lines={[
                  { text: "Evidence over intuition." },
                  { text: "Robustness over optimization.", italic: true, className: styles.philoEm },
                ]}
              />
            </ParallaxText>
            <motion.div
              className={styles.philoDivider}
              initial={{ scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, ease: EASE_OUT_EXPO, delay: 0.1 }}
            />
            <FadeInView delay={0.18} yOffset={16}>
              <p className={styles.philoSub}>
                A compelling chart is not evidence. A stable strategy with honest limits is infinitely more valuable than an over-fitted backtest.
              </p>
            </FadeInView>
          </div>
        </section>

        {/* 10 NATIVE WINDOWS */}
        <section className={styles.windowsSection} id="windows" aria-labelledby="windows-title">
          <div className={styles.windowsGrid}>
            <div>
              <p className={styles.eyebrow}>10 / WORKSTATION TARGET</p>
              <MaskedHeading
                as="h2"
                id="windows-title"
                className={styles.sectionHeading}
                lines={[
                  { text: "The workstation belongs" },
                  { text: "on bare metal.", italic: true },
                ]}
              />
            </div>
            <div className={styles.windowsCopy}>
              <FadeInView delay={0.08} yOffset={16}>
                <p>
                  ZTerminal is built natively for 64-bit Windows. Desktop research demands direct filesystem access, NVMe throughput, and local hardware concurrency.
                </p>
              </FadeInView>
              <FadeInView delay={0.14} yOffset={16}>
                <p>
                  The desktop client is in active development. Official signed packages, checksums, and release notes are published exclusively through the verified release route.
                </p>
              </FadeInView>
              <FadeInView delay={0.2} yOffset={16} className={styles.windowsActions}>
                <Link className={styles.primaryButton} href="/download">
                  Windows release status <Arrow />
                </Link>
                <Link className={styles.textLink} href="/docs/windows/install">
                  Installation guide <Arrow />
                </Link>
              </FadeInView>
            </div>
          </div>
        </section>

        {/* 11 FINAL CTA */}
        <section className={styles.finalCta} aria-labelledby="final-title">
          <MaskedHeading
            as="h2"
            id="final-title"
            className={styles.finalHeading}
            lines={[
              { text: "See more." },
              { text: "Guess less.", italic: true },
            ]}
          />
          <FadeInView delay={0.14} yOffset={18} className={styles.finalActions}>
            <Link className={styles.primaryButton} href="/download">
              Explore for Windows <Arrow />
            </Link>
            <Link className={styles.secondaryTextLink} href="/terminal">
              Launch web terminal <Arrow />
            </Link>
          </FadeInView>
          <FadeInView delay={0.22} yOffset={14}>
            <p className={styles.finalDisclaimer}>
              Decision support for traders. No broker route. You retain control of execution.
            </p>
          </FadeInView>
        </section>
      </div>

      <PublicFooter />
    </main>
  );
}
