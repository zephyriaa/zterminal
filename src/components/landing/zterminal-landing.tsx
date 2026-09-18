"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  Braces,
  Check,
  ChevronRight,
  Crosshair,
  Database,
  Eye,
  Fingerprint,
  FlaskConical,
  Layers3,
  LockKeyhole,
  Menu,
  Radar,
  ShieldCheck,
  Sparkles,
  X,
  Zap,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import styles from "./zterminal-landing.module.css";

const spring = { type: "spring", stiffness: 120, damping: 24, mass: 0.8 } as const;

const reveal = {
  hidden: { opacity: 0, y: 26 },
  visible: { opacity: 1, y: 0, transition: spring },
};

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.09 } },
};

function Reveal({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      className={className}
      variants={reduceMotion ? undefined : reveal}
      initial={reduceMotion ? undefined : "hidden"}
      whileInView={reduceMotion ? undefined : "visible"}
      viewport={{ once: true, amount: 0.18 }}
    >
      {children}
    </motion.div>
  );
}

function Brand() {
  return (
    <Link className={styles.brand} href="#overview" aria-label="ZTerminal home">
      <span className={styles.brandMark} aria-hidden="true"><i /><i /></span>
      <span className={styles.brandName}>ZTERMINAL</span>
      <span className={styles.beta}>BETA</span>
    </Link>
  );
}

function Nav() {
  const [open, setOpen] = useState(false);
  return (
    <header className={styles.navWrap}>
      <div className={styles.navbar}>
        <Brand />
        <button
          className={styles.menuButton}
          type="button"
          aria-label={open ? "Close navigation" : "Open navigation"}
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
        <nav className={`${styles.navLinks} ${open ? styles.navOpen : ""}`} aria-label="Primary navigation">
          <a href="#overview" onClick={() => setOpen(false)}>Overview</a>
          <a href="#research-loop" onClick={() => setOpen(false)}>Research loop</a>
          <Link href="/download" onClick={() => setOpen(false)}>Windows</Link>
          <Link href="/docs" onClick={() => setOpen(false)}>Docs</Link>
          <Link className={styles.navCta} href="/terminal" onClick={() => setOpen(false)}>
            Web terminal <ArrowRight size={13} />
          </Link>
        </nav>
      </div>
    </header>
  );
}

function TerminalHero() {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      className={styles.terminalStage}
      initial={reduceMotion ? undefined : { opacity: 0, x: 44, y: 22, rotateY: -8 }}
      animate={reduceMotion ? undefined : { opacity: 1, x: 0, y: 0, rotateY: -5 }}
      transition={{ ...spring, delay: 0.18 }}
    >
      <div className={styles.terminalGlow} aria-hidden="true" />
      <div className={styles.terminalFrame}>
        <div className={styles.terminalChrome}>
          <span className={styles.traffic}><i /><i /><i /></span>
          <span>ZT / BTC · USDT / 5M</span>
          <span className={styles.live}><i /> LIVE CONTEXT</span>
        </div>
        <div className={styles.screen}>
          <Image
            src="/landing/terminal-screenshot.webp"
            alt="ZTerminal market research workspace showing a candlestick chart, volume, and market context"
            width={3200}
            height={1800}
            priority
            sizes="(max-width: 900px) 94vw, 62vw"
          />
          <span className={styles.screenSheen} aria-hidden="true" />
        </div>
        <div className={styles.terminalStatus}>
          <span><i /> ORDER FLOW ALIGNED</span>
          <span>LOCAL WORKSPACE</span>
          <span>NO SIGNAL FABRICATION</span>
        </div>
      </div>
      <div className={styles.basePlate} aria-hidden="true"><span /></div>
      <motion.div
        className={`${styles.floatingChip} ${styles.chipTop}`}
        animate={reduceMotion ? undefined : { y: [0, -7, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
      >
        <Radar size={14} />
        <span><b>Context locked</b>Price · depth · volume</span>
      </motion.div>
      <motion.div
        className={`${styles.floatingChip} ${styles.chipBottom}`}
        animate={reduceMotion ? undefined : { y: [0, 6, 0] }}
        transition={{ duration: 5.8, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
      >
        <ShieldCheck size={14} />
        <span><b>Evidence first</b>Assumptions stay visible</span>
      </motion.div>
    </motion.div>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className={styles.eyebrow}><span />{children}</p>;
}

function SectionHeader({ eyebrow, title, body, centered = false }: { eyebrow: string; title: React.ReactNode; body: string; centered?: boolean }) {
  return (
    <Reveal className={`${styles.sectionHeader} ${centered ? styles.centered : ""}`}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2>{title}</h2>
      <p>{body}</p>
    </Reveal>
  );
}

function MarketMap() {
  return (
    <div className={styles.marketMap} aria-label="Illustrative order flow and volume profile visualization">
      <div className={styles.mapBar}>
        <span>BTC / USDT</span><span>MARKET STRUCTURE · 5M</span><span className={styles.mapLive}><i /> READING</span>
      </div>
      <div className={styles.chartGrid}>
        <svg viewBox="0 0 760 330" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="lineGlow" x1="0" y1="0" x2="1" y2="0"><stop stopColor="#8b7cf6" /><stop offset="1" stopColor="#da84f8" /></linearGradient>
            <linearGradient id="areaGlow" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#9b7ef7" stopOpacity=".22" /><stop offset="1" stopColor="#9b7ef7" stopOpacity="0" /></linearGradient>
          </defs>
          <path className={styles.areaPath} d="M0 248 C55 236 67 265 118 222 S184 240 227 181 S295 206 345 156 S418 200 470 129 S548 153 610 83 S681 112 760 47 V330 H0Z" />
          <path className={styles.pricePath} d="M0 248 C55 236 67 265 118 222 S184 240 227 181 S295 206 345 156 S418 200 470 129 S548 153 610 83 S681 112 760 47" />
          <path className={styles.vwapPath} d="M0 264 C90 256 168 233 248 220 S390 190 482 166 S647 121 760 104" />
        </svg>
        <div className={styles.liquidityBand} />
        <div className={styles.mapCallout}><span>ABSORPTION</span><b>Bid holds through rising volume</b></div>
        <div className={styles.volumeProfile} aria-hidden="true">
          {[42, 58, 82, 66, 94, 74, 48, 34, 26].map((width, index) => <i key={width + index} style={{ width: `${width}%` }} />)}
        </div>
      </div>
      <div className={styles.mapFooter}><span><b>Δ</b> Aggression</span><span><b>V</b> Volume profile</span><span><b>⊕</b> Price acceptance</span></div>
    </div>
  );
}

function BacktestVisual() {
  return (
    <div className={styles.backtestVisual} aria-label="Illustrative evidence report">
      <div className={styles.miniHeader}><span>HYPOTHESIS / 04</span><span className={styles.verified}><Check size={11} /> CHECKED</span></div>
      <div className={styles.metricRow}>
        <div><span>Sample</span><b>2,840</b><small>observations</small></div>
        <div><span>Max drawdown</span><b>−8.4%</b><small>historical</small></div>
        <div><span>Stability</span><b>7 / 9</b><small>test windows</small></div>
      </div>
      <svg viewBox="0 0 560 120" preserveAspectRatio="none" aria-hidden="true">
        <path className={styles.equityFill} d="M0 102 C45 96 72 103 108 79 S166 88 204 61 S254 76 296 45 S350 57 397 36 S468 49 560 13 V120 H0Z" />
        <path className={styles.equityLine} d="M0 102 C45 96 72 103 108 79 S166 88 204 61 S254 76 296 45 S350 57 397 36 S468 49 560 13" />
      </svg>
      <p>Every result keeps the dataset, assumptions, and revision attached.</p>
    </div>
  );
}

function ResearchCode() {
  return (
    <div className={styles.codeVisual} aria-label="Illustrative hypothesis definition">
      <div className={styles.codeHeader}><span /><span /><span /><b>momentum_retest.py</b></div>
      <pre><span>01</span> hypothesis = market.retest(<br /><span>02</span>   level=<i>session.vpoc</i>,<br /><span>03</span>   confirmation=<i>delta.absorption</i><br /><span>04</span> )<br /><span>05</span><br /><span>06</span> <em>test</em>(hypothesis, regime=<i>&quot;trend&quot;</i>)</pre>
      <div className={styles.codeResult}><Check size={13} /> Rules are explicit. The test is repeatable.</div>
    </div>
  );
}

function SovereignVisual() {
  return (
    <div className={styles.sovereignVisual} aria-label="Private local research flow">
      <div className={styles.orbitOne} /><div className={styles.orbitTwo} />
      <div className={styles.localCore}><span className={styles.coreHalo} /><Fingerprint size={36} strokeWidth={1.2} /><b>YOUR MACHINE</b><small>Trusted boundary</small></div>
      <div className={`${styles.orbitNode} ${styles.nodeOne}`}><Database size={14} /><span>Market data</span></div>
      <div className={`${styles.orbitNode} ${styles.nodeTwo}`}><Braces size={14} /><span>Strategies</span></div>
      <div className={`${styles.orbitNode} ${styles.nodeThree}`}><LockKeyhole size={14} /><span>Keys</span></div>
      <div className={styles.privateStamp}><ShieldCheck size={14} /> PRIVATE BY ARCHITECTURE</div>
    </div>
  );
}

export function ZTerminalLanding() {
  const reduceMotion = useReducedMotion();
  return (
    <main className={styles.page}>
      <Nav />
      <section className={styles.hero} id="overview">
        <div className={styles.heroNoise} aria-hidden="true" /><div className={styles.heroGlow} aria-hidden="true" />
        <div className={styles.heroGrid}>
          <motion.div className={styles.heroCopy} variants={reduceMotion ? undefined : stagger} initial={reduceMotion ? undefined : "hidden"} animate={reduceMotion ? undefined : "visible"}>
            <motion.div variants={reveal}><Eyebrow>MARKET RESEARCH WORKSPACE · BETA</Eyebrow></motion.div>
            <motion.h1 variants={reveal}><span>See Further.</span><em>Guess Less.</em></motion.h1>
            <motion.p className={styles.heroDescription} variants={reveal}>Charts, market context, Python research, and backtests—together, so every idea can be checked against evidence.</motion.p>
            <motion.div className={styles.heroActions} variants={reveal}>
              <Link className={styles.primaryButton} href="/terminal">Open in browser <ArrowRight size={16} /></Link>
              <Link className={styles.textButton} href="/download">Windows availability <ArrowRight size={15} /></Link>
            </motion.div>
            <motion.div className={styles.heroProof} variants={reveal}>
              <span><Check size={12} /> Live market context</span><span><Check size={12} /> Local-first research</span><span><Check size={12} /> Evidence attached</span>
            </motion.div>
          </motion.div>
          <TerminalHero />
        </div>
        <a className={styles.scrollCue} href="#problem" aria-label="Scroll to explore"><span>EXPLORE THE EDGE</span><i /></a>
      </section>

      <section className={styles.problemSection} id="problem">
        <div className={styles.sectionGlow} aria-hidden="true" />
        <div className={styles.container}>
          <SectionHeader eyebrow="01 · MARKET VISIBILITY" title={<>Stop Trading<br /><em>in the Dark.</em></>} body="A price candle shows where the market ended up. ZTerminal keeps the pressure behind the move in view—so you can read acceptance, aggression, and liquidity before committing to a thesis." />
          <div className={styles.problemGrid}>
            <Reveal className={styles.mapWrap}><MarketMap /></Reveal>
            <motion.div className={styles.problemPoints} variants={reduceMotion ? undefined : stagger} initial={reduceMotion ? undefined : "hidden"} whileInView={reduceMotion ? undefined : "visible"} viewport={{ once: true, amount: 0.25 }}>
              {[
                [Eye, "See the auction, not just the candle", "Order-flow context and volume distribution reveal where participation concentrates—and where a move is running out of conviction."],
                [Layers3, "Keep every layer in one frame", "Price, depth, trades, and session structure stay aligned. No tab switching. No stitching a thesis together from disconnected tools."],
                [Crosshair, "Act on evidence, not adrenaline", "Turn an observation into an explicit question, then demand a measurable answer before risking attention or capital."],
              ].map(([Icon, title, copy], index) => {
                const PointIcon = Icon as typeof Eye;
                return <motion.article key={title as string} variants={reveal}><span className={styles.pointNumber}>0{index + 1}</span><div className={styles.pointIcon}><PointIcon size={18} /></div><div><h3>{title as string}</h3><p>{copy as string}</p></div></motion.article>;
              })}
            </motion.div>
          </div>
        </div>
      </section>

      <section className={styles.workflowSection} id="research-loop">
        <div className={styles.container}>
          <SectionHeader centered eyebrow="02 · THE RESEARCH LOOP" title={<>Hypothesize. Code. <em>Execute.</em></>} body="Move from market observation to a checked decision without losing the thread. One workspace. One chain of evidence." />
          <motion.div className={styles.bento} variants={reduceMotion ? undefined : stagger} initial={reduceMotion ? undefined : "hidden"} whileInView={reduceMotion ? undefined : "visible"} viewport={{ once: true, amount: 0.12 }}>
            <motion.article className={`${styles.glassCard} ${styles.bentoChart}`} variants={reveal}>
              <div className={styles.cardTop}><span><Radar size={15} /> 01 · HYPOTHESIZE</span><b>MARKET CANVAS</b></div>
              <div className={styles.cardCopy}><h3>Clarity before conviction.</h3><p>Mark the level, capture the context, and state what would prove the idea wrong.</p></div>
              <div className={styles.candles} aria-hidden="true">
                {[43, 55, 48, 73, 62, 84, 67, 96, 88, 112, 92, 126, 115, 142, 128, 154].map((height, index) => <i key={height + index} className={index % 4 === 1 ? styles.down : ""} style={{ height }}><span /></i>)}
                <svg viewBox="0 0 700 190" preserveAspectRatio="none"><path d="M0 158 C65 147 91 166 137 122 S217 140 264 103 S349 118 405 70 S505 87 558 46 S641 57 700 21" /></svg>
                <div className={styles.canvasTag}>VPOC RECLAIM</div>
              </div>
            </motion.article>
            <motion.article className={`${styles.glassCard} ${styles.bentoTest}`} variants={reveal}>
              <div className={styles.cardTop}><span><FlaskConical size={15} /> 02 · TEST</span><b>PROVENANCE ON</b></div>
              <div className={styles.cardCopy}><h3>Results that can show their work.</h3><p>Stress the idea across historical windows. Keep the evidence, assumptions, and revision together.</p></div>
              <BacktestVisual />
            </motion.article>
            <motion.article className={`${styles.glassCard} ${styles.bentoCode}`} variants={reveal}>
              <div className={styles.cardTop}><span><Braces size={15} /> 03 · DEFINE</span><b>PYTHON RESEARCH</b></div>
              <div className={styles.cardCopy}><h3>Make the thesis explicit.</h3><p>Translate discretion into rules you can inspect, repeat, and challenge.</p></div>
              <ResearchCode />
            </motion.article>
            <motion.article className={`${styles.glassCard} ${styles.bentoDecision}`} variants={reveal}>
              <div className={styles.decisionIcon}><Crosshair size={22} /></div><span>THE DECISION GATE</span><h3>Keep. Refine. Reject.</h3><p>A weak thesis should fail quickly. A durable one earns the next test.</p><div className={styles.decisionSteps}><i /><i /><i className={styles.activeStep} /></div>
            </motion.article>
          </motion.div>
        </div>
      </section>

      <section className={styles.sovereignSection} id="sovereignty">
        <div className={styles.container}><div className={styles.sovereignGrid}>
          <Reveal className={styles.sovereignCopy}>
            <Eyebrow>03 · LOCAL BY DESIGN</Eyebrow><h2>Your Edge,<br /><em>Sovereign.</em></h2>
            <p className={styles.sovereignLead}>Your research is intellectual property. It belongs inside a boundary you control—not inside someone else’s telemetry pipeline.</p>
            <div className={styles.sovereignList}>
              <article><span><LockKeyhole size={18} /></span><div><h3>Strategies and keys stay yours</h3><p>Sensitive research and credentials remain on storage you control.</p></div></article>
              <article><span><Zap size={18} /></span><div><h3>Local compute, immediate feedback</h3><p>Approved research runs beside your workspace without a cloud round trip in the loop.</p></div></article>
              <article><span><Fingerprint size={18} /></span><div><h3>Privacy without blind spots</h3><p>Keep provenance and repeatability while minimizing external exposure.</p></div></article>
            </div>
          </Reveal>
          <Reveal className={styles.sovereignArt}><SovereignVisual /></Reveal>
        </div></div>
      </section>

      <section className={styles.ctaSection}>
        <div className={styles.container}><Reveal className={styles.ctaCard}>
          <div className={styles.ctaGlow} aria-hidden="true" /><div className={styles.ctaGrid} aria-hidden="true" />
          <div className={styles.ctaContent}>
            <span className={styles.ctaPill}><Sparkles size={13} /> READY WHEN THE MARKET MOVES</span>
            <h2>The Market<br /><em>Doesn’t Wait.</em></h2>
            <p>Bring every chart, hypothesis, and evidence trail into one decisive workspace.</p>
            <div className={styles.ctaActions}><Link className={styles.lightButton} href="/terminal">Launch web terminal <ArrowRight size={16} /></Link><Link className={styles.glassButton} href="/download">Download for Windows <ChevronRight size={16} /></Link></div>
            <div className={styles.ctaMeta}><span><i /> WEB TERMINAL AVAILABLE</span><span>WINDOWS COMPANION · BETA</span></div>
          </div>
        </Reveal></div>
      </section>

      <footer className={styles.footer}>
        <div className={styles.footerInner}><Brand /><p>Market structure, research, and evidence—in one focused workspace.</p><nav aria-label="Footer navigation"><Link href="/terminal">Terminal</Link><Link href="/download">Windows</Link><Link href="/docs">Docs</Link><a href="https://github.com/zephyriaa/zterminal" target="_blank" rel="noreferrer">GitHub ↗</a></nav></div>
        <div className={styles.legal}><span>© 2026 ZTerminal</span><span>Research and decision-support software. Market data may be delayed or incomplete; historical tests are hypothetical.</span></div>
      </footer>
    </main>
  );
}
