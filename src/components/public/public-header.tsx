"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import styles from "./public-shared.module.css";

const NAV_LINKS = [
  { href: "/", label: "Overview" },
  { href: "/research", label: "Research loop" },
  { href: "/download", label: "Windows" },
  { href: "/docs", label: "Docs" },
];

export function PublicHeader({ overlay = false }: { overlay?: boolean }) {
  const pathname = usePathname();
  const headerRef = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const scrollRatio = Math.min(1, window.scrollY / 70);
      headerRef.current?.style.setProperty("--scroll", String(scrollRatio));
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const isLinkActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <header
      ref={headerRef}
      className={`${styles.header} ${overlay ? styles.overlay : ""}`}
    >
      <Link href="/" className={styles.brand} aria-label="ZTerminal home">
        <i className={styles.brandMark} aria-hidden="true" />
        <span className={styles.brandName}>
          ZTERMINAL
          <span className={styles.betaBadge}>BETA</span>
        </span>
      </Link>

      <button
        className={`${styles.menuButton} ${open ? styles.menuButtonOpen : ""}`}
        type="button"
        aria-expanded={open}
        aria-controls="public-navigation"
        onClick={() => setOpen((prev) => !prev)}
      >
        <span />
        <span />
        <span className={styles.srOnly}>
          {open ? "Close navigation" : "Open navigation"}
        </span>
      </button>

      <nav
        id="public-navigation"
        className={`${styles.nav} ${open ? styles.navOpen : ""}`}
        aria-label="Public navigation"
      >
        {NAV_LINKS.map((link) => {
          const active = isLinkActive(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`${styles.navLink} ${active ? styles.navLinkActive : ""}`}
              aria-current={active ? "page" : undefined}
            >
              {link.label}
            </Link>
          );
        })}
        <Link href="/terminal" className={styles.navCta}>
          <span>Open ZTerminal</span>
          <span className={styles.navArrow} aria-hidden="true">
            ↗
          </span>
        </Link>
      </nav>
    </header>
  );
}
