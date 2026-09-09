import Link from "next/link";
import styles from "./public-shared.module.css";

export function PublicHeader() {
  return (
    <header className={styles.header}>
      <Link href="/" className={styles.brand} aria-label="ZTerminal home">
        <i className={styles.brandMark} aria-hidden="true" />
        <span className={styles.brandName}>ZTERMINAL</span>
      </Link>
      <nav aria-label="Main navigation" className={styles.nav}>
        <Link href="/" className={styles.navLink}>Overview</Link>
        <Link href="/#workflow" className={styles.navLink}>Workflow</Link>
        <Link href="/download" className={styles.navLink}>Windows</Link>
        <Link href="/docs" className={styles.navLink}>Docs</Link>
        <Link href="/terminal" className={styles.navLink}>Web terminal</Link>
      </nav>
    </header>
  );
}
