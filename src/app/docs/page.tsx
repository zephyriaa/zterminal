import type { Metadata } from "next";
import Link from "next/link";

import styles from "./docs.module.css";

export const metadata: Metadata = {
  title: "Documentation — ZTerminal",
  description: "Official guides, Python research API reference, and installation documents for ZTerminal.",
};

const GUIDES = [
  {
    title: "Windows installation",
    tag: "WORKSTATION SETUP",
    description: "Verified release availability, code signing, cryptographic checksum verification, and native installation.",
    href: "/docs/windows/install",
  },
  {
    title: "Python Research API",
    tag: "STRATEGY DEVELOPMENT",
    description: "Write Python strategies, run local research, and inspect reproducible backtest evidence.",
    href: "/docs/python-research",
  },
  {
    title: "ZScript migration",
    tag: "ARCHIVAL RECORD",
    description: "Understand the move from legacy ZScript to standard Python, and how archived run records are preserved.",
    href: "/docs/zscript",
  },
];

export default function DocumentationPage() {
  return (
    <article className={styles.intro}>
      <p className={styles.eyebrow}>GETTING STARTED</p>
      <h1 className={styles.docTitle}>
        A reference for{" "}
        <em>your research.</em>
      </h1>
      <p className={styles.docLead}>
        ZTerminal is a market research workspace in active development. These guides describe available workflows, data boundaries, execution models, and assumptions.
      </p>

      <div className={styles.guideList}>
        {GUIDES.map((g) => (
          <Link className={styles.guideCard} href={g.href} key={g.href}>
            <div className={styles.guideHeader}>
              <span className={styles.guideTag}>{g.tag}</span>
              <span className={styles.guideArrow} aria-hidden="true">↗</span>
            </div>
            <h2 className={styles.guideTitle}>{g.title}</h2>
            <p className={styles.guideDesc}>{g.description}</p>
          </Link>
        ))}
      </div>
    </article>
  );
}
