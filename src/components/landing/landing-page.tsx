"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";

import { HeroScene } from "./hero-scene";
import { WorkflowSequence } from "@/components/public/workflow-sequence";
import { PublicFooter } from "@/components/public/public-footer";
import { StickyCanvasShowcase } from "./sticky-canvas-showcase";
import { OrderFlowEngine } from "./order-flow-engine";
import { AmbientTelemetryTicker } from "./vector-motion-graphics";
import {
  MaskedHeading,
  FadeInView,
  ScaleReveal,
  StaggerContainer,
  StaggerItem,
  ParallaxText,
  SpotlightCard,
  CounterReveal,
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

      {/* Ambient High-Frequency Telemetry Stream */}
      <AmbientTelemetryTicker />

      <div className={styles.content}>
        {/* 02 THE QUANTITATIVE EDGE */}
        <section className={styles.problemSection} aria-labelledby="problem-title">
          <div className={styles.problemCopy}>
            <p className={styles.eyebrow}>02 / THE LIQUIDITY ENGINE</p>
            <MaskedHeading
              as="h2"
              id="problem-title"
              className={styles.sectionHeading}
              lines={[
                { text: "Stop chasing lagging indicators." },
                { text: "Trade live market structure.", italic: true },
              ]}
            />
            <FadeInView delay={0.04} yOffset={12}>
              <p className={styles.leadText}>
                Retail charts show where price was. Institutional order flow shows where price is forced to go. ZTerminal decodes resting limit liquidity, aggressive volume delta, and hidden institutional sweeps before the breakout candle prints.
              </p>
            </FadeInView>
            <FadeInView delay={0.08} yOffset={12}>
              <p className={styles.bodyText}>
                Eliminate guesswork. Build algorithmic setups verified against tick-by-tick order books, inspect market microstructure in real time, and deploy risk rules that protect your capital automatically.
              </p>
            </FadeInView>

            <StaggerContainer className={styles.telemetryPills} staggerDelay={0.03} delay={0.08}>
              <StaggerItem>
                <span className={styles.pill}>REGIME: VOLATILITY COMPRESSION</span>
              </StaggerItem>
              <StaggerItem>
                <span className={styles.pill}>ORDER FLOW: AGGRESSIVE BID ABSORPTION (+2.4σ)</span>
              </StaggerItem>
              <StaggerItem>
                <span className={styles.pill}>STATISTICAL EDGE: 86.4% HISTORICAL WIN RATE</span>
              </StaggerItem>
              <StaggerItem>
                <span className={styles.pill}>LATENCY: DIRECT 0.38MS FEED</span>
              </StaggerItem>
            </StaggerContainer>
          </div>

          <ScaleReveal delay={0.06}>
            <SpotlightCard className={styles.problemInspector} spotlightColor="rgba(0, 240, 255, 0.12)">
              <div className={styles.inspectorHeader}>
                <span className={styles.inspectorTitle}>LIVE MICROSTRUCTURE AUDIT · BTC/USDT PERP</span>
                <span className={styles.inspectorStatus}>CONFLUENCE ACTIVE</span>
              </div>
              <StaggerContainer className={styles.inspectorMetrics} staggerDelay={0.03} delay={0.06}>
                <StaggerItem className={styles.metricItem}>
                  <span className={styles.metricLabel}>RESTING BID WALL</span>
                  <span className={styles.metricVal}>$42.8M @ $78,850</span>
                </StaggerItem>
                <StaggerItem className={styles.metricItem}>
                  <span className={styles.metricLabel}>CUMULATIVE DELTA</span>
                  <span className={styles.metricVal}>+1,420 BTC (ABSORPTION)</span>
                </StaggerItem>
                <StaggerItem className={styles.metricItem}>
                  <span className={styles.metricLabel}>VOLATILITY SQUEEZE</span>
                  <span className={styles.metricVal}>98th PERCENTILE</span>
                </StaggerItem>
                <StaggerItem className={styles.metricItem}>
                  <span className={styles.metricLabel}>EXPECTED VALUE (EV)</span>
                  <span className={styles.metricVal}>+2.68R RATIO</span>
                </StaggerItem>
              </StaggerContainer>
              <div className={styles.inspectorRule}>
                <code>
                  SYSTEM RULE: IF volume_delta &gt; 2.2 * std_dev AND bid_absorption == TRUE THEN ARM_BREAKOUT(risk_cap=1.5%) ELSE STAND_DOWN
                </code>
              </div>
            </SpotlightCard>
          </ScaleReveal>
        </section>

        {/* 03 THE WORKFLOW: The Institutional Research Loop */}
        <section className={styles.workflowSection} id="workflow" aria-labelledby="workflow-title">
          <div className={styles.sectionHeaderCentered}>
            <p className={styles.eyebrow}>03 / THE QUANTITATIVE PIPELINE</p>
            <MaskedHeading
              as="h2"
              id="workflow-title"
              className={styles.sectionHeading}
              lines={[
                { text: "From raw tick data" },
                { text: "to mathematically proven alpha.", italic: true },
              ]}
            />
            <FadeInView delay={0.04} yOffset={12}>
              <p className={styles.sectionLead}>
                Hindsight bias destroys trading accounts. ZTerminal replaces gut feelings with a rigorous 6-stage quantitative assembly line that transforms raw market noise into audit-verified execution.
              </p>
            </FadeInView>
          </div>
          <WorkflowSequence />
        </section>

        {/* 04 INTERACTIVE LEVEL 2 ORDER FLOW ENGINE (REPLACES STATIC VIDEO) */}
        <OrderFlowEngine />

        {/* 05 MARKET CONTEXT: Sticky Pinned Interface Showcase */}
        <StickyCanvasShowcase />

        {/* 06 RESEARCH / VALIDATION: Python Research API */}
        <section className={styles.researchSection} aria-labelledby="research-title">
          <div className={styles.sectionHeaderCentered}>
            <p className={styles.eyebrow}>06 / PYTHON STRATEGY LAB</p>
            <MaskedHeading
              as="h2"
              id="research-title"
              className={styles.sectionHeading}
              lines={[
                { text: "Write vectorized Python." },
                { text: "Deploy verified institutional alpha.", italic: true },
              ]}
            />
            <FadeInView delay={0.04} yOffset={12}>
              <p className={styles.sectionLead}>
                No proprietary closed-source scripting toys. Build your strategies in pure Python with pandas, NumPy, and vectorbt. Simulate millions of trades in milliseconds with audit-grade precision and zero look-ahead bias.
              </p>
            </FadeInView>
          </div>

          <div className={styles.researchSplit}>
            <ScaleReveal delay={0.04}>
              <SpotlightCard className={styles.codeWindow} spotlightColor="rgba(168, 85, 247, 0.14)">
                <div className={styles.codeHeader}>
                  <span className={styles.codeFile}>strategy_liquidity_sweep.py</span>
                  <span className={styles.codeLang}>PYTHON QUANT RESEARCH API</span>
                </div>
                <pre className={styles.codeBlock}>
                  <code>
{`import zt
import numpy as np
import pandas as pd

def strategy(market: zt.MarketData) -> zt.Strategy:
    """Vectorized institutional liquidity sweep with CVD filter."""
    liquidity_sweeps = zt.detect_sweeps(market.l2_depth, threshold="2.5x")
    cvd_divergence = zt.cvd_divergence(market.trades, lookback=24)
    
    # High-probability confluence entry
    long_entry = (liquidity_sweeps == "BID_ABSORPTION") & (cvd_divergence > 0)
    risk_invalidation = zt.dynamic_atr_stop(market.close, multiplier=1.5)
    
    return zt.Strategy(
        signals=long_entry,
        stop_loss=risk_invalidation,
        size_model=zt.kelly_criterion(risk_cap=0.015)
    )`}
                  </code>
                </pre>
              </SpotlightCard>
            </ScaleReveal>

            <ScaleReveal delay={0.08}>
              <SpotlightCard className={styles.evidencePanel} spotlightColor="rgba(0, 240, 255, 0.12)">
                <p className={styles.evidenceEyebrow}>AUDIT-GRADE PERFORMANCE VERIFICATION</p>
                <StaggerContainer className={styles.evidenceStats} staggerDelay={0.03} delay={0.04}>
                  <StaggerItem className={styles.statBox}>
                    <span className={styles.statLabel}>SHARPE RATIO</span>
                    <span className={styles.statNumber}>
                      <CounterReveal value={2.14} decimals={2} />
                    </span>
                    <span className={styles.statFootnote}>Institutional risk-adjusted benchmark</span>
                  </StaggerItem>
                  <StaggerItem className={styles.statBox}>
                    <span className={styles.statLabel}>SORTINO RATIO</span>
                    <span className={styles.statNumber}>
                      <CounterReveal value={2.89} decimals={2} />
                    </span>
                    <span className={styles.statFootnote}>Downside risk strictly minimized</span>
                  </StaggerItem>
                  <StaggerItem className={styles.statBox}>
                    <span className={styles.statLabel}>MAX DRAWDOWN</span>
                    <span className={styles.statNumber}>
                      <CounterReveal value={-8.7} decimals={1} suffix="%" />
                    </span>
                    <span className={styles.statFootnote}>Preserves capital during market shocks</span>
                  </StaggerItem>
                  <StaggerItem className={styles.statBox}>
                    <span className={styles.statLabel}>SAMPLE SIZE</span>
                    <span className={styles.statNumber}>
                      <CounterReveal value={384} prefix="N = " />
                    </span>
                    <span className={styles.statFootnote}>64.8% verified win rate · 2.45 profit factor</span>
                  </StaggerItem>
                </StaggerContainer>

                <FadeInView delay={0.08} yOffset={10} className={styles.assumptionsBox}>
                  <p className={styles.assumptionsTitle}>RESEARCH ASSUMPTIONS, MADE EXPLICIT</p>
                  <ul className={styles.assumptionsList}>
                    <li>Sub-bar Bar Magnifier resolves intra-candle fill order down to the millisecond, eliminating unrealistic fill illusions.</li>
                    <li>Strict point-in-time data indexing eliminates look-ahead bias and survivor bias entirely.</li>
                    <li>Realistic exchange taker fees and liquidity-dependent slippage curves applied to every simulated order.</li>
                    <li>Walk-Forward Analysis and Monte Carlo stress audits verify your strategy survives sudden market regime shifts.</li>
                  </ul>
                </FadeInView>
              </SpotlightCard>
            </ScaleReveal>
          </div>
        </section>

        {/* 07 INSTANTANEOUS PERFORMANCE & TOTAL PRIVACY */}
        <section className={styles.archSection} aria-labelledby="arch-title">
          <div className={styles.archHeader}>
            <p className={styles.eyebrow}>07 / HARDWARE SPEED &amp; DATA SOVEREIGNTY</p>
            <MaskedHeading
              as="h2"
              id="arch-title"
              className={styles.sectionHeading}
              lines={[
                { text: "Your bare metal. Your code." },
                { text: "Absolute sovereign power.", italic: true },
              ]}
            />
            <FadeInView delay={0.04} yOffset={12}>
              <p className={styles.leadText}>
                Cloud platforms throttle your CPU, charge recurring monthly rent, and store your confidential trading algorithms on shared servers. ZTerminal unlocks the raw power of your local workstation with zero telemetry, zero data leakage, and zero lag.
              </p>
            </FadeInView>
          </div>

          <div className={styles.archFlow}>
            <FadeInView className={styles.archTier} delay={0.04} yOffset={12}>
              <div className={styles.tierTag}>GLOBAL MARKET DATA PIPELINE</div>
              <h3 className={styles.tierName}>Direct Low-Latency Feed Pipes</h3>
              <p className={styles.tierDetail}>Direct exchange WebSockets, uncompressed order book feeds, and local memory caching with zero dropped packets and sub-millisecond propagation.</p>
              <div className={styles.tierSpecs}>
                <span>DIRECT L2/L3 TICK PIPES</span>
                <span>LOCAL MEMORY CACHING</span>
                <span>ZERO RATE LIMITS</span>
              </div>
            </FadeInView>

            <motion.div
              className={styles.archDivider}
              initial={{ opacity: 0, y: 6 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, ease: EASE_OUT_EXPO }}
            >
              <span className={styles.dividerArrow}>↓</span>
              <span className={styles.dividerText}>BARE-METAL LOCAL EXECUTION</span>
            </motion.div>

            <ScaleReveal className={styles.archTierActive} delay={0.06}>
              <div className={styles.tierTagActive}>LOCAL SOVEREIGN WORKSTATION</div>
              <h3 className={styles.tierName}>Bare-Metal Performance. 100% IP Confidentiality.</h3>
              <p className={styles.tierDetail}>Process millions of rows per second locally. Your proprietary strategy code, account balances, and order history never leave your computer.</p>
              <StaggerContainer className={styles.tierEngines} staggerDelay={0.03} delay={0.06}>
                <StaggerItem className={styles.engineCard}>
                  <h4>Vectorized Compute</h4>
                  <p>Crunch 10+ years of high-frequency tick data in under a second using multi-threaded local CPU &amp; GPU acceleration.</p>
                </StaggerItem>
                <StaggerItem className={styles.engineCard}>
                  <h4>Zero Telemetry Leakage</h4>
                  <p>Your alpha is your intellectual property. ZTerminal operates offline-first with zero strategy tracking or cloud snooping.</p>
                </StaggerItem>
                <StaggerItem className={styles.engineCard}>
                  <h4>60 FPS Native Rendering</h4>
                  <p>Experience silky smooth navigation across complex multi-chart layouts with hardware-accelerated GPU pipelines.</p>
                </StaggerItem>
              </StaggerContainer>
            </ScaleReveal>
          </div>
        </section>

        {/* 08 RISK, ALERTS & JOURNAL */}
        <section className={styles.trioSection} aria-labelledby="trio-title">
          <div className={styles.sectionHeaderCentered}>
            <p className={styles.eyebrow}>08 / CAPITAL DEFENSE &amp; DISCIPLINE</p>
            <MaskedHeading
              as="h2"
              id="trio-title"
              className={styles.sectionHeading}
              lines={[
                { text: "Protect your capital automatically." },
                { text: "Audit every decision.", italic: true },
              ]}
            />
          </div>

          <StaggerContainer className={styles.trioGrid} staggerDelay={0.04} delay={0.06}>
            <StaggerItem style={{ display: "flex", flexDirection: "column", height: "100%" }}>
              <SpotlightCard className={styles.trioJournal} spotlightColor="rgba(168, 85, 247, 0.16)">
                <div className={styles.trioBadge}>01 / SYSTEMATIC JOURNAL</div>
                <h3>Eliminate emotional sabotage</h3>
                <p>Document the thesis, confluence score, and liquidity context before entering the market. Build an unshakeable archive of disciplined, high-expectancy setups.</p>
                <div className={styles.journalNote}>
                  <div className={styles.journalMeta}>
                    <span>BTC/USDT · 5M LIQUIDITY SWEEP</span>
                    <span>18:24 UTC</span>
                  </div>
                  <p className={styles.journalText}>
                    High-volume liquidity sweep below daily low with aggressive bid absorption (+2.4σ CVD). Entering on confirmed 5M close above 79,200 with invalidation at session VWAP.
                  </p>
                  <div className={styles.journalTags}>
                    <span>#systematic</span>
                    <span>#liquidity-sweep</span>
                    <span>#asymmetric-risk</span>
                  </div>
                </div>
              </SpotlightCard>
            </StaggerItem>

            <StaggerItem style={{ display: "flex", flexDirection: "column", height: "100%" }}>
              <SpotlightCard className={styles.trioAlerts} spotlightColor="rgba(0, 240, 255, 0.14)">
                <div className={styles.trioBadge}>02 / REAL-TIME CONFLUENCE ALERTS</div>
                <h3>Never miss an institutional setup</h3>
                <p>Free your eyes from staring at screens all day. Receive instant desktop notifications the moment your quantitative conditions and liquidity confluences align.</p>
                <div className={styles.alertCode}>
                  <div className={styles.alertHeader}>TRIGGER CONDITION</div>
                  <code>
                    IF close &gt; session_vwap<br />
                    AND volume_delta &gt; 2.0 * avg<br />
                    AND sweep_detected == TRUE<br />
                    THEN SIGNAL(&quot;Institutional Long Confluence&quot;)
                  </code>
                </div>
              </SpotlightCard>
            </StaggerItem>

            <StaggerItem style={{ display: "flex", flexDirection: "column", height: "100%" }}>
              <SpotlightCard className={styles.trioRisk} spotlightColor="rgba(255, 77, 106, 0.14)">
                <div className={styles.trioBadge}>03 / AUTOMATED RISK DEFENSE</div>
                <h3>Enforce ruthless risk discipline</h3>
                <p>Professional trading is won on defense. Hardcode algorithmic constraints that prevent revenge trading, over-leveraging, and devastating account drawdowns.</p>
                <div className={styles.riskRules}>
                  <div className={styles.riskItem}>
                    <span>POSITION SIZING</span>
                    <strong>Mathematical fractional Kelly / Fixed % risk per trade</strong>
                  </div>
                  <div className={styles.riskItem}>
                    <span>FRICTION MODELING</span>
                    <strong>Live exchange taker fees and slippage accounted for</strong>
                  </div>
                  <div className={styles.riskItem}>
                    <span>DRAWDOWN CIRCUIT BREAKER</span>
                    <strong>Auto-locks trading if daily drawdown hits 2.5%</strong>
                  </div>
                </div>
              </SpotlightCard>
            </StaggerItem>
          </StaggerContainer>
        </section>

        {/* 09 LOCAL-FIRST MANIFESTO */}
        <section className={styles.localSection} aria-labelledby="local-title">
          <div className={styles.localContent}>
            <p className={styles.eyebrow}>09 / THE SOVEREIGN ADVANTAGE</p>
            <ParallaxText fromY={6} toY={-6}>
              <MaskedHeading
                as="h2"
                id="local-title"
                className={styles.hugeTypo}
                lines={[
                  { text: "Uncapped compute power." },
                  { text: "Zero subscription rent-seeking.", italic: true },
                ]}
              />
            </ParallaxText>
            <FadeInView delay={0.06} yOffset={12} className={styles.localColumns}>
              <p>
                Why pay $100–$300 every single month for web-based charts that lag under volatility, throttle your backtesting speed, and log your private strategies on remote cloud databases?
              </p>
              <p>
                ZTerminal delivers true workstation power. Unlimited high-speed simulations, unthrottled local compute, and 100% proprietary code privacy. Buy once, own your tools, and trade with sovereign independence.
              </p>
            </FadeInView>
          </div>
        </section>

        {/* 10 PHILOSOPHY */}
        <section className={styles.philosophySection} aria-labelledby="philo-title">
          <div className={styles.philoInner}>
            <p className={styles.eyebrow}>10 / THE TRADER&apos;S MANIFESTO</p>
            <ParallaxText fromY={6} toY={-6}>
              <MaskedHeading
                as="h2"
                id="philo-title"
                className={styles.philoTitle}
                lines={[
                  { text: "Evidence over intuition." },
                  { text: "Mathematical edge over hype.", italic: true, className: styles.philoEm },
                ]}
              />
            </ParallaxText>
            <motion.div
              className={styles.philoDivider}
              initial={{ scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, ease: EASE_OUT_EXPO, delay: 0.06 }}
            />
            <FadeInView delay={0.06} yOffset={12}>
              <p className={styles.philoSub}>
                Anyone can cherry-pick a chart pattern with hindsight. Consistent profitability requires verifiable mathematical expectancy, disciplined risk execution, and the humility to respect market structure.
              </p>
            </FadeInView>
          </div>
        </section>

        {/* 11 NATIVE WINDOWS */}
        <section className={styles.windowsSection} id="windows" aria-labelledby="windows-title">
          <div className={styles.windowsGrid}>
            <div>
              <p className={styles.eyebrow}>11 / DEDICATED WORKSTATION</p>
              <MaskedHeading
                as="h2"
                id="windows-title"
                className={styles.sectionHeading}
                lines={[
                  { text: "Engineered for traders" },
                  { text: "who demand serious edge.", italic: true },
                ]}
              />
            </div>
            <div className={styles.windowsCopy}>
              <FadeInView delay={0.04} yOffset={12}>
                <p>
                  Whether running as a dedicated bare-metal Windows workstation or instantly accessible via modern WebGL in any browser, ZTerminal provides the responsive multi-monitor cockpit you need to dominate fast-moving markets.
                </p>
              </FadeInView>
              <FadeInView delay={0.08} yOffset={12}>
                <p>
                  Available as an optimized native Windows release and instant web terminal. Verified cryptographic packages, SHA-256 checksums, and release notes are published on our official release portal.
                </p>
              </FadeInView>
              <FadeInView delay={0.12} yOffset={12} className={styles.windowsActions}>
                <Link className={styles.primaryButton} href="/download">
                  Get ZTerminal for Windows <Arrow />
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
              { text: "Trade with conviction." },
              { text: "Own your edge.", italic: true },
            ]}
          />
          <FadeInView delay={0.04} yOffset={12} className={styles.finalActions}>
            <Link className={styles.primaryButton} href="/download">
              Get ZTerminal for Windows <Arrow />
            </Link>
            <Link className={styles.secondaryTextLink} href="/terminal">
              Launch live web terminal <Arrow />
            </Link>
          </FadeInView>
          <FadeInView delay={0.08} yOffset={10}>
            <p className={styles.finalDisclaimer}>
              Institutional market microstructure. 100% local strategy custody. Zero subscription lock-in.
            </p>
          </FadeInView>
        </section>
      </div>

      <PublicFooter />
    </main>
  );
}
