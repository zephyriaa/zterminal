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
        {/* Brand with Framed Specular Z Mark */}
        <Link href="/" className={styles.brand} aria-label="ZTerminal home">
          <span className={styles.brandMarkFrame}>
            <i className={styles.brandMark} aria-hidden="true" />
          </span>
          <span className={styles.brandName}>
            ZTERMINAL
            <span className={styles.betaBadge}>BETA</span>
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

          {/* Liquid Glass Account / Workspace CTA Capsule */}
          <Link
            href="/terminal"
            className={styles.navCta}
            title="Launch ZTerminal Web Workspace"
            onClick={() => setOpen(false)}
          >
            <span className={styles.navStatusDot} aria-hidden="true" />
            <span className={styles.navCtaText}>Open ZTerminal</span>
            <span className={styles.navArrow} aria-hidden="true">
              ↗
            </span>
          </Link>
        </nav>
      </header>
    </div>
  );
}
