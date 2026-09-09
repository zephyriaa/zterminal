import Link from "next/link";
import styles from "./public-shared.module.css";

export function PublicFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerTop}>
        <div className={styles.brand}>
          <i className={styles.brandMark} aria-hidden="true" />
          <span className={styles.brandName}>ZTERMINAL</span>
        </div>
        <div className={styles.footerLinks}>
          <a href="https://github.com/zephyriaa/zterminal" target="_blank" rel="noreferrer">GitHub <span aria-hidden="true">↗</span></a>
          <Link href="/download">Windows Workstation</Link>
          <Link href="/docs">Documentation</Link>
          <Link href="/terminal">Web Terminal</Link>
        </div>
      </div>
      <div className={styles.footerBottom}>
        <p>Quantitative market research and decision support workstation. Client-first architecture.</p>
        <p className={styles.disclaimer}>Decision support for traders. No broker route. You retain control of execution.</p>
      </div>
    </footer>
  );
}
