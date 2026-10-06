import Link from "next/link";
import { ProductFigure } from "./ProductFigure";
import { captures } from "./landing-content";
import { HeroAtmosphere } from "./HeroAtmosphere";
import styles from "./landing.module.css";

export function LandingHero() {
  return (
    <section className={styles.hero} aria-labelledby="hero-heading" data-hero-scene="">
      <HeroAtmosphere />
      <div className={styles.heroAtmosphere} aria-hidden="true">
        <div className={styles.lightVault} />
        <div className={styles.lightBeam} />
        <div className={styles.lightHorizon} />
        <div className={styles.sceneGrain} />
      </div>
      <div className={styles.heroCopy}>
        <p className={styles.eyebrow}><span className={styles.signal} aria-hidden="true" />A market research environment</p>
        <h1 id="hero-heading" className={styles.heroTitle}><span>See Further.</span><em>Guess Less.</em></h1>
        <p className={styles.heroLead}>Charts, Python strategies, backtesting and analysis.<br className={styles.desktopBreak} /> One local-first workspace for the entire research loop.</p>
        <div className={styles.actions}>
          <Link href="/terminal" className={styles.primaryButton}>Open ZTerminal<span aria-hidden="true">↗</span></Link>
          <a href="#research-loop" className={styles.textLink}>Explore the workflow<span aria-hidden="true">↓</span></a>
        </div>
        <p className={styles.heroNote}>Web terminal available<span aria-hidden="true">/</span>Python runs on your machine</p>
      </div>
      <div className={`${styles.heroStage} ${styles.container}`}>
        <div className={styles.stageLight} aria-hidden="true" />
        <ProductFigure capture={captures.workspace} hero />
      </div>
      <div className={`${styles.proposition} ${styles.container}`}>
        <p className={styles.eyebrow}>One environment. A continuous process.</p>
        <p>Most trading research is fragmented.<br /><span>Keep the question, the code and the evidence together.</span></p>
        <div className={styles.tenets}><span>Market context</span><span>Standard Python</span><span>Traceable research</span></div>
      </div>
    </section>
  );
}
