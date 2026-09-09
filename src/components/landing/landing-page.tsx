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

      {/* 01 HERO VIEWPORT: Responsive 2-column architecture, 3D laptop stage, live undulating particle wave, and cinematic entrance */}
      <HeroScene />

      <div className={styles.content}>
        {/* 02 THE QUANTITATIVE EDGE */}
        <section className={styles.problemSection} aria-labelledby="problem-title">
          <div className={styles.problemCopy}>
            <p className={styles.eyebrow}>02 / THE QUANTITATIVE ADVANTAGE</p>
            <MaskedHeading
              as="h2"
              id="problem-title"
              className={styles.sectionHeading}
              lines={[
                { text: "Strip the noise from the tape." },
                { text: "Trade the structure, not the story.", italic: true },
              ]}
            />
            <FadeInView delay={0.1} yOffset={18}>
              <p className={styles.leadText}>
                Stop losing capital to market noise and emotional guesswork. While retail traders chase lagging indicators and social media hype, elite quantitative traders win by exploiting market structure, institutional liquidity pools, and statistical probability.
              </p>
            </FadeInView>
            <FadeInView delay={0.18} yOffset={18}>
              <p className={styles.bodyText}>
                ZTerminal transforms market chaos into your greatest competitive edge. Spot high-probability setups before the crowd, stress-test your strategy against historical tick data in milliseconds, and trade with absolute mathematical conviction.
              </p>
            </FadeInView>

            <StaggerContainer className={styles.telemetryPills} staggerDelay={0.06} delay={0.22}>
              <StaggerItem>
                <span className={styles.pill}>REGIME: VOLATILITY COMPRESSION</span>
              </StaggerItem>
              <StaggerItem>
                <span className={styles.pill}>STATISTICAL EDGE: 84.2% PROBABILITY</span>
              </StaggerItem>
              <StaggerItem>
                <span className={styles.pill}>ORDER FLOW: INSTITUTIONAL SWEEP</span>
              </StaggerItem>
            </StaggerContainer>
          </div>

          <ScaleReveal className={styles.problemInspector}>
            <div className={styles.inspectorHeader}>
              <span className={styles.inspectorTitle}>LIVE MARKET TELEMETRY · BTC/USDT</span>
              <span className={styles.inspectorStatus}>PRIME SETUP ACTIVE</span>
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
                <span className={styles.metricLabel}>RELATIVE VOLATILITY</span>
                <span className={styles.metricVal}>0.085%</span>
              </StaggerItem>
              <StaggerItem className={styles.metricItem}>
                <span className={styles.metricLabel}>CONVICTION SCORE</span>
                <span className={styles.metricVal}>HIGH (0.84)</span>
              </StaggerItem>
            </StaggerContainer>
            <div className={styles.inspectorRule}>
              <code>
                RULE: IF regime == COMPRESSION AND volume_surge &gt; 1.6 THEN ARM_SETUP ELSE WAIT
              </code>
            </div>
          </ScaleReveal>
        </section>

        {/* 03 THE WORKFLOW: The Institutional Research Loop */}
        <section className={styles.workflowSection} id="workflow" aria-labelledby="workflow-title">
          <div className={styles.sectionHeaderCentered}>
            <p className={styles.eyebrow}>03 / THE WINNING WORKFLOW</p>
            <MaskedHeading
              as="h2"
              id="workflow-title"
              className={styles.sectionHeading}
              lines={[
                { text: "From raw hypothesis" },
                { text: "to verified trading edge.", italic: true },
              ]}
            />
            <FadeInView delay={0.12} yOffset={18}>
              <p className={styles.sectionLead}>
                A battle-tested 6-step loop engineered to turn market ideas into disciplined, scalable profit. Eliminate hesitation, protect capital, and trade with unshakeable consistency.
              </p>
            </FadeInView>
          </div>
          <WorkflowSequence />
        </section>

        {/* 04 MARKET CONTEXT: Real Interface Showcase */}
        <section className={styles.canvasSection} aria-labelledby="canvas-title">
          <div className={styles.canvasIntro}>
            <div>
              <p className={styles.eyebrow}>04 / HIGH-SPEED CANVAS</p>
              <MaskedHeading
                as="h2"
                id="canvas-title"
                className={styles.sectionHeading}
                lines={[{ text: "See the move before it unfolds." }]}
              />
            </div>
            <FadeInView delay={0.1} yOffset={16}>
              <p className={styles.canvasDescription}>
                Experience buttery-smooth 60fps charting engineered for instant market clarity. Spot hidden liquidity pools, session volume profile shifts, and multi-timeframe setups with crystal visual precision.
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
                  BTC / USDT · 5M CANVAS · PERPETUAL · DIRECT L2 FEED
                </div>
                <div className={styles.canvasModeChip}>PRO WORKSTATION</div>
              </div>
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.85, ease: EASE_OUT_EXPO, delay: 0.1 }}
              >
                <Image
                  src="/landing/terminal-screenshot.webp"
                  alt="Full ZTerminal market canvas displaying real Bitcoin price action and indicators"
                  width={3200}
                  height={1800}
                  sizes="(max-width: 900px) 95vw, 85vw"
                  className={styles.canvasImage}
                />
              </motion.div>
            </div>
            <figcaption className={styles.canvasCaption}>
              <span>REAL-TIME ORDER FLOW CANVAS WITH MULTI-TIMEFRAME NAVIGATION</span>
              <span>HIGH-PERFORMANCE CHARTING ENGINE</span>
            </figcaption>
          </ScaleReveal>
        </section>

        {/* 05 RESEARCH / VALIDATION: Python Research API */}
        <section className={styles.researchSection} aria-labelledby="research-title">
          <div className={styles.sectionHeaderCentered}>
            <p className={styles.eyebrow}>05 / STRATEGY LAB</p>
            <MaskedHeading
              as="h2"
              id="research-title"
              className={styles.sectionHeading}
              lines={[
                { text: "Transform ideas into" },
                { text: "mathematical market edge.", italic: true },
              ]}
            />
            <FadeInView delay={0.12} yOffset={16}>
              <p className={styles.sectionLead}>
                Express your trading logic effortlessly in Python, PineScript, or EasyLanguage. Audit historical win rates, risk-adjusted returns, and real market frictions in seconds—giving you the certainty to trade fearlessly.
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
              <p className={styles.evidenceEyebrow}>AUDIT-GRADE PERFORMANCE VERIFICATION</p>
              <StaggerContainer className={styles.evidenceStats} staggerDelay={0.07}>
                <StaggerItem className={styles.statBox}>
                  <span className={styles.statLabel}>SHARPE RATIO</span>
                  <span className={styles.statNumber}>1.84</span>
                  <span className={styles.statFootnote}>Risk-adjusted institutional benchmark</span>
                </StaggerItem>
                <StaggerItem className={styles.statBox}>
                  <span className={styles.statLabel}>SORTINO RATIO</span>
                  <span className={styles.statNumber}>2.31</span>
                  <span className={styles.statFootnote}>Downside risk strictly controlled</span>
                </StaggerItem>
                <StaggerItem className={styles.statBox}>
                  <span className={styles.statLabel}>MAX DRAWDOWN</span>
                  <span className={styles.statNumber}>-11.4%</span>
                  <span className={styles.statFootnote}>Preserves capital during market shocks</span>
                </StaggerItem>
                <StaggerItem className={styles.statBox}>
                  <span className={styles.statLabel}>SAMPLE SIZE</span>
                  <span className={styles.statNumber}>N = 142</span>
                  <span className={styles.statFootnote}>56.2% verified win rate · 2.1 profit factor</span>
                </StaggerItem>
              </StaggerContainer>

              <FadeInView delay={0.2} yOffset={14} className={styles.assumptionsBox}>
                <p className={styles.assumptionsTitle}>WHY ZTERMINAL STRATEGIES WIN IN LIVE MARKETS</p>
                <ul className={styles.assumptionsList}>
                  <li>Sub-bar Bar Magnifier resolves intra-candle fill order down to the second—eliminating unrealistic backtest illusions.</li>
                  <li>Strict zero look-ahead indexing guarantees what worked in your simulation works with real money.</li>
                  <li>Dynamic exchange fees and slippage modeling reflect true market liquidity and realistic fills.</li>
                  <li>Walk-Forward Analysis and Monte Carlo stress audits verify your strategy survives sudden market regime shifts.</li>
                </ul>
              </FadeInView>
            </ScaleReveal>
          </div>
        </section>

        {/* 06 INSTANTANEOUS PERFORMANCE & TOTAL PRIVACY */}
        <section className={styles.archSection} aria-labelledby="arch-title">
          <div className={styles.archHeader}>
            <p className={styles.eyebrow}>06 / UNCOMPROMISED SPEED &amp; PRIVACY</p>
            <MaskedHeading
              as="h2"
              id="arch-title"
              className={styles.sectionHeading}
              lines={[
                { text: "Blistering speed." },
                { text: "Total strategy secrecy.", italic: true },
              ]}
            />
            <FadeInView delay={0.12} yOffset={18}>
              <p className={styles.leadText}>
                Why wait in sluggish cloud server queues or expose your valuable trading strategies to third-party databases? ZTerminal gives you instantaneous calculations, seamless 60fps charting, and complete privacy for your proprietary alpha.
              </p>
            </FadeInView>
          </div>

          <div className={styles.archFlow}>
            <FadeInView className={styles.archTier} delay={0.08}>
              <div className={styles.tierTag}>GLOBAL MARKET DATA PIPELINE</div>
              <h3 className={styles.tierName}>Low-Latency Market Feeds</h3>
              <p className={styles.tierDetail}>Direct institutional exchange feeds, real-time depth synchronization, and instant workspace updates with zero lag and zero dropped ticks.</p>
              <div className={styles.tierSpecs}>
                <span>DIRECT L2/L3 TICK FEEDS</span>
                <span>REAL-TIME DEPTH SYNC</span>
                <span>ZERO BOTTLENECK</span>
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
              <span className={styles.dividerText}>INSTANTANEOUS EXECUTION</span>
            </motion.div>

            <ScaleReveal className={styles.archTierActive} delay={0.14}>
              <div className={styles.tierTagActive}>INSTITUTIONAL PERFORMANCE ENGINE</div>
              <h3 className={styles.tierName}>Sub-Second Speed. Absolute Confidentiality.</h3>
              <p className={styles.tierDetail}>Fly through complex simulations and massive market datasets in milliseconds. Your private strategies and algorithms never leave your custody.</p>
              <StaggerContainer className={styles.tierEngines} staggerDelay={0.08} delay={0.12}>
                <StaggerItem className={styles.engineCard}>
                  <h4>Instant Simulations</h4>
                  <p>Analyze decades of high-frequency tick data in milliseconds with lightning-fast vectorized calculations.</p>
                </StaggerItem>
                <StaggerItem className={styles.engineCard}>
                  <h4>Unlimited Optimization</h4>
                  <p>Explore thousands of strategy variations simultaneously without waiting or server rate limits.</p>
                </StaggerItem>
                <StaggerItem className={styles.engineCard}>
                  <h4>Fluid 60fps Canvas</h4>
                  <p>Pan across millions of price candles seamlessly with buttery smooth, effortless responsiveness.</p>
                </StaggerItem>
              </StaggerContainer>
            </ScaleReveal>
          </div>
        </section>

        {/* 07 RISK, ALERTS & JOURNAL */}
        <section className={styles.trioSection} aria-labelledby="trio-title">
          <div className={styles.sectionHeaderCentered}>
            <p className={styles.eyebrow}>07 / CAPITAL PRESERVATION &amp; DISCIPLINE</p>
            <MaskedHeading
              as="h2"
              id="trio-title"
              className={styles.sectionHeading}
              lines={[
                { text: "Protect capital automatically." },
                { text: "Audit every decision.", italic: true },
              ]}
            />
          </div>

          <StaggerContainer className={styles.trioGrid} staggerDelay={0.1} delay={0.12}>
            <StaggerItem className={styles.trioJournal}>
              <div className={styles.trioBadge}>01 / SYSTEMATIC JOURNAL</div>
              <h3>Conquer emotional trading</h3>
              <p>Lock in the reasoning behind every setup before placing an order. Build an undeniable track record of disciplined, profitable habits.</p>
              <div className={styles.journalNote}>
                <div className={styles.journalMeta}>
                  <span>BTC/USDT · 5M BREAKOUT</span>
                  <span>18:24 UTC</span>
                </div>
                <p className={styles.journalText}>
                  High-volume expansion following a 2-hour compression band. Entering on confirmed candle close above 79,200 with strict invalidation at session VWAP.
                </p>
                <div className={styles.journalTags}>
                  <span>#systematic</span>
                  <span>#breakout</span>
                  <span>#risk-managed</span>
                </div>
              </div>
            </StaggerItem>

            <StaggerItem className={styles.trioAlerts}>
              <div className={styles.trioBadge}>02 / HIGH-CONVICTION ALERTS</div>
              <h3>Never miss high-probability setups</h3>
              <p>Step away from the screen without missing a beat. Get notified the second your quantitative conditions and liquidity confluence strike.</p>
              <div className={styles.alertCode}>
                <div className={styles.alertHeader}>TRIGGER CONDITION</div>
                <code>
                  IF close &gt; 79,167<br />
                  AND volume &gt; 1.5 * vol_ma20<br />
                  AND rsi &lt; 65<br />
                  THEN SIGNAL(&quot;High-Conviction Breakout&quot;)
                </code>
              </div>
            </StaggerItem>

            <StaggerItem className={styles.trioRisk}>
              <div className={styles.trioBadge}>03 / CAPITAL DEFENSE</div>
              <h3>Automate risk discipline</h3>
              <p>Professional trading is capital defense first. Hardcode risk boundaries that stop drawdowns in their tracks before they hurt your balance.</p>
              <div className={styles.riskRules}>
                <div className={styles.riskItem}>
                  <span>POSITION SIZING</span>
                  <strong>Systematic capital allocation · Zero emotional tilt</strong>
                </div>
                <div className={styles.riskItem}>
                  <span>REALISTIC FRICTIONS</span>
                  <strong>Live exchange fee &amp; slippage deductions applied</strong>
                </div>
                <div className={styles.riskItem}>
                  <span>RISK LIMIT</span>
                  <strong>Strict 1.5% maximum capital risk per trade</strong>
                </div>
              </div>
            </StaggerItem>
          </StaggerContainer>
        </section>

        {/* 08 LOCAL-FIRST MANIFESTO */}
        <section className={styles.localSection} aria-labelledby="local-title">
          <div className={styles.localContent}>
            <p className={styles.eyebrow}>08 / THE ZTERMINAL ADVANTAGE</p>
            <ParallaxText fromY={16} toY={-16}>
              <MaskedHeading
                as="h2"
                id="local-title"
                className={styles.hugeTypo}
                lines={[
                  { text: "Uncapped performance." },
                  { text: "Zero subscription gouging.", italic: true },
                ]}
              />
            </ParallaxText>
            <FadeInView delay={0.15} yOffset={20} className={styles.localColumns}>
              <p>
                Why pay hundreds every month for cloud platforms that throttle your compute, queue your backtests, and store your proprietary strategies on their shared servers?
              </p>
              <p>
                ZTerminal liberates your trading. Enjoy unlimited backtesting, sub-second responsiveness, and complete IP privacy. Your alpha belongs to you—unrestricted, unmetered, and sovereign.
              </p>
            </FadeInView>
          </div>
        </section>

        {/* 09 PHILOSOPHY */}
        <section className={styles.philosophySection} aria-labelledby="philo-title">
          <div className={styles.philoInner}>
            <p className={styles.eyebrow}>09 / THE TRADER&apos;S CODE</p>
            <ParallaxText fromY={14} toY={-14}>
              <MaskedHeading
                as="h2"
                id="philo-title"
                className={styles.philoTitle}
                lines={[
                  { text: "Evidence over intuition." },
                  { text: "Robustness over curve-fitting.", italic: true, className: styles.philoEm },
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
                Anyone can make a strategy look good on yesterday&apos;s chart. Enduring profitability comes from trading proven market mechanics designed to withstand live volatility.
              </p>
            </FadeInView>
          </div>
        </section>

        {/* 10 NATIVE WINDOWS */}
        <section className={styles.windowsSection} id="windows" aria-labelledby="windows-title">
          <div className={styles.windowsGrid}>
            <div>
              <p className={styles.eyebrow}>10 / PROFESSIONAL WORKSTATION</p>
              <MaskedHeading
                as="h2"
                id="windows-title"
                className={styles.sectionHeading}
                lines={[
                  { text: "Engineered for" },
                  { text: "serious traders.", italic: true },
                ]}
              />
            </div>
            <div className={styles.windowsCopy}>
              <FadeInView delay={0.08} yOffset={16}>
                <p>
                  Experience the gold standard in quantitative trading software. ZTerminal delivers fluid multi-monitor layouts, instantaneous workspace switching, and high-frequency data feeds optimized for serious traders.
                </p>
              </FadeInView>
              <FadeInView delay={0.14} yOffset={16}>
                <p>
                  Available as a native Windows release and instant web terminal. Verified cryptographic packages, checksums, and update notes are published on our official release portal.
                </p>
              </FadeInView>
              <FadeInView delay={0.2} yOffset={16} className={styles.windowsActions}>
                <Link className={styles.primaryButton} href="/download">
                  Explore for Windows <Arrow />
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
              Institutional decision support for quantitative traders. Zero broker lock-in. Complete capital sovereignty.
            </p>
          </FadeInView>
        </section>
      </div>

      <PublicFooter />
    </main>
  );
}
