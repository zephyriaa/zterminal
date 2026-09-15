"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./motion.module.css";
import publicStyles from "@/components/public/public-shared.module.css";

interface ScrollHeaderProps {
  children?: React.ReactNode;
  activePath?: string;
}

export function ScrollHeader({ children, activePath }: ScrollHeaderProps) {
  const pathname = usePathname();
  const [hidden, setHidden] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

  // Subpages like /docs and /download have content beginning immediately below the header
  const isDocsOrSubpage = pathname?.startsWith("/docs") || pathname?.startsWith("/download");
  const isHeaderSolid = scrolled || isDocsOrSubpage;

  useEffect(() => {
    let lastScrollY = window.scrollY;
    let ticking = false;

    function onScroll() {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentY = window.scrollY;
          const totalHeight = document.documentElement.scrollHeight - window.innerHeight;

          // Progress percentage
          if (totalHeight > 0) {
            setScrollProgress(Math.min(100, Math.max(0, (currentY / totalHeight) * 100)));
          }

          setScrolled(currentY > 20);

          // Scroll direction threshold
          if (currentY > 60 && currentY > lastScrollY + 6) {
            setHidden(true); // scrolling down
          } else if (currentY < lastScrollY - 6 || currentY <= 60) {
            setHidden(false); // scrolling up or near top
          }

          lastScrollY = Math.max(0, currentY);
          ticking = false;
        });
        ticking = true;
      }
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const currentPath = activePath || pathname || "";

  return (
    <div
      className={`${styles.headerWrapper} ${hidden ? styles.headerHidden : styles.headerVisible} ${
        isHeaderSolid ? styles.headerWrapperSolid : ""
      }`}
    >
      {/* 2px hairline scroll progress bar */}
      <div
        className={styles.progressBar}
        style={{ width: `${scrollProgress}%` }}
        aria-hidden="true"
      />

      {children ? (
        children
      ) : (
        <header
          className={`${publicStyles.header} ${
            isHeaderSolid ? publicStyles.headerScrolled : ""
          }`}
        >
          <Link href="/" className={publicStyles.brand} aria-label="ZTerminal home">
            <i className={publicStyles.brandMark} aria-hidden="true" />
            <span className={publicStyles.brandName}>ZTERMINAL</span>
          </Link>
          <nav aria-label="Main navigation" className={publicStyles.nav}>
            <Link
              href="/"
              className={`${publicStyles.navLink} ${
                currentPath === "/" ? publicStyles.navLinkActive : ""
              }`}
              aria-current={currentPath === "/" ? "page" : undefined}
            >
              Overview
            </Link>
            <Link href="/#workflow" className={publicStyles.navLink}>
              Workflow
            </Link>
            <Link
              href="/download"
              className={`${publicStyles.navLink} ${
                currentPath.startsWith("/download") ? publicStyles.navLinkActive : ""
              }`}
              aria-current={currentPath.startsWith("/download") ? "page" : undefined}
            >
              Windows
            </Link>
            <Link
              href="/docs"
              className={`${publicStyles.navLink} ${
                currentPath.startsWith("/docs") ? publicStyles.navLinkActive : ""
              }`}
              aria-current={currentPath.startsWith("/docs") ? "page" : undefined}
            >
              Docs
            </Link>
            <Link
              href="/terminal"
              className={`${publicStyles.navLink} ${
                currentPath.startsWith("/terminal") ? publicStyles.navLinkActive : ""
              }`}
              aria-current={currentPath.startsWith("/terminal") ? "page" : undefined}
            >
              Web terminal
            </Link>
          </nav>
        </header>
      )}
    </div>
  );
}
