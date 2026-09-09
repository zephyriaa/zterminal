import Link from "next/link";
import styles from "./public-shared.module.css";

export function PublicHeader() {
  return (
    <header className={styles.header}>
      <Link href="/" className={styles.brand} aria-label="ZTerminal home">
        <img src="/landing/zterminal-logo-mark.png" alt="" />
        <span>ZTERMINAL</span>
      </Link>
      <nav aria-label="Primary public navigation" className={styles.nav}>
        <Link href="/">Overview</Link>
        <Link href="/#workflow">Workflow</Link>
        <Link href="/download">Windows</Link>
        <Link href="/terminal">Web terminal</Link>
      </nav>
    </header>
  );
}

