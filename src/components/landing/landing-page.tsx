import Link from "next/link";
import styles from "./landing-page.module.css";
import "@/components/public/public-theme.css";
import { PublicHeader } from "@/components/public/public-header";
import { PublicFooter } from "@/components/public/public-footer";
import { DeviceFrame } from "@/components/public/device-frame";
import { WorkflowSequence } from "@/components/public/workflow-sequence";
import { HeroParticleWave } from "@/components/public/hero-particle-wave";

function ArrowIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 13 13"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={styles.arrowSvg}
    >
      <path
        d="M3 10L10 3M10 3H4.5M10 3V8.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function LandingPage() {
  return (
    <main className={`${styles.page} publicScope`} id="main">
      <a className={styles.skipLink} href="#hero-title">Skip to content</a>
      
      {/* Header spanning full width with hairline divider */}
      <PublicHeader />

      {/* Hero Section */}
      <section className={styles.hero} aria-labelledby="hero-title">
        {/* Cinematic Atmospheric Background */}
        <div className={styles.heroAtmosphere} aria-hidden="true">
          <div className={styles.ambientVioletGlow} />
          <div className={styles.particleWaveWrapper}>
            <HeroParticleWave />
          </div>
        </div>

        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>QUANTITATIVE MARKET RESEARCH</p>
          <h1 id="hero-title" className={styles.heroTitle}>
            <span className={styles.headlineSans}>See more.</span>
            <span className={styles.headlineSerif}>Guess less.</span>
          </h1>
          <p className={styles.heroLead}>
            A native client-first quantitative market research workstation designed around 
            evidence rather than intuition, and robustness over optimization.
          </p>
          <div className={styles.heroActions}>
            <Link className={styles.primaryButton} href="/download">
              Explore for Windows <ArrowIcon />
            </Link>
            <Link className={styles.secondaryButton} href="/terminal">
              Launch web terminal <ArrowIcon />
            </Link>
          </div>
          <p className={styles.heroDisclaimer}>
            Decision support for traders. No broker route. You retain control of execution.
          </p>
        </div>

        <div className={styles.heroDevice}>
          <DeviceFrame />
        </div>
      </section>

      {/* Below-the-fold content preserved in container */}
      <div className={styles.contentContainer}>
        <section className={styles.workflowSection} id="workflow" aria-labelledby="workflow-title">
          <div className={styles.sectionHeader}>
            <p className={styles.eyebrow}>THE ZTERMINAL METHOD</p>
            <h2 id="workflow-title">Research → Validate → Monitor<br />→ Decide → Execute → Review</h2>
            <p>The entire workspace revolves around a disciplined decision loop.</p>
          </div>
          <WorkflowSequence />
        </section>

        <section className={styles.contextSection} aria-labelledby="context-title">
          <div className={styles.contextGrid}>
            <div className={styles.contextCopy}>
              <p className={styles.eyebrow}>MARKET CONTEXT</p>
              <h2 id="context-title">See the structure<br />around the move.</h2>
              <p>
                Price sits beside volume, liquidity, volatility, session structure, and market regime. 
                Context turns a raw chart into an environment you can reason about, built on high-fidelity 
                order flow and deep market data.
              </p>
            </div>
          </div>
        </section>

        <section className={styles.testSection} aria-labelledby="test-title">
          <div className={styles.sectionHeader}>
            <p className={styles.eyebrow}>QUANTITATIVE RESEARCH</p>
            <h2 id="test-title">Turn a thought into a <em>testable rule.</em></h2>
          </div>
          <div className={styles.testFeatures}>
            <article>
              <h3>Strategy validation</h3>
              <p>Write the hypothesis clearly and test it against history before trusting it.</p>
            </article>
            <article>
              <h3>Backtesting</h3>
              <p>High-performance historical execution to verify edge over extended periods.</p>
            </article>
            <article>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                Monte Carlo
                <span style={{ fontSize: '10px', padding: '2px 6px', background: 'rgba(214, 166, 104, 0.15)', color: '#d6a668', borderRadius: '4px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Planned</span>
              </h3>
              <p>Simulate thousands of possible outcome paths to measure true system robustness.</p>
            </article>
          </div>
        </section>

        <section className={styles.localFirst} aria-labelledby="local-title">
          <div className={styles.localFirstContent}>
            <p className={styles.eyebrow}>ARCHITECTURE</p>
            <h2 id="local-title">Your machine does the heavy work.</h2>
            <p>
              ZTerminal is built as a native Windows application with a client-first, server-light 
              architecture. Local compute means datasets load instantly, backtests run directly on your hardware, 
              and security-sensitive operations never leave your machine.
            </p>
          </div>
        </section>

        <section className={styles.philosophy} aria-labelledby="philosophy-title">
          <div className={styles.philosophyContent}>
            <h2 id="philosophy-title">Evidence over intuition.<br /><em>Robustness over optimization.</em></h2>
          </div>
        </section>

        <section className={styles.windowsSection} aria-labelledby="windows-title">
          <div className={styles.windowsContent}>
            <p className={styles.eyebrow}>NATIVE WINDOWS</p>
            <h2 id="windows-title">Professional analysis,<br /><em>built for desktop.</em></h2>
            <p>
              Local-first execution with a native graphics surface and research-only safeguards.
              Follow the signed release verification path as the desktop build matures.
            </p>
            <Link href="/download" className={styles.primaryButton}>Windows release status <ArrowIcon /></Link>
          </div>
        </section>

        <section className={styles.finalCta} aria-labelledby="cta-title">
          <h2 id="cta-title">See more.<br /><em>Guess less.</em></h2>
          <div className={styles.finalCtaActions}>
            <Link className={styles.primaryButton} href="/download">Explore ZTerminal for Windows <ArrowIcon /></Link>
            <Link className={styles.secondaryButton} href="/terminal">Launch web terminal</Link>
          </div>
        </section>

        <PublicFooter />
      </div>
    </main>
  );
}
