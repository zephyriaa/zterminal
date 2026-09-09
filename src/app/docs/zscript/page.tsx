import type { Metadata } from "next";
import Link from "next/link";
import styles from "../docs.module.css";

export const metadata: Metadata = {
  title: "ZScript Migration — ZTerminal Documentation",
  description: "Official record on the deprecation of legacy ZScript and migration to the Python Research API.",
};

function Arrow() {
  return <span className={styles.arrow} aria-hidden="true">↗</span>;
}

export default function ZScriptMigrationPage() {
  return (
    <article className={styles.docArticle}>
      <Link href="/docs" className={styles.backLink}>← Documentation index</Link>

      <div className={styles.archiveBadge}>ARCHIVAL RECORD · LANGUAGE RETIRED</div>

      <h1 className={styles.docTitle}>
        ZScript is retired
        <em>for new research.</em>
      </h1>
      <p className={styles.docLead}>
        ZTerminal has transitioned all new strategy authoring and quantitative validation to the Python Research API. Legacy ZScript source code and previous run logs remain exportable for audit purposes, but ZScript is no longer the recommended or active execution path.
      </p>

      {/* WHY PYTHON */}
      <section className={styles.docSection}>
        <h2 className={styles.sectionTitle}>Why standard Python &amp; vectorbt</h2>
        <p className={styles.sectionPara}>
          Proprietary domain-specific languages limit portability, introduce hidden compilation bugs, and isolate quants from the broader scientific Python ecosystem (NumPy, SciPy, pandas, Polars, scikit-learn). Moving to standard Python gives traders:
        </p>
        <ul className={styles.bulletList}>
          <li>
            <strong>Ecosystem Access:</strong> Direct integration with vectorbt, Polars, and scientific libraries without translation layers.
          </li>
          <li>
            <strong>Vectorized Speed:</strong> Native C/Rust underlying execution without DSL interpretation overhead.
          </li>
          <li>
            <strong>Deterministic Reproducibility:</strong> Python code runs natively on your CPU under exact environment manifests.
          </li>
        </ul>
      </section>

      {/* WHAT REMAINS */}
      <section className={styles.docSection}>
        <h2 className={styles.sectionTitle}>What happens to historical ZScript records</h2>
        <p className={styles.sectionPara}>
          Previous ZScript runs are preserved as read-only historical records in your archive. ZTerminal will never silently rewrite or reinterpret legacy ZS code. If you wish to run historical tests forward, migrate the logic to standard Python using the SDK v1 patterns.
        </p>
        <div className={styles.callout}>
          <strong>Audit Principle:</strong> Historical research data is immutable. Prior backtest results generated under ZScript remain archived with their original timestamped hashes.
        </div>
      </section>

      {/* CTA */}
      <section className={styles.docSection}>
        <h2 className={styles.sectionTitle}>Get started with Python</h2>
        <p className={styles.sectionPara}>
          Learn how to pair the local helper and write your first vectorized strategy using the new API.
        </p>
        <div className={styles.linkRow}>
          <Link href="/docs/python-research" className={styles.primaryButtonSmall}>
            Open Python Research API guide <Arrow />
          </Link>
        </div>
      </section>
    </article>
  );
}
