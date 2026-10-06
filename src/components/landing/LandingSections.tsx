import Link from "next/link";
import { EXAMPLES } from "@/lib/local-research/examples";
import { ProductFigure } from "./ProductFigure";
import { captures } from "./landing-content";
import styles from "./landing.module.css";

export function CapabilitySections() {
  return (
    <section className={`${styles.capabilities} ${styles.container}`} aria-label="Inside ZTerminal">
      <article data-public-reveal="content" className={styles.capability} aria-labelledby="market-heading">
        <div className={styles.capabilityCopy}>
          <p className={styles.eyebrow}>02 / The market canvas</p>
          <h2 id="market-heading">More context.<br />Less switching.</h2>
          <p>Bring price, volume and research tools into the same field of view. Arrange charts and studies around the question you are asking.</p>
          <dl className={styles.capabilityList}>
            <div><dt>Charting &amp; studies</dt><dd>Multiple horizons, indicators and drawing tools.</dd></div>
            <div><dt>Market context</dt><dd>Provider, contract and feed state remain visible.</dd></div>
            <div><dt>A workspace that stays yours</dt><dd>Save layouts and return to your research.</dd></div>
          </dl>
          <Link href="/terminal" className={styles.textLink}>Explore the workspace<span aria-hidden="true">↗</span></Link>
        </div>
        <div className={styles.capabilityVisual}><ProductFigure capture={captures.canvas} /></div>
      </article>
      <article data-public-reveal="content" className={`${styles.capability} ${styles.researchCapability}`} aria-labelledby="evidence-heading">
        <div className={styles.capabilityCopy}>
          <p className={styles.eyebrow}>03 / Research with provenance</p>
          <h2 id="evidence-heading">Own the question.<br />Keep the evidence.</h2>
          <p>Use familiar Python to express a strategy. Run it locally, then keep the source, selected data, assumptions and result together.</p>
          <dl className={styles.capabilityList}>
            <div><dt>Explicit assumptions</dt><dd>Fees, slippage, sizing and historical range.</dd></div>
            <div><dt>Inspect the outcome</dt><dd>Performance, trades, risk and research logs.</dd></div>
            <div><dt>Traceable runs</dt><dd>Source, dataset and result identities in the local archive.</dd></div>
          </dl>
          <Link href="/docs/python-research" className={styles.textLink}>Read the Python research guide<span aria-hidden="true">↗</span></Link>
        </div>
        <div className={styles.codeEvidence}>
          <div className={styles.codeHeader}><span className={styles.codeDot} aria-hidden="true" /><span>moving_average.py</span><span>Python / ZTerminal SDK</span></div>
          <pre className={styles.codeSnippet}><code>{EXAMPLES[0].source}</code></pre>
          <div className={styles.codeFooter}><span>Educational strategy example</span><span>Local execution</span></div>
          <div className={styles.evidenceLine}><span aria-hidden="true">↓</span><p>Source + data + assumptions<br /><strong>A reproducible research record.</strong></p></div>
        </div>
      </article>
    </section>
  );
}

export function EcosystemSection() {
  return (
    <section data-public-reveal="content" className={styles.ecosystem} aria-labelledby="ecosystem-heading">
      <div className={`${styles.container} ${styles.ecosystemLayout}`}>
        <div className={styles.ecosystemCopy}>
          <p className={styles.eyebrow}>04 / Your research environment</p>
          <h2 id="ecosystem-heading">The web, within reach.<br /><em>Your compute, under control.</em></h2>
          <p>Inspect markets and develop ideas in the browser. Python research runs through the paired local Helper on your machine.</p>
        </div>
        <div className={styles.platforms}>
          <div className={styles.platform}><span className={styles.platformIcon} aria-hidden="true">◎</span><div><h3>ZTerminal Web</h3><p>Open the research workspace in your browser.</p><Link href="/terminal" className={styles.textLink}>Open ZTerminal<span aria-hidden="true">↗</span></Link></div><span className={styles.platformStatus}>Available</span></div>
          <div className={styles.platform}><svg className={styles.platformIcon} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 5.5 11 4.4v7H3Zm10-1.4L21 3v8.4h-8ZM3 13h8v7L3 18.8Zm10 0h8v8.5L13 20.4Z" /></svg><div><h3>ZTerminal Windows</h3><p>A native workstation in development.</p><Link href="/download" className={styles.textLink}>View release status<span aria-hidden="true">↗</span></Link></div><span className={styles.platformStatus}>In development</span></div>
        </div>
      </div>
    </section>
  );
}

export function FinalCTA() {
  return (
    <section data-public-reveal="content" className={`${styles.finalSection} ${styles.container}`} aria-labelledby="final-heading">
      <p className={styles.eyebrow}>Begin with a question</p>
      <h2 id="final-heading">Research, <em>with context.</em></h2>
      <p>Follow the market. Test the idea. Understand the evidence.</p>
      <div className={styles.actions}><Link href="/terminal" className={styles.primaryButton}>Open ZTerminal<span aria-hidden="true">↗</span></Link><Link href="/docs" className={styles.textLink}>Read the documentation<span aria-hidden="true">↗</span></Link></div>
    </section>
  );
}
