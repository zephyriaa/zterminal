"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { PublicHeader } from "@/components/public/public-header";
import { PublicFooter } from "@/components/public/public-footer";
import { HeroLaptop } from "./HeroLaptop";
import {
  MaskedHeading,
  FadeInView,
  ScaleReveal,
  StaggerContainer,
  StaggerItem,
} from "./motion-primitives";
import {
  BackgroundField,
  TechnicalEyebrow,
  CTAButton,
  ProductWindow,
  StatusBadge,
  CodeSurface,
} from "@/components/public/public-primitives";
import styles from "./landing.module.css";

// ─────────────────────────────────────────────────────────────────────────────
// AUTHENTIC REPOSITORY CODE EXAMPLES (Ground Truth: src/lib/local-research)
// ─────────────────────────────────────────────────────────────────────────────

const CODE_EXAMPLE_REAL = `# Educational strategy example from ZTerminal Research API
import zterminal as zt

def strategy(data, params):
    fast = zt.ema(data.close, int(params.get("fast", 9)))
    slow = zt.ema(data.close, int(params.get("slow", 21)))
    return zt.Strategy(
        entries=zt.crossover(fast, slow),
        exits=zt.crossunder(fast, slow),
        plots={"Fast EMA": fast, "Slow EMA": slow},
    )`;

const RESEARCH_LOOP_CARDS = [
  {
    num: "01",
    label: "Observe",
    tag: "MICROSTRUCTURE OBSERVATION",
    title: "Spot order flow anomalies without leaving the canvas.",
    description:
      "A depth imbalance or volume cluster becomes an empirical observation to interrogate, not an emotional signal to chase.",
    rule: "Observed market events are indexed with UTC timestamps and exchange identifiers.",
  },
  {
    num: "02",
    label: "Formulate",
    tag: "HYPOTHESIS SPECIFICATION",
    title: "Frame a testable quantitative hypothesis.",
    description:
      "State explicit entry conditions, holding horizons, and invalidation rules before touching historical data. Keep the question rigorous.",
    rule: "Null hypothesis and observation parameters are locked before simulation.",
  },
  {
    num: "03",
    label: "Code",
    tag: "PORTABLE PYTHON 3.11+",
    title: "Express rules in standard, portable Python.",
    description:
      "Author strategy functions with familiar pandas and NumPy methods using the zterminal SDK. No proprietary scripting languages or closed-box compilers.",
    rule: "Code runs locally on your CPU against verifiable environment manifests.",
  },
  {
    num: "04",
    label: "Test",
    tag: "VECTORIZED SIMULATION",
    title: "Run backtests against observed historical data.",
    description:
      "Simulate fills with explicit taker/maker fee schedules, slippage penalties, and timestamp alignment to prevent future lookahead leaks.",
    rule: "Every trade execution is recorded with exact bar timestamp alignment.",
  },
  {
    num: "05",
    label: "Inspect",
    tag: "EMPIRICAL SCRUTINY",
    title: "Examine drawdowns, recovery tails, and friction.",
    description:
      "Scrutinize profit factor, Sharpe and Sortino ratios, maximum drawdown duration, and Monte Carlo bootstrap resamples to detect curve-fitting.",
    rule: "Historical test results are hypothetical models and not financial forecasts.",
  },
  {
    num: "06",
    label: "Refine",
    tag: "HASHED RUN RECORDS",
    title: "Accept, iterate, or archive with explicit run records.",
    description:
      "Keep or reject the thesis based on evidence. Completed runs are preserved with input parameters, code hash, and dataset versioning.",
    rule: "Hashed run record logged with parameters and dataset hash.",
  },
];

export default function ZTerminalLanding() {
  const [surface2Tab, setSurface2Tab] = useState<"ui" | "code">("ui");

  return (
    <div className={`${styles.page} publicScope`}>
      <BackgroundField />
      <PublicHeader />

      <main className={styles.content}>
        {/* ================================================================= */}
        {/* BEAT 01: HERO WITH RESTORED WORKSTATION MATCHING REFERENCE        */}
        {/* ================================================================= */}
        <section className={styles.hero} aria-labelledby="hero-heading">
          <div className={`${styles.heroContainer} ${styles.container}`}>
            <div className={styles.heroGrid}>
              <div className={styles.heroContent}>
                <FadeInView delay={0.08} yOffset={8} triggerOnMount>
                  <p className={styles.heroEyebrow}>
                    RESEARCH, WITHOUT THE GUESSWORK
                  </p>
                </FadeInView>

                <MaskedHeading
                  as="h1"
                  id="hero-heading"
                  className={styles.heroTitle}
                  triggerOnMount
                  delay={0.16}
                  stagger={0.14}
                  lines={[
                    {
                      content: <span style={{ whiteSpace: "nowrap" }}>Turn market ideas</span>,
                    },
                    {
                      content: (
                        <span>
                          into{" "}
                          <em className={styles.heroEvidence}>evidence.</em>
                        </span>
                      ),
                    },
                  ]}
                />

                <FadeInView delay={0.32} yOffset={10} triggerOnMount>
                  <p className={styles.heroLead}>
                    Explore live markets, build Python strategies,{" "}
                    <br className={styles.hideMobile} />
                    and test every assumption in one local-first{" "}
                    <br className={styles.hideMobile} />
                    workspace.
                  </p>
                </FadeInView>

                <FadeInView delay={0.44} yOffset={12} triggerOnMount className={styles.heroActions}>
                  <Link href="/terminal" className={styles.heroPrimaryCta}>
                    <span>Start researching</span>
                    <span className={styles.heroArrow} aria-hidden="true">→</span>
                  </Link>
                  <a href="#research-loop" className={styles.heroSecondaryCta}>
                    <span>Explore the workflow</span>
                    <span className={styles.heroArrow} aria-hidden="true">→</span>
                  </a>
                </FadeInView>
              </div>

              {/* RESTORED PHOTOREALISTIC WORKSTATION MATCHING REFERENCE */}
              <div className={styles.heroStage} aria-label="ZTerminal workstation showing authentic terminal interface">
                <HeroLaptop />
              </div>
            </div>
          </div>
        </section>

        {/* ================================================================= */}
        {/* BEAT 02: RESEARCH THESIS & TENETS                                 */}
        {/* ================================================================= */}
        <section className={`${styles.tenetsSection} ${styles.container}`} aria-labelledby="tenets-heading">
          <FadeInView className={styles.tenetsHeader}>
            <TechnicalEyebrow>WHY ZTERMINAL</TechnicalEyebrow>
            <h2 id="tenets-heading" className={styles.tenetsStatement}>
              Most trading research is fragmented.<br />
              <em>ZTerminal unifies the loop.</em>
            </h2>
            <p className={styles.tenetsLead}>
              Moving between charting software, standalone Python scripts, and untrusted spreadsheets
              breaks analytical focus. ZTerminal integrates market observation, strategy authoring,
              simulation, and trade inspection into one local-first workspace.
            </p>
          </FadeInView>

          <StaggerContainer className={styles.tenetsGrid}>
            <StaggerItem>
              <article className={styles.tenetItem}>
                <span className={styles.tenetIndex}>01 / UNIFIED WORKFLOW</span>
                <h3 className={styles.tenetTitle}>Direct Exchange Streams</h3>
                <p className={styles.tenetDescription}>
                  Connect directly to public exchange feeds (Binance, Bybit, Coinbase, OKX, Gate.io).
                  Inspect candlestick history, tick trades, and order book depth without synthetic alterations.
                </p>
              </article>
            </StaggerItem>

            <StaggerItem>
              <article className={styles.tenetItem}>
                <span className={styles.tenetIndex}>02 / STANDARD PYTHON</span>
                <h3 className={styles.tenetTitle}>Standard Python 3.11+ SDK</h3>
                <p className={styles.tenetDescription}>
                  Author strategies using standard Python. Write portable functions with pandas and
                  NumPy, executing locally on your CPU with explicit parameters and zero black boxes.
                </p>
              </article>
            </StaggerItem>

            <StaggerItem>
              <article className={styles.tenetItem}>
                <span className={styles.tenetIndex}>03 / TRACEABLE PROOF</span>
                <h3 className={styles.tenetTitle}>Cryptographic Run Records</h3>
                <p className={styles.tenetDescription}>
                  Every strategy run records explicit slippage, fee, and timing assumptions. Completed
                  runs are stored locally with SHA-256 provenance hashes for repeatable audit.
                </p>
              </article>
            </StaggerItem>
          </StaggerContainer>
        </section>

        {/* ================================================================= */}
        {/* BEAT 03: THE RESEARCH LOOP (Continuous Editorial System Flow)     */}
        {/* ================================================================= */}
        <section
          id="research-loop"
          className={`${styles.loopSection} ${styles.container}`}
          aria-labelledby="loop-heading"
        >
          <FadeInView className={styles.loopHeader}>
            <TechnicalEyebrow>THE RESEARCH METHODOLOGY</TechnicalEyebrow>
            <h2 id="loop-heading" className={styles.loopTitle}>
              From market observation to tested thesis,<br />
              <em>without breaking context.</em>
            </h2>
          </FadeInView>

          {/* Continuous System Track */}
          <div className={styles.loopRail} aria-hidden="true">
            {RESEARCH_LOOP_CARDS.map((card, idx) => (
              <div key={card.num} className={styles.loopRailNode}>
                <b>{card.num}</b> {card.label.toUpperCase()}
                {idx < RESEARCH_LOOP_CARDS.length - 1 && <span className={styles.loopRailArrow}>→</span>}
              </div>
            ))}
          </div>

          {/* Continuous Editorial Progression */}
          <StaggerContainer className={styles.loopGrid}>
            {RESEARCH_LOOP_CARDS.map((card) => (
              <StaggerItem key={card.num}>
                <article className={styles.loopStage}>
                  <div>
                    <div className={styles.loopStageTop}>
                      <span className={styles.loopStageNum}>{card.num} / 06</span>
                      <span className={styles.loopStageTag}>{card.label}</span>
                    </div>
                    <h3 className={styles.loopStageTitle}>{card.title}</h3>
                    <p className={styles.loopStageDesc}>{card.description}</p>
                  </div>
                  <div className={styles.loopStageRule}>
                    <strong>RULE:</strong> {card.rule}
                  </div>
                </article>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </section>

        {/* ================================================================= */}
        {/* BEAT 04: AUTHENTIC PRODUCT SURFACES (Actual ZTerminal Screens)     */}
        {/* ================================================================= */}
        <section className={`${styles.surfacesSection} ${styles.container}`} aria-labelledby="surfaces-heading">
          {/* Surface 01: Market Canvas & Depth */}
          <div className={styles.surfaceMoment}>
            <FadeInView className={styles.surfaceMomentCopy}>
              <TechnicalEyebrow>SURFACE / 01</TechnicalEyebrow>
              <h2 id="surfaces-heading" className={styles.surfaceTitle}>
                High-density market canvas.<br />
                <em>Continuous context across horizons.</em>
              </h2>
              <p className={styles.surfaceLead}>
                Monitor price action, depth profile, recent trades, and indicators within
                one unified docking workspace.
              </p>
              <ul className={styles.surfaceFeatureList}>
                <li className={styles.surfaceFeatureItem}>
                  <span className={styles.surfaceCheck} aria-hidden="true">✓</span>
                  <span><strong>Multi-Chart Docking:</strong> Arrange multiple instruments and timeframes without modal windows.</span>
                </li>
                <li className={styles.surfaceFeatureItem}>
                  <span className={styles.surfaceCheck} aria-hidden="true">✓</span>
                  <span><strong>Order Book Depth:</strong> Inspect real-time bid/ask distribution and liquidity imbalance.</span>
                </li>
                <li className={styles.surfaceFeatureItem}>
                  <span className={styles.surfaceCheck} aria-hidden="true">✓</span>
                  <span><strong>Focused Contrast:</strong> Designed for long research sessions with disciplined, restrained contrast.</span>
                </li>
              </ul>
            </FadeInView>

            <ScaleReveal className={styles.surfaceMomentVisual}>
              <ProductWindow
                title="ZTerminal / Market Canvas"
                readout="LIVE CANDLESTICK ENGINE · REAL TICK FEEDS"
              >
                <div className={styles.surfaceScreenshotFrame}>
                  <Image
                    src="/landing/product-market-chart.png"
                    alt="Authentic ZTerminal Market Canvas showing real candlestick chart, moving averages, and depth telemetry"
                    width={1920}
                    height={1080}
                    className={styles.surfaceScreenshotImage}
                    priority={false}
                  />
                  <div className={styles.surfaceTelemetryStrip}>
                    <span className={styles.surfaceTelemetryActive}>
                      <span className={styles.surfaceTelemetryDot} aria-hidden="true" />
                      DIRECT EXCHANGE FEED CONNECTED
                    </span>
                    <span>NQ · 5M · 8,641 BARS LOADED</span>
                  </div>
                </div>
              </ProductWindow>
            </ScaleReveal>
          </div>

          {/* Surface 02: Python Research API */}
          <div className={`${styles.surfaceMoment} ${styles.surfaceMomentReverse}`}>
            <FadeInView className={styles.surfaceMomentCopy}>
              <TechnicalEyebrow>SURFACE / 02</TechnicalEyebrow>
              <h2 className={styles.surfaceTitle}>
                Python Strategy Developer.<br />
                <em>Standard libraries, local execution.</em>
              </h2>
              <p className={styles.surfaceLead}>
                Write strategies using standard Python. The local helper runs the code on your
                own machine under your operating system permissions.
              </p>
              <ul className={styles.surfaceFeatureList}>
                <li className={styles.surfaceFeatureItem}>
                  <span className={styles.surfaceCheck} aria-hidden="true">✓</span>
                  <span><strong>Direct Python Syntax:</strong> Return entry and exit signals using familiar pandas series logic.</span>
                </li>
                <li className={styles.surfaceFeatureItem}>
                  <span className={styles.surfaceCheck} aria-hidden="true">✓</span>
                  <span><strong>Native Performance:</strong> Computations run directly on your CPU without cloud compilation lag.</span>
                </li>
                <li className={styles.surfaceFeatureItem}>
                  <span className={styles.surfaceCheck} aria-hidden="true">✓</span>
                  <span><strong>Local Execution:</strong> Strategy scripts execute through the paired local helper on your hardware.</span>
                </li>
              </ul>
            </FadeInView>

            <ScaleReveal className={styles.surfaceMomentVisual}>
              <div className={styles.surfaceToggleTabs}>
                <button
                  type="button"
                  className={`${styles.surfaceTabButton} ${surface2Tab === "ui" ? styles.surfaceTabButtonActive : ""}`}
                  onClick={() => setSurface2Tab("ui")}
                >
                  Workbench View
                </button>
                <button
                  type="button"
                  className={`${styles.surfaceTabButton} ${surface2Tab === "code" ? styles.surfaceTabButtonActive : ""}`}
                  onClick={() => setSurface2Tab("code")}
                >
                  Python SDK Snippet
                </button>
              </div>

              {surface2Tab === "ui" ? (
                <ProductWindow
                  title="ZTerminal / Strategy Builder"
                  readout="PYTHON 3.11+ · PARAMETER MATRIX · DIAGNOSTICS"
                >
                  <div className={styles.surfaceScreenshotFrame}>
                    <Image
                      src="/landing/product-strategy-builder.png"
                      alt="Authentic ZTerminal Strategy Builder interface showing code editor, configuration inputs, and compilation status"
                      width={1920}
                      height={1080}
                      className={styles.surfaceScreenshotImage}
                      priority={false}
                    />
                    <div className={styles.surfaceTelemetryStrip}>
                      <span className={styles.surfaceTelemetryActive}>
                        <span className={styles.surfaceTelemetryDot} aria-hidden="true" />
                        LOCAL RUNTIME VERIFIED · 0 ERRORS
                      </span>
                      <span>EMA CROSS + VWAP FILTER · SIMULATED</span>
                    </div>
                  </div>
                </ProductWindow>
              ) : (
                <CodeSurface
                  filename="strategy_ema_crossover.py"
                  runtime="PYTHON 3.11+ / LOCAL ENGINE"
                  code={CODE_EXAMPLE_REAL}
                />
              )}
            </ScaleReveal>
          </div>

          {/* Surface 03: Vectorized Backtester & Scrutiny */}
          <div className={styles.surfaceMoment}>
            <FadeInView className={styles.surfaceMomentCopy}>
              <TechnicalEyebrow>SURFACE / 03</TechnicalEyebrow>
              <h2 className={styles.surfaceTitle}>
                Evidence over optimism.<br />
                <em>Explicit friction assumptions.</em>
              </h2>
              <p className={styles.surfaceLead}>
                Backtest results are only as good as their friction assumptions. ZTerminal enforces
                explicit fee and slippage penalties and surfaces drawdown duration.
              </p>
              <ul className={styles.surfaceFeatureList}>
                <li className={styles.surfaceFeatureItem}>
                  <span className={styles.surfaceCheck} aria-hidden="true">✓</span>
                  <span><strong>Friction Modeling:</strong> Taker/maker fees and spread crossing penalties configured per run.</span>
                </li>
                <li className={styles.surfaceFeatureItem}>
                  <span className={styles.surfaceCheck} aria-hidden="true">✓</span>
                  <span><strong>Drawdown Duration:</strong> Track recovery times alongside peak-to-trough decline metrics.</span>
                </li>
                <li className={styles.surfaceFeatureItem}>
                  <span className={styles.surfaceCheck} aria-hidden="true">✓</span>
                  <span><strong>Verifiable Runs:</strong> Every simulated execution preserved with input hashes and trade logs.</span>
                </li>
              </ul>
            </FadeInView>

            <ScaleReveal className={styles.surfaceMomentVisual}>
              <ProductWindow
                title="ZTerminal / Vectorized Backtester"
                readout="EQUITY CURVE · PERFORMANCE TELEMETRY · 103 TRADES"
              >
                <div className={styles.surfaceScreenshotFrame}>
                  <Image
                    src="/landing/product-backtester.png"
                    alt="Authentic ZTerminal Backtester showing equity curve, Sharpe 3.03, profit factor 14.35, and trade distribution"
                    width={1920}
                    height={1080}
                    className={styles.surfaceScreenshotImage}
                    priority={false}
                  />
                  <div className={styles.surfaceTelemetryStrip}>
                    <span className={styles.surfaceTelemetryActive}>
                      <span className={styles.surfaceTelemetryDot} aria-hidden="true" />
                      PROFIT FACTOR: 14.35 · SHARPE: 3.03
                    </span>
                    <span>NET PROFIT: +$43,515 (+43.27%)</span>
                  </div>
                </div>
              </ProductWindow>
            </ScaleReveal>
          </div>
        </section>

        {/* ================================================================= */}
        {/* BEAT 05: LOCAL EXECUTION & WINDOWS ARCHITECTURE                   */}
        {/* ================================================================= */}
        <section className={`${styles.localWindowsSection} ${styles.container}`} aria-labelledby="boundary-heading">
          <FadeInView className={styles.sectionHeader}>
            <TechnicalEyebrow>EXECUTION BOUNDARY &amp; AVAILABILITY</TechnicalEyebrow>
            <h2 id="boundary-heading" className={styles.sectionTitle}>
              Local execution at the core.<br />
              <em>The web, within reach.</em>
            </h2>
            <p className={styles.sectionLead}>
              The browser is where you inspect markets and draft strategies. Python strategy code executes through the paired local helper on your machine rather than on the ZTerminal web server.
            </p>
          </FadeInView>

          <StaggerContainer className={styles.localWindowsGrid}>
            {/* Card 1: Two Environment Boundary */}
            <StaggerItem>
              <div className={styles.boundaryCard}>
                <div>
                  <div className={styles.boundaryCardHeader}>
                    <span className={styles.dataLabel}>EXECUTION BOUNDARY</span>
                    <StatusBadge showDot={false}>SESSION-PAIRED</StatusBadge>
                  </div>
                  <h3 className={styles.boundaryCardTitle}>Browser vs. Local Helper</h3>
                  <p className={styles.boundaryCardDesc}>
                    Web sessions pair with the local helper on 127.0.0.1 via an ephemeral 8-digit code.
                    Python strategy code executes through the local helper process on the user&apos;s machine rather than on the ZTerminal web server.
                  </p>
                </div>

                <div className={styles.specRowList}>
                  <div className={styles.specRow}>
                    <span>Browser Role</span>
                    <strong>Market inspection &amp; interface</strong>
                  </div>
                  <div className={styles.specRow}>
                    <span>Local Helper Role</span>
                    <strong>Python execution on 127.0.0.1</strong>
                  </div>
                  <div className={styles.specRow}>
                    <span>Pairing Token</span>
                    <strong>Session memory only (no stored secrets)</strong>
                  </div>
                  <div className={styles.specRow}>
                    <span>Architecture Guide</span>
                    <Link href="/docs/python-research" className={styles.linkInline}>
                      Read Python API architecture ↗
                    </Link>
                  </div>
                </div>
              </div>
            </StaggerItem>

            {/* Card 2: Windows Release Status */}
            <StaggerItem>
              <div className={styles.boundaryCard}>
                <div>
                  <div className={styles.boundaryCardHeader}>
                    <span className={styles.dataLabel}>OFFICIAL AVAILABILITY</span>
                    <StatusBadge>PRE-RELEASE VERIFICATION</StatusBadge>
                  </div>
                  <h3 className={styles.boundaryCardTitle}>Signed Windows Release</h3>
                  <p className={styles.boundaryCardDesc}>
                    The official signed public installer is in preparation. ZTerminal will not
                    distribute unverified binaries. Checksums and code signing will be published upon release.
                  </p>
                </div>

                <div className={styles.specRowList}>
                  <div className={styles.specRow}>
                    <span>Target OS</span>
                    <strong>Windows 11 &amp; 10 (x64)</strong>
                  </div>
                  <div className={styles.specRow}>
                    <span>Packaging Target</span>
                    <strong>Signed MSIX / NSIS Package</strong>
                  </div>
                  <div className={styles.specRow}>
                    <span>Integrity Verification</span>
                    <strong>Published SHA-256 Checksum</strong>
                  </div>
                  <div className={styles.specRow}>
                    <span>Installation Guide</span>
                    <Link href="/download" className={styles.linkInline}>
                      View Windows release status ↗
                    </Link>
                  </div>
                </div>
              </div>
            </StaggerItem>
          </StaggerContainer>
        </section>

        {/* ================================================================= */}
        {/* BEAT 06: FINAL CALL TO ACTION                                     */}
        {/* ================================================================= */}
        <section className={`${styles.finalSection} ${styles.container}`} aria-labelledby="final-heading">
          <FadeInView className={styles.finalContent}>
            <TechnicalEyebrow>GETTING STARTED</TechnicalEyebrow>
            <h2 id="final-heading" className={styles.finalTitle}>
              See Further.<br />
              <em>Guess Less.</em>
            </h2>
            <p className={styles.finalLead}>
              Launch the web terminal right now to inspect public feeds, or consult our documentation
              to understand the Python research API. Start with evidence. Guess less.
            </p>
            <div className={styles.finalActions}>
              <CTAButton href="/terminal">Open ZTerminal</CTAButton>
              <CTAButton href="/docs" secondary>Read Documentation</CTAButton>
            </div>
          </FadeInView>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
