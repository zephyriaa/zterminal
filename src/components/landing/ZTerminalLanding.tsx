"use client";

import Link from "next/link";
import { PublicHeader } from "@/components/public/public-header";
import { PublicFooter } from "@/components/public/public-footer";
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
  return (
    <div className={`${styles.page} publicScope`}>
      <BackgroundField />
      <PublicHeader />

      <main className={styles.content}>
        {/* ================================================================= */}
        {/* BEAT 01: HERO                                                     */}
        {/* ================================================================= */}
        <section className={`${styles.hero} ${styles.container}`} aria-labelledby="hero-heading">
          <div className={styles.heroGrid}>
            <div className={styles.heroContent}>
              <TechnicalEyebrow className={styles.heroEyebrow}>
                MARKET RESEARCH WORKSPACE · BETA
              </TechnicalEyebrow>

              <h1 id="hero-heading" className={styles.heroTitle}>
                See Further.<br />
                <em>Guess Less.</em>
              </h1>

              <p className={styles.heroLead}>
                A research workspace for understanding markets, developing hypotheses,
                coding strategies in Python, and inspecting evidence.
              </p>

              <div className={styles.heroActions}>
                <CTAButton href="/terminal">Open ZTerminal</CTAButton>
                <a href="#research-loop" className={styles.heroSecondaryLink}>
                  Explore the research workflow <span aria-hidden="true">↓</span>
                </a>
              </div>

              <div className={styles.heroFootnote}>
                <span className={styles.heroFootnoteDot} aria-hidden="true" />
                <span>Windows x64 signed release in preparation · Web terminal available now</span>
              </div>
            </div>

            {/* ART-DIRECTED PRODUCT WINDOW (Focused quantitative workspace) */}
            <div className={styles.heroStage} aria-label="ZTerminal workstation demonstration canvas">
              <ProductWindow
                title="ZTerminal / Research workspace"
                readout="BTC/USDT · 5M · TICK RESOLUTION"
              >
                <div className={styles.illustrativeBanner} aria-hidden="true">
                  <span>DEMONSTRATION CANVAS</span>
                  <span>ILLUSTRATIVE MARKET DATA</span>
                </div>

                <div className={styles.canvasArea}>
                  {/* Left tool rail */}
                  <div className={styles.canvasTools} aria-hidden="true">
                    <span className={`${styles.toolIcon} ${styles.toolIconActive}`} title="Pointer">✛</span>
                    <span className={styles.toolIcon} title="Indicators">∿</span>
                    <span className={styles.toolIcon} title="Strategy Code">{}</span>
                    <span className={styles.toolIcon} title="Replay">⌗</span>
                  </div>

                  {/* Chart canvas */}
                  <div className={styles.chartViewport}>
                    <div className={styles.chartTopBar}>
                      <div className={styles.chartSymbolGroup}>
                        <span className={styles.chartSymbol}>BTC/USDT Perp</span>
                        <span className={styles.chartBadge}>Gate.io · 5m</span>
                        <span className={styles.chartIndicatorBadge}>EMA(9, 21)</span>
                      </div>
                      <span className={styles.priceTag}>
                        <span aria-hidden="true">▲</span> 67,420.50 USDT
                      </span>
                    </div>

                    <div className={styles.chartSvgArea}>
                      <svg
                        className={styles.chartSvg}
                        viewBox="0 0 540 230"
                        preserveAspectRatio="none"
                        aria-hidden="true"
                      >
                        {/* Candlestick sequence */}
                        <g opacity="0.9">
                          <line x1="30" y1="140" x2="30" y2="185" stroke="#f87171" strokeWidth="1.2" />
                          <rect x="25" y="150" width="10" height="25" fill="#f87171" rx="1" />

                          <line x1="68" y1="130" x2="68" y2="175" stroke="#34d399" strokeWidth="1.2" />
                          <rect x="63" y="138" width="10" height="28" fill="#34d399" rx="1" />

                          <line x1="106" y1="115" x2="106" y2="160" stroke="#34d399" strokeWidth="1.2" />
                          <rect x="101" y="122" width="10" height="30" fill="#34d399" rx="1" />

                          <line x1="144" y1="120" x2="144" y2="165" stroke="#f87171" strokeWidth="1.2" />
                          <rect x="139" y="128" width="10" height="26" fill="#f87171" rx="1" />

                          <line x1="182" y1="95" x2="182" y2="145" stroke="#34d399" strokeWidth="1.2" />
                          <rect x="177" y="102" width="10" height="34" fill="#34d399" rx="1" />

                          <line x1="220" y1="85" x2="220" y2="130" stroke="#34d399" strokeWidth="1.2" />
                          <rect x="215" y="90" width="10" height="30" fill="#34d399" rx="1" />

                          <line x1="258" y1="90" x2="258" y2="135" stroke="#f87171" strokeWidth="1.2" />
                          <rect x="253" y="96" width="10" height="28" fill="#f87171" rx="1" />

                          <line x1="296" y1="70" x2="296" y2="115" stroke="#34d399" strokeWidth="1.2" />
                          <rect x="291" y="75" width="10" height="32" fill="#34d399" rx="1" />

                          <line x1="334" y1="60" x2="334" y2="105" stroke="#34d399" strokeWidth="1.2" />
                          <rect x="329" y="64" width="10" height="30" fill="#34d399" rx="1" />

                          <line x1="372" y1="62" x2="372" y2="102" stroke="#f87171" strokeWidth="1.2" />
                          <rect x="367" y="68" width="10" height="22" fill="#f87171" rx="1" />

                          <line x1="410" y1="45" x2="410" y2="90" stroke="#34d399" strokeWidth="1.2" />
                          <rect x="405" y="48" width="10" height="34" fill="#34d399" rx="1" />

                          <line x1="448" y1="40" x2="448" y2="82" stroke="#34d399" strokeWidth="1.2" />
                          <rect x="443" y="42" width="10" height="28" fill="#34d399" rx="1" />

                          <line x1="486" y1="28" x2="486" y2="70" stroke="#34d399" strokeWidth="1.2" />
                          <rect x="481" y="32" width="10" height="30" fill="#34d399" rx="1" />
                        </g>

                        {/* Dual EMA Indicators */}
                        {/* Fast EMA (9) — restrained lilac accent */}
                        <path
                          d="M 30 170 C 110 150, 180 120, 260 105 C 340 85, 410 58, 490 40"
                          fill="none"
                          stroke="#c093f5"
                          strokeWidth="1.8"
                        />

                        {/* Slow EMA (21) — quiet neutral slate */}
                        <path
                          d="M 30 178 C 110 162, 190 138, 270 120 C 350 102, 420 80, 490 62"
                          fill="none"
                          stroke="#778ca9"
                          strokeWidth="1.4"
                          strokeDasharray="4 2"
                        />

                        {/* Strategy signal annotation */}
                        <g transform="translate(182, 78)">
                          <polygon points="0,0 6,10 -6,10" fill="#03ddd1" />
                          <text x="10" y="8" fill="#03ddd1" fontSize="9" fontFamily="monospace" fontWeight="bold">LONG ENTRY</text>
                        </g>
                      </svg>
                    </div>

                    {/* Restrained footer status strip */}
                    <div className={styles.chartFootnoteStrip}>
                      <span>ILLUSTRATIVE OHLCV &amp; SIGNAL PREVIEW</span>
                      <span>LOCAL RESEARCH ENGINE · REPLAY BOUNDARY ENFORCED</span>
                    </div>
                  </div>
                </div>
              </ProductWindow>
            </div>
          </div>
        </section>

        {/* ================================================================= */}
        {/* BEAT 02: RESEARCH THESIS & TENETS                                 */}
        {/* ================================================================= */}
        <section className={`${styles.tenetsSection} ${styles.container}`} aria-labelledby="tenets-heading">
          <div className={styles.tenetsHeader}>
            <TechnicalEyebrow>RESEARCH THESIS</TechnicalEyebrow>
            <h2 id="tenets-heading" className={styles.tenetsStatement}>
              Market ideas are easy.<br />
              <em>Evidence is harder.</em>
            </h2>
            <p className={styles.tenetsLead}>
              ZTerminal connects market observation, Python research, backtesting, and result inspection in one workspace.
            </p>
          </div>

          <div className={styles.tenetsGrid}>
            <article className={styles.tenetItem}>
              <span className={styles.tenetIndex}>01 / OBSERVED FEEDS</span>
              <h3 className={styles.tenetTitle}>Direct Exchange Streams</h3>
              <p className={styles.tenetDescription}>
                Connect directly to public exchange feeds (Binance, Bybit, Coinbase, OKX, Gate.io).
                Inspect candlestick history, tick trades, and order book depth without synthetic alterations.
              </p>
            </article>

            <article className={styles.tenetItem}>
              <span className={styles.tenetIndex}>02 / PORTABLE PYTHON</span>
              <h3 className={styles.tenetTitle}>Standard Python SDK</h3>
              <p className={styles.tenetDescription}>
                Author strategies using the zterminal Python library. Write standard functions
                that return signals and plots, executing locally on your CPU with explicit parameters.
              </p>
            </article>

            <article className={styles.tenetItem}>
              <span className={styles.tenetIndex}>03 / TRACEABLE RECORDS</span>
              <h3 className={styles.tenetTitle}>Hashed Run Records</h3>
              <p className={styles.tenetDescription}>
                Every strategy run records explicit slippage, fee, and timing assumptions. Completed
                runs are stored locally with SHA-256 provenance hashes for traceable review.
              </p>
            </article>
          </div>
        </section>

        {/* ================================================================= */}
        {/* BEAT 03: THE RESEARCH LOOP (Continuous Editorial System Flow)     */}
        {/* ================================================================= */}
        <section
          id="research-loop"
          className={`${styles.loopSection} ${styles.container}`}
          aria-labelledby="loop-heading"
        >
          <div className={styles.loopHeader}>
            <TechnicalEyebrow>THE RESEARCH LOOP</TechnicalEyebrow>
            <h2 id="loop-heading" className={styles.loopTitle}>
              From market observation to tested thesis,<br />
              <em>without breaking context.</em>
            </h2>
          </div>

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
          <div className={styles.loopGrid} aria-label="Research loop stages">
            {RESEARCH_LOOP_CARDS.map((card) => (
              <article key={card.num} className={styles.loopStage}>
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
            ))}
          </div>
        </section>

        {/* ================================================================= */}
        {/* BEAT 04: PRODUCT DEEP DIVE (Three Authentic Surfaces)             */}
        {/* ================================================================= */}
        <section className={`${styles.surfacesSection} ${styles.container}`} aria-labelledby="surfaces-heading">
          {/* Surface 01: Market Canvas & Depth */}
          <div className={styles.surfaceMoment}>
            <div className={styles.surfaceMomentCopy}>
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
            </div>

            <div className={styles.surfaceMomentVisual}>
              <ProductWindow
                title="ZTerminal / Market Canvas"
                readout="DEMONSTRATION FIXTURE"
              >
                <div className={styles.surfaceMarketContainer}>
                  <div className={styles.surfaceMarketTopBar}>
                    <div className={styles.surfaceMarketLeftMeta}>
                      <span className={styles.surfaceMarketSymbol}>ETH/USDT Perp</span>
                      <span className={styles.surfaceMarketBadge}>Gate.io · 15m</span>
                      <span className={styles.surfaceMarketVpocBadge}>VPOC: 3,468.50</span>
                    </div>
                    <span className={styles.surfaceMarketPrice}>3,485.20 USDT</span>
                  </div>

                  <div className={styles.surfaceMarketBody}>
                    {/* Left: Candlesticks + Volume Profile */}
                    <div className={styles.surfaceMarketChartPane}>
                      <svg viewBox="0 0 320 180" width="100%" height="180" aria-hidden="true" style={{ overflow: "visible" }}>
                        {/* Horizontal Price Gridlines */}
                        <line x1="0" y1="30" x2="320" y2="30" stroke="rgba(133,153,195,0.08)" strokeDasharray="2 4" />
                        <line x1="0" y1="80" x2="320" y2="80" stroke="rgba(133,153,195,0.08)" strokeDasharray="2 4" />
                        <line x1="0" y1="130" x2="320" y2="130" stroke="rgba(133,153,195,0.08)" strokeDasharray="2 4" />

                        {/* Volume Profile Histogram (Left side) */}
                        <rect x="0" y="22" width="38" height="14" fill="rgba(192, 147, 245, 0.12)" rx="1" />
                        <rect x="0" y="38" width="62" height="14" fill="rgba(192, 147, 245, 0.15)" rx="1" />
                        <rect x="0" y="54" width="88" height="14" fill="rgba(192, 147, 245, 0.18)" rx="1" />
                        {/* VPOC line & bar */}
                        <rect x="0" y="70" width="118" height="14" fill="rgba(192, 147, 245, 0.32)" rx="1" />
                        <line x1="0" y1="77" x2="320" y2="77" stroke="#c093f5" strokeWidth="1" strokeDasharray="3 3" opacity="0.6" />
                        <text x="235" y="74" fill="#c093f5" fontSize="8" fontFamily="monospace">VPOC 3,468.50</text>

                        <rect x="0" y="86" width="75" height="14" fill="rgba(192, 147, 245, 0.16)" rx="1" />
                        <rect x="0" y="102" width="50" height="14" fill="rgba(192, 147, 245, 0.14)" rx="1" />
                        <rect x="0" y="118" width="32" height="14" fill="rgba(192, 147, 245, 0.10)" rx="1" />

                        {/* Candlesticks sequence */}
                        {/* Bar 1 - down */}
                        <line x1="140" y1="90" x2="140" y2="135" stroke="#f87171" strokeWidth="1.2" />
                        <rect x="136" y="98" width="8" height="26" fill="#f87171" rx="1" />

                        {/* Bar 2 - up */}
                        <line x1="165" y1="85" x2="165" y2="125" stroke="#34d399" strokeWidth="1.2" />
                        <rect x="161" y="92" width="8" height="24" fill="#34d399" rx="1" />

                        {/* Bar 3 - up */}
                        <line x1="190" y1="72" x2="190" y2="115" stroke="#34d399" strokeWidth="1.2" />
                        <rect x="186" y="78" width="8" height="28" fill="#34d399" rx="1" />

                        {/* Bar 4 - down */}
                        <line x1="215" y1="70" x2="215" y2="108" stroke="#f87171" strokeWidth="1.2" />
                        <rect x="211" y="76" width="8" height="18" fill="#f87171" rx="1" />

                        {/* Bar 5 - up breakout */}
                        <line x1="240" y1="52" x2="240" y2="92" stroke="#34d399" strokeWidth="1.2" />
                        <rect x="236" y="56" width="8" height="28" fill="#34d399" rx="1" />

                        {/* Bar 6 - up */}
                        <line x1="265" y1="38" x2="265" y2="80" stroke="#34d399" strokeWidth="1.2" />
                        <rect x="261" y="42" width="8" height="26" fill="#34d399" rx="1" />

                        {/* Bar 7 - current active */}
                        <line x1="290" y1="28" x2="290" y2="68" stroke="#34d399" strokeWidth="1.2" />
                        <rect x="286" y="32" width="8" height="24" fill="#34d399" rx="1" />

                        {/* EMA(9) overlay curve */}
                        <path d="M 130 120 C 180 105, 230 75, 305 38" fill="none" stroke="#c093f5" strokeWidth="1.6" />

                        {/* Bottom volume bars */}
                        <g transform="translate(0, 155)">
                          <rect x="136" y="10" width="8" height="12" fill="rgba(248, 113, 113, 0.4)" />
                          <rect x="161" y="6" width="8" height="16" fill="rgba(52, 211, 153, 0.4)" />
                          <rect x="186" y="4" width="8" height="18" fill="rgba(52, 211, 153, 0.4)" />
                          <rect x="211" y="12" width="8" height="10" fill="rgba(248, 113, 113, 0.4)" />
                          <rect x="236" y="2" width="8" height="20" fill="rgba(52, 211, 153, 0.5)" />
                          <rect x="261" y="0" width="8" height="22" fill="rgba(52, 211, 153, 0.5)" />
                          <rect x="286" y="5" width="8" height="17" fill="rgba(52, 211, 153, 0.5)" />
                        </g>
                      </svg>
                    </div>

                    {/* Right: Level-2 DOM Depth Ladder */}
                    <div className={styles.surfaceMarketDomPane}>
                      <div className={styles.surfaceMarketDomHeader}>
                        <span>PRICE</span>
                        <span>SIZE</span>
                      </div>

                      {/* Asks (coral) */}
                      <div className={styles.surfaceMarketDomRow}>
                        <div className={`${styles.surfaceMarketDomDepth} ${styles.surfaceMarketDomAskDepth}`} style={{ width: "65%" }} />
                        <span style={{ color: "#f87171" }}>3,487.00</span>
                        <span style={{ color: "var(--public-muted)" }}>18.42</span>
                      </div>
                      <div className={styles.surfaceMarketDomRow}>
                        <div className={`${styles.surfaceMarketDomDepth} ${styles.surfaceMarketDomAskDepth}`} style={{ width: "42%" }} />
                        <span style={{ color: "#f87171" }}>3,486.50</span>
                        <span style={{ color: "var(--public-muted)" }}>11.80</span>
                      </div>
                      <div className={styles.surfaceMarketDomRow}>
                        <div className={`${styles.surfaceMarketDomDepth} ${styles.surfaceMarketDomAskDepth}`} style={{ width: "85%" }} />
                        <span style={{ color: "#f87171" }}>3,486.00</span>
                        <span style={{ color: "var(--public-muted)" }}>24.15</span>
                      </div>
                      <div className={styles.surfaceMarketDomRow}>
                        <div className={`${styles.surfaceMarketDomDepth} ${styles.surfaceMarketDomAskDepth}`} style={{ width: "30%" }} />
                        <span style={{ color: "#f87171" }}>3,485.50</span>
                        <span style={{ color: "var(--public-muted)" }}>8.60</span>
                      </div>

                      {/* Spread indicator */}
                      <div className={styles.surfaceMarketDomSpread}>
                        SPREAD: 0.50 (0.014%)
                      </div>

                      {/* Bids (emerald) */}
                      <div className={styles.surfaceMarketDomRow}>
                        <div className={`${styles.surfaceMarketDomDepth} ${styles.surfaceMarketDomBidDepth}`} style={{ width: "45%" }} />
                        <span style={{ color: "#34d399" }}>3,485.00</span>
                        <span style={{ color: "var(--public-muted)" }}>14.20</span>
                      </div>
                      <div className={styles.surfaceMarketDomRow}>
                        <div className={`${styles.surfaceMarketDomDepth} ${styles.surfaceMarketDomBidDepth}`} style={{ width: "75%" }} />
                        <span style={{ color: "#34d399" }}>3,484.50</span>
                        <span style={{ color: "var(--public-muted)" }}>21.35</span>
                      </div>
                      <div className={styles.surfaceMarketDomRow}>
                        <div className={`${styles.surfaceMarketDomDepth} ${styles.surfaceMarketDomBidDepth}`} style={{ width: "95%" }} />
                        <span style={{ color: "#34d399" }}>3,484.00</span>
                        <span style={{ color: "var(--public-muted)" }}>29.80</span>
                      </div>
                      <div className={styles.surfaceMarketDomRow}>
                        <div className={`${styles.surfaceMarketDomDepth} ${styles.surfaceMarketDomBidDepth}`} style={{ width: "38%" }} />
                        <span style={{ color: "#34d399" }}>3,483.50</span>
                        <span style={{ color: "var(--public-muted)" }}>10.15</span>
                      </div>
                    </div>
                  </div>

                  <div className={styles.surfaceMarketFootnote}>
                    <span>ILLUSTRATIVE GATE.IO L2 FIXTURE</span>
                    <span>SYNTHETIC DEPTH PROFILE</span>
                  </div>
                </div>
              </ProductWindow>
            </div>
          </div>

          {/* Surface 02: Python Research API */}
          <div className={`${styles.surfaceMoment} ${styles.surfaceMomentReverse}`}>
            <div className={styles.surfaceMomentCopy}>
              <TechnicalEyebrow>SURFACE / 02</TechnicalEyebrow>
              <h2 className={styles.surfaceTitle}>
                Python Research API.<br />
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
                  <span><strong>Local Execution:</strong> Strategy scripts execute through the paired local helper on your hardware rather than cloud servers.</span>
                </li>
              </ul>
            </div>

            <div className={styles.surfaceMomentVisual}>
              <CodeSurface
                filename="strategy_ema_crossover.py"
                runtime="PYTHON 3.11+ / LOCAL ENGINE"
                code={CODE_EXAMPLE_REAL}
              />
            </div>
          </div>

          {/* Surface 03: Empirical Scrutiny */}
          <div className={styles.surfaceMoment}>
            <div className={styles.surfaceMomentCopy}>
              <TechnicalEyebrow>SURFACE / 03</TechnicalEyebrow>
              <h2 className={styles.surfaceTitle}>
                Evidence over optimism.
                <em>Explicit assumptions.</em>
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
                  <span><strong>Monte Carlo Testing:</strong> Shuffle and resample trade distributions to evaluate curve stability.</span>
                </li>
              </ul>
            </div>

            <div className={styles.surfaceMomentVisual}>
              <ProductWindow
                title="ZTerminal / Empirical Validation"
                readout="ILLUSTRATIVE MODEL OUTPUT"
              >
                <div style={{ padding: "clamp(12px, 3vw, 20px)", background: "#070a13" }}>
                  <div className={styles.surfaceMetricsGrid}>
                    <div className={styles.metricTile}>
                      <span className={styles.metricTileLabel}>ANNUALIZED RETURN</span>
                      <span className={`${styles.metricTileValue} ${styles.metricPositive}`}>+28.6%</span>
                    </div>
                    <div className={styles.metricTile}>
                      <span className={styles.metricTileLabel}>PROFIT FACTOR</span>
                      <span className={styles.metricTileValue}>1.58</span>
                    </div>
                    <div className={styles.metricTile}>
                      <span className={styles.metricTileLabel}>SORTINO RATIO</span>
                      <span className={`${styles.metricTileValue} ${styles.metricPositive}`}>1.95</span>
                    </div>
                  </div>

                  <div style={{ height: "auto", minHeight: 90 }}>
                    <svg viewBox="0 0 400 110" width="100%" height="110" aria-hidden="true" style={{ maxWidth: "100%", height: "auto", display: "block" }}>
                      <path d="M 10 20 L 80 20 L 110 45 L 150 20 L 220 20 L 250 60 L 300 20 L 390 20" fill="none" stroke="#f87171" strokeWidth="1.6" />
                      <line x1="10" y1="20" x2="390" y2="20" stroke="rgba(133,153,195,0.2)" />
                      <text x="15" y="80" fill="#778ca9" fontSize="9" fontFamily="monospace">MAX DRAWDOWN: -8.8% · DURATION: 18 BARS</text>
                      <text x="15" y="96" fill="#4e5d78" fontSize="8" fontFamily="monospace">Simulated results are hypothetical; past performance does not guarantee future results.</text>
                    </svg>
                  </div>
                </div>
              </ProductWindow>
            </div>
          </div>
        </section>

        {/* ================================================================= */}
        {/* BEAT 05: LOCAL EXECUTION & WINDOWS ARCHITECTURE (Merged Section)  */}
        {/* ================================================================= */}
        <section className={`${styles.localWindowsSection} ${styles.container}`} aria-labelledby="boundary-heading">
          <div className={styles.sectionHeader}>
            <TechnicalEyebrow>EXECUTION BOUNDARY &amp; AVAILABILITY</TechnicalEyebrow>
            <h2 id="boundary-heading" className={styles.sectionTitle}>
              Local execution at the core.
              <em>The web, within reach.</em>
            </h2>
            <p className={styles.sectionLead}>
              The browser is where you inspect markets and draft strategies. Python strategy code executes through the paired local helper on your machine rather than on the ZTerminal web server.
            </p>
          </div>

          <div className={styles.localWindowsGrid}>
            {/* Card 1: Two Environment Boundary */}
            <div className={styles.boundaryCard}>
              <div>
                <div className={styles.boundaryCardHeader}>
                  <span className={styles.dataLabel}>EXECUTION BOUNDARY</span>
                  <StatusBadge showDot={false}>SESSION-PAIRED</StatusBadge>
                </div>
                <h3 className={styles.boundaryCardTitle}>Browser vs. Local Helper</h3>
                <p className={styles.boundaryCardDesc}>
                  Web sessions pair with the local helper on 127.0.0.1 via an ephemeral 8-digit code.
                  Python strategy code executes through the local helper process on the user's machine rather than on the ZTerminal web server.
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

            {/* Card 2: Windows Release Status */}
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
          </div>
        </section>

        {/* ================================================================= */}
        {/* BEAT 06: FINAL CALL TO ACTION                                     */}
        {/* ================================================================= */}
        <section className={`${styles.finalSection} ${styles.container}`} aria-labelledby="final-heading">
          <div className={styles.finalContent}>
            <TechnicalEyebrow>GETTING STARTED</TechnicalEyebrow>
            <h2 id="final-heading" className={styles.finalTitle}>
              Start with evidence.
              <em>Guess less.</em>
            </h2>
            <p className={styles.finalLead}>
              Launch the web terminal right now to inspect public feeds, or consult our documentation
              to understand the Python research API.
            </p>
            <div className={styles.finalActions}>
              <CTAButton href="/terminal">Open ZTerminal</CTAButton>
              <CTAButton href="/docs" secondary>Read Documentation</CTAButton>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
