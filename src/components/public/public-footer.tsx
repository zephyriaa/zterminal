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
        <p>Institutional-grade quantitative workstation for systematic traders.</p>
        <p className={styles.disclaimer}>Decision support software. Zero broker lock-in. You retain 100% control of execution.</p>
      </div>
    </footer>
  );
}
