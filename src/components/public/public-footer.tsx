import Link from "next/link";
import Image from "next/image";
import styles from "./public-shared.module.css";

export function PublicFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerInner}>
        <div className={styles.footerBrandRow}>
          <div className={styles.brand}>
            <span className={styles.brandMarkFrame}>
              <Image
                src="/brand/zterminal-mark-v2.png"
                alt="ZTerminal brand mark"
                width={20}
                height={20}
                className={styles.brandMarkImage}
              />
            </span>
            <span className={styles.brandName}>
              ZTERMINAL
              <span className={styles.betaBadge} aria-label="Beta product">
                BETA
              </span>
            </span>
          </div>
          <div className={styles.footerStatusIndicator}>
            <span className={styles.footerStatusDot} aria-hidden="true" />
            <span>WEB TERMINAL AVAILABLE · LOCAL ENGINE PYTHON 3.11+</span>
          </div>
        </div>

        <div className={styles.footerColumns}>
          <div className={styles.footerCol}>
            <p className={styles.footerColHeading}>PRODUCT</p>
            <ul className={styles.footerColList}>
              <li>
                <Link href="/">Overview</Link>
              </li>
              <li>
                <Link href="/research">Research loop</Link>
              </li>
              <li>
                <Link href="/download">Windows workstation</Link>
              </li>
              <li>
                <Link href="/terminal">Open Web Terminal ↗</Link>
              </li>
            </ul>
          </div>

          <div className={styles.footerCol}>
            <p className={styles.footerColHeading}>DOCUMENTATION</p>
            <ul className={styles.footerColList}>
              <li>
                <Link href="/docs">Docs overview</Link>
              </li>
              <li>
                <Link href="/docs/windows/install">Windows installation</Link>
              </li>
              <li>
                <Link href="/docs/python-research">Python Research API</Link>
              </li>
              <li>
                <Link href="/docs/zscript">ZScript migration</Link>
              </li>
            </ul>
          </div>

          <div className={styles.footerCol}>
            <p className={styles.footerColHeading}>METHODOLOGY</p>
            <ul className={styles.footerColList}>
              <li>
                <Link href="/research#loop">6-stage empirical loop</Link>
              </li>
              <li>
                <Link href="/research#code-heading">Vectorized simulation</Link>
              </li>
              <li>
                <Link href="/research#boundary-heading">Local compute boundary</Link>
              </li>
              <li>
                <Link href="/download#security-title">SHA-256 verification</Link>
              </li>
            </ul>
          </div>

          <div className={styles.footerCol}>
            <p className={styles.footerColHeading}>SYSTEM</p>
            <ul className={styles.footerColList}>
              <li>
                <a
                  href="https://github.com/zephyriaa/zterminal"
                  target="_blank"
                  rel="noreferrer"
                >
                  GitHub Repository ↗
                </a>
              </li>
              <li>
                <span className={styles.footerStaticItem}>Architecture: x64 Windows / Web</span>
              </li>
              <li>
                <span className={styles.footerStaticItem}>Runtime: Python 3.11+ / Rust</span>
              </li>
              <li>
                <span className={styles.footerStaticItem}>Channel: Pre-release verification</span>
              </li>
            </ul>
          </div>
        </div>

        <div className={styles.footerBottom}>
          <div className={styles.footerSignoff}>
            <p className={styles.footerQuote}>Research, with context.</p>
            <span className={styles.footerCopyright}>
              © {new Date().getFullYear()} ZTerminal. Open research platform.
            </span>
          </div>
          <p className={styles.disclaimer}>
            Decision-support software. Market data streams can be delayed or incomplete. Backtest
            simulations are hypothetical models subject to parameter sensitivity and execution friction,
            not guarantees of future financial outcomes.
          </p>
        </div>
      </div>
    </footer>
  );
}
