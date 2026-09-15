"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./docs.module.css";

const DOCS_NAV = [
  { href: "/docs", label: "Overview" },
  { href: "/docs/windows/install", label: "Windows installation" },
  { href: "/docs/python-research", label: "Python Research API" },
  { href: "/docs/zscript", label: "ZScript migration" },
];

export function DocsSidebarNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Documentation navigation" className={styles.sidebarNav}>
      {DOCS_NAV.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`${styles.sidebarLink} ${isActive ? styles.sidebarLinkActive : ""}`}
            aria-current={isActive ? "page" : undefined}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
