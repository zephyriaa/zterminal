import Link from "next/link";

import { PublicFooter } from "@/components/public/public-footer";
import { PublicHeader } from "@/components/public/public-header";
import "@/components/public/public-theme.css";

import styles from "./docs.module.css";

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${styles.page} publicScope`}>
      <PublicHeader />
      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <div className={styles.sidebarSticky}>
            <p className={styles.sidebarLabel}>DOCUMENTATION</p>
            <nav aria-label="Documentation navigation" className={styles.sidebarNav}>
              <Link href="/docs" className={styles.sidebarLink}>Overview</Link>
              <Link href="/docs/windows/install" className={styles.sidebarLink}>Windows installation</Link>
              <Link href="/docs/python-research" className={styles.sidebarLink}>Python Research API</Link>
              <Link href="/docs/zscript" className={styles.sidebarLink}>ZScript migration</Link>
            </nav>
            <span className={styles.sidebarQuote}>Research, with context.</span>
          </div>
        </aside>
        <div className={styles.reader}>{children}</div>
      </div>
      <PublicFooter />
    </div>
  );
}
