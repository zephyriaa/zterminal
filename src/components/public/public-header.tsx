"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import styles from "./public-shared.module.css";
import { PublicMotion } from "./public-motion";

const NAV_LINKS = [
  { href: "/", label: "Product" },
  { href: "/research", label: "Research" },
  { href: "/docs", label: "Docs" },
  { href: "/download", label: "Download" },
];

export function PublicHeader({ overlay = false, hero = false }: { overlay?: boolean; hero?: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const pressedControl = useRef<HTMLElement | null>(null);
  const releasePress = useCallback(() => {
    pressedControl.current?.removeAttribute("data-pressed");
    pressedControl.current = null;
  }, []);

  useEffect(() => {
    window.addEventListener("pointerup", releasePress);
    window.addEventListener("pointercancel", releasePress);
    window.addEventListener("blur", releasePress);
    return () => {
      releasePress();
      window.removeEventListener("pointerup", releasePress);
      window.removeEventListener("pointercancel", releasePress);
      window.removeEventListener("blur", releasePress);
    };
  }, [releasePress]);

  const placePressHighlight = (event: PointerEvent<HTMLElement>) => {
    if (!event.isPrimary || event.button !== 0) return;
    releasePress();
    const control = (event.target as Element).closest<HTMLElement>("a, button");
    if (!control || !event.currentTarget.contains(control)) return;
    const bounds = control.getBoundingClientRect();
    control.style.setProperty("--press-x", `${event.clientX - bounds.left}px`);
    control.style.setProperty("--press-y", `${event.clientY - bounds.top}px`);
    control.dataset.pressed = "true";
    pressedControl.current = control;
  };

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
    <div className={`${styles.headerWrapper} ${overlay ? styles.overlay : ""} ${hero ? styles.heroHeader : ""}`}>
      <PublicMotion />
      <header
        className={`${styles.header} ${isScrolled ? styles.headerScrolled : ""}`}
        aria-label="Site navigation"
        onPointerDown={placePressHighlight}
        onPointerLeave={releasePress}
      >
        {/* Canonical mark; its transparent source padding is handled in CSS. */}
        <Link href="/" className={styles.brand} aria-label="ZTerminal home">
          <span className={styles.brandMarkFrame}>
            <Image
              src="/brand/zterminal-mark-v2.png"
              alt="ZTerminal"
              width={80}
              height={80}
              preload
              className={styles.brandMarkImage}
            />
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
