import Link from "next/link";
import styles from "./public-shared.module.css";

export function PublicFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerTop}>
        <div className={styles.brand}>
          <i className={styles.brandMark} aria-hidden="true" />
          <span className={styles.brandName}>
            ZTERMINAL
            <span className={styles.betaBadge} aria-label="Beta product">BETA</span>
          </span>
        </div>
        <div className={styles.footerLinks}>
          <a href="https://github.com/zephyriaa/zterminal" target="_blank" rel="noreferrer">GitHub <span aria-hidden="true">↗</span></a>
          <Link href="/docs">Windows Installation</Link>
          <Link href="/docs">Documentation</Link>
          <Link href="/terminal">Open ZTerminal</Link>
        </div>
      </div>
      <div className={styles.footerBottom}>
        <p>See further. Test assumptions. Keep the evidence.</p>
        <p className={styles.disclaimer}>Decision-support software. Market data can be delayed or incomplete; research results are hypothetical.</p>
      </div>
    </footer>
  );
}
