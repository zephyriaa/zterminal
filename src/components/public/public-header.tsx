import Link from "next/link";
import styles from "./public-shared.module.css";

export function PublicHeader() {
  return (
    <header className={styles.header}>
      <Link href="/" className={styles.brand} aria-label="ZTerminal home">
        <img src="/landing/zterminal-logo-mark.png" alt="" className={styles.brandLogo} />
        <span className={styles.brandName}>ZTERMINAL</span>
      </Link>
      <nav aria-label="Primary public navigation" className={styles.nav}>
        <Link href="/" className={styles.navLink}>Overview</Link>
        <Link href="/#workflow" className={styles.navLink}>Workflow</Link>
        <Link href="/terminal" className={styles.navLink}>Web terminal</Link>
      </nav>
    </header>
  );
}
