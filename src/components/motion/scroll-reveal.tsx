"use client";

import React, { useEffect, useRef, useState } from "react";
import styles from "./motion.module.css";

interface ScrollRevealProps {
  children: React.ReactNode;
  className?: string;
  delayMs?: number;
  yOffsetPx?: number;
  threshold?: number;
  as?: "div" | "section" | "article" | "p" | "h1" | "h2" | "h3";
  id?: string;
}

/**
 * Pure CSS + IntersectionObserver scroll reveal.
 * Eliminates heavy runtime overhead of animation libraries for section reveals.
 * Translates translateY(24px) -> translateY(0) with opacity over 600ms.
 */
export function ScrollReveal({
  children,
  className = "",
  delayMs = 0,
  yOffsetPx = 24,
  threshold = 0.15,
  as = "div",
  id,
}: ScrollRevealProps) {
  const ref = useRef<HTMLElement | null>(null);
  const [isRevealed, setIsRevealed] = useState(false);

  useEffect(() => {
    // If user prefers reduced motion, CSS media query already reveals element; skip observer
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            if (delayMs > 0) {
              setTimeout(() => setIsRevealed(true), delayMs);
            } else {
              setIsRevealed(true);
            }
            observer.unobserve(node);
          }
        }
      },
      {
        threshold,
        rootMargin: "0px 0px -40px 0px",
      },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [delayMs, threshold]);

  const Tag = as as any;

  return (
    <Tag
      ref={ref}
      id={id}
      className={`${styles.reveal} ${isRevealed ? styles.revealed : ""} ${className}`}
      style={{
        "--y-offset": `${yOffsetPx}px`,
        transitionDelay: delayMs > 0 ? `${delayMs}ms` : undefined,
      } as React.CSSProperties}
    >
      {children}
    </Tag>
  );
}
