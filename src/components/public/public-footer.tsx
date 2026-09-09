import Link from "next/link";
import styles from "./public-shared.module.css";

export function PublicFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerTop}>
        <div className={styles.brand}>
          <img src="/landing/zterminal-logo-mark.png" alt="" />
          <span>ZTERMINAL</span>
        </div>
        <div className={styles.footerLinks}>
          <a href="https://github.com/zephyriaa/zterminal" target="_blank" rel="noreferrer">GitHub</a>
          <Link href="/docs/zscript">ZS documentation</Link>
        </div>
      </div>
      <div className={styles.footerBottom}>
        <p>Quantitative market research and decision support. Built in the open.</p>
        <p className={styles.disclaimer}>Decision support for traders. No broker route. You retain control of execution.</p>
      </div>
    </footer>
  );
}

