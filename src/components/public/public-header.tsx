"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import styles from "./public-shared.module.css";

const NAV_LINKS = [
  { href: "/", label: "Product" },
  { href: "/research", label: "Research" },
  { href: "/docs", label: "Docs" },
  { href: "/download", label: "Download" },
];

export function PublicHeader({ overlay = false }: { overlay?: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          setIsScrolled(window.scrollY > 20);
          ticking = false;
        });
        ticking = true;
      }
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  const isLinkActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <div className={`${styles.headerWrapper} ${overlay ? styles.overlay : ""}`}>
      <header
        className={`${styles.header} ${isScrolled ? styles.headerScrolled : ""}`}
        aria-label="Sitewide Liquid Glass Navigation"
      >
        {/* Brand with Framed Specular Z Mark matching reference */}
        <Link href="/" className={styles.brand} aria-label="ZTerminal home">
          <span className={styles.brandMarkFrame}>
            <span className={styles.brandLetter}>Z</span>
          </span>
        </Link>

        {/* Mobile Navigation Toggle */}
        <button
          className={`${styles.menuButton} ${open ? styles.menuButtonOpen : ""}`}
          type="button"
          aria-expanded={open}
          aria-controls="public-navigation"
          aria-label={open ? "Close navigation" : "Open navigation"}
          onClick={() => setOpen((prev) => !prev)}
        >
          <span />
          <span />
          <span className={styles.srOnly}>
            {open ? "Close navigation" : "Open navigation"}
          </span>
        </button>

        {/* Primary Desktop Navigation Links */}
        <nav
          id="public-navigation"
          className={`${styles.nav} ${open ? styles.navOpen : ""}`}
          aria-label="Public navigation"
        >
          <div className={styles.navLinksGroup}>
            {NAV_LINKS.map((link) => {
              const active = isLinkActive(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`${styles.navLink} ${active ? styles.navLinkActive : ""}`}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setOpen(false)}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>

          {/* Liquid Glass Account & Workspace Synced Capsule matching reference */}
          <Link
            href="/terminal"
            className={styles.accountCapsule}
            title="Launch ZTerminal Workspace"
            onClick={() => setOpen(false)}
          >
            <div className={styles.accountAvatar}>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <span className={styles.syncDot} aria-hidden="true" />
            </div>
            <div className={styles.accountMeta}>
              <span className={styles.accountName}>ZTerminal Account</span>
              <span className={styles.accountStatus}>Workspace synced</span>
            </div>
            <svg
              className={styles.accountChevron}
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </Link>
        </nav>
      </header>
    </div>
  );
}
