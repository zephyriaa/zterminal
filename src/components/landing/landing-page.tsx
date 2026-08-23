import Link from "next/link";
import { OrderflowVisual } from "./orderflow-visual";
import styles from "./landing-page.module.css";

const capabilities = [
  { label: "MARKET CONTEXT", title: "See the structure around the move.", copy: "Price sits beside volume, liquidity, volatility, session structure, and market regime. Context turns a chart into a place you can reason about.", signal: "CONTEXT / LIVE VIEW" },
  { label: "STRATEGY RESEARCH", title: "Turn a thought into a testable rule.", copy: "Write the hypothesis, test it against history, inspect how it behaves, and put the optimistic backtest under pressure before it earns trust.", signal: "RESEARCH / MEASURED" },
  { label: "RISK WORKSPACE", title: "Define the loss before the entry.", copy: "Position sizing, invalidation, exposure, and planned risk belong at the beginning of a trade. The terminal keeps that work in the frame.", signal: "RISK / DEFINED" },
];

const steps = [
  ["01", "Observe", "Start with the market as it is, not the trade you want it to become."],
  ["02", "Validate", "Make the rule clear enough for history to challenge it."],
  ["03", "Decide", "Review the evidence, know the risk, and keep the call human."],
];

export function LandingPage() {
  return (
    <main className={styles.page} id="main">
      <a className={styles.skipLink} href="#platform">Skip to platform overview</a>
      <div className={styles.ambientGrid} aria-hidden="true" />

      <header className={styles.header}>
        <Link className={styles.brand} href="/" aria-label="ZTerminal home">
          <img className={styles.headerLogo} src="/landing/zterminal-logo-mark.png" alt="" />
          <span>ZTERMINAL</span>
        </Link>
        <nav className={styles.nav} aria-label="Primary navigation">
          <a href="#platform">Platform</a><a href="#workflow">Workflow</a><a href="#principles">Principles</a>
        </nav>
        <Link className={styles.headerCta} href="/terminal">Launch terminal <span>↗</span></Link>
      </header>

      <section className={styles.hero} aria-labelledby="hero-title">
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}><span />QUANTITATIVE MARKET INTELLIGENCE</p>
          <h1 id="hero-title">Read the market<br />behind the <em>candle.</em></h1>
          <p className={styles.heroLead}>ZTerminal brings market context, strategy research, risk work, alerts, and review into one serious workspace for better-prepared decisions.</p>
          <div className={styles.heroActions}>
            <Link className={styles.primaryButton} href="/download">Explore ZTerminal for Windows <span>↗</span></Link>
            <Link className={styles.secondaryButton} href="/terminal">Launch web terminal <span>↗</span></Link>
          </div>
          <p className={styles.disclaimer}>Decision support for traders. No broker route. You retain control of execution.</p>
        </div>
        <OrderflowVisual />
      </section>

      <section className={styles.desktopPreview} aria-labelledby="windows-preview-title">
        <div>
          <p className={styles.sectionKicker}>NATIVE WINDOWS APPLICATION</p>
          <h2 id="windows-preview-title">Professional market analysis,<br /><em>now preparing for Windows.</em></h2>
        </div>
        <div className={styles.desktopPreviewCopy}>
          <p>ZTerminal for Windows is being built as a local-first desktop terminal with a native graphics surface, local data processing, and research-only safeguards. It will be offered here only after Windows validation and signed release verification are complete.</p>
          <div><Link href="/download" className={styles.desktopPreviewLink}>View Windows release status <span>↗</span></Link><span>Windows x64 · in development</span></div>
        </div>
      </section>

      <section className={styles.proofRail} aria-label="Platform focus areas">
        <div><span className={styles.railMark}>01</span><b>Market intelligence</b><p>Price in context</p></div>
        <div><span className={styles.railMark}>02</span><b>Quant research</b><p>Rules under pressure</p></div>
        <div><span className={styles.railMark}>03</span><b>Risk workspace</b><p>Loss before entry</p></div>
        <div><span className={styles.railMark}>04</span><b>Human control</b><p>Your call, always</p></div>
      </section>

      <section className={styles.intro} id="platform" aria-labelledby="intro-heading">
        <p className={styles.sectionKicker}>ONE WORKSPACE. MORE CONTEXT.</p>
        <div className={styles.introGrid}>
          <h2 id="intro-heading">Stop collecting signals.<br /><em>Start building a case.</em></h2>
          <div><p className={styles.introAccent}>The strongest trading idea is the one that survives contact with reality.</p><p>ZTerminal is designed around the work that surrounds the decision: understand the market, express a hypothesis clearly, validate it, define the risk, monitor the setup, and learn from the result.</p></div>
        </div>
      </section>

      <section className={styles.platform} aria-label="ZTerminal capability overview">
        {capabilities.map((capability, index) => (
          <article className={styles.capability} key={capability.label}>
            <div className={styles.capabilityIndex}><span>0{index + 1}</span><i /></div>
            <p className={styles.capabilityLabel}>{capability.label}</p><h3>{capability.title}</h3><p>{capability.copy}</p>
            <div className={styles.capabilityVisual} aria-hidden="true">
              <div className={styles.visualHeader}><span>{capability.signal}</span><i /></div>
              {index === 0 && <div className={styles.miniMarket}><b /><b /><b /><b /><b /><b /><b /><b /><b /></div>}
              {index === 1 && <div className={styles.miniResearch}><i /><i /><i /><span>RULES → HISTORY → RESULT</span></div>}
              {index === 2 && <div className={styles.miniRisk}><i><em /></i><i><em /></i><i><em /></i><span>PLAN THE DOWNSIDE</span></div>}
            </div>
          </article>
        ))}
      </section>

      <section className={styles.workflow} id="workflow" aria-labelledby="workflow-heading">
        <div className={styles.workflowTitle}><p className={styles.sectionKicker}>THE ZTERMINAL METHOD</p><h2 id="workflow-heading">More than a chart.<br /><em>A decision loop.</em></h2><p>Every useful action in the terminal should move the trader from raw data toward a decision they can explain.</p></div>
        <div className={styles.stepList}>{steps.map(([number, title, copy]) => <article className={styles.step} key={number}><span>{number}</span><div><h3>{title}</h3><p>{copy}</p></div><i>↗</i></article>)}</div>
      </section>

      <section className={styles.principles} id="principles" aria-labelledby="principles-heading">
        <div className={styles.principleVisual} aria-hidden="true"><div className={styles.orbitA} /><div className={styles.orbitB} /><div className={styles.orbitC} /><div className={styles.principleCore}><span>ZT</span><small>DECISION<br />ENVIRONMENT</small></div><p>CONTEXT</p><p>VALIDATION</p><p>RISK</p><p>REVIEW</p></div>
        <div className={styles.principleCopy}><p className={styles.sectionKicker}>BUILT FOR THE DECISION</p><h2 id="principles-heading">The terminal should support the trader,<br /><em>not replace them.</em></h2><p>ZTerminal is a quantitative research and decision-support environment. It can help with analysis, calculations, validation, monitoring, alerts, and review. It does not guarantee outcomes and it does not remove responsibility.</p><div className={styles.principleStatements}><span>Evidence over intuition</span><span>Risk before conviction</span><span>Human control over blind automation</span></div></div>
      </section>

      <section className={styles.finalCta} aria-labelledby="cta-heading"><p className={styles.sectionKicker}>OPEN THE WORKSPACE</p><h2 id="cta-heading">Bring more evidence<br />to the <em>decision.</em></h2><p>Use the browser terminal today, or follow the verified Windows release path as the native application becomes available.</p><div className={styles.finalCtaActions}><Link className={styles.primaryButton} href="/terminal">Launch web terminal <span>↗</span></Link><Link className={styles.secondaryButton} href="/download">Windows release status <span>↗</span></Link></div></section>

      <footer className={styles.footer}><div className={styles.brand}><img className={styles.headerLogo} src="/landing/zterminal-logo-mark.png" alt="" /><span>ZTERMINAL</span></div><p>Quantitative market research and decision support. Built in the open.</p><div><a href="https://github.com/zephyriaa/zterminal" target="_blank" rel="noreferrer">GitHub</a><a href="/docs/zscript">ZS documentation</a></div></footer>
    </main>
  );
}
