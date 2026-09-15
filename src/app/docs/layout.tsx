import { PublicFooter } from "@/components/public/public-footer";
import { PublicHeader } from "@/components/public/public-header";
import { DocsSidebarNav } from "./docs-sidebar-nav";
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
            <DocsSidebarNav />
            <span className={styles.sidebarQuote}>Research, with context.</span>
          </div>
        </aside>
        <div className={styles.reader}>{children}</div>
      </div>
      <PublicFooter />
    </div>
  );
}
