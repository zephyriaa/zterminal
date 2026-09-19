"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import styles from "./system-reveal.module.css";
import { SystemRevealStage } from "./SystemRevealStage";
import { SystemRevealCopy } from "./SystemRevealCopy";

const MEDIA_GATES = [
  "(max-width: 720px)",
  "(orientation: portrait) and (max-width: 1024px)",
  "(orientation: portrait) and (pointer: coarse)",
  "(orientation: landscape) and (pointer: coarse) and (max-height: 560px)",
  "(prefers-reduced-motion: reduce)",
];

function checkStaticMode(): boolean {
  if (typeof window === "undefined") return false;
  return MEDIA_GATES.some((query) => window.matchMedia(query).matches);
}

export function SystemReveal() {
  const containerRef = useRef<HTMLElement>(null);
  const [isStatic, setIsStatic] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);

  // High performance RAF lerping refs
  const targetProgressRef = useRef<number>(0);
  const currentProgressRef = useRef<number>(0);
  const isVisibleRef = useRef<boolean>(true);
  const rafIdRef = useRef<number | null>(null);

  // 1. Five Static-Hero Media Gates (Live Listener Registration)
  useEffect(() => {
    const updateStaticState = () => {
      setIsStatic(checkStaticMode());
    };

    updateStaticState();

    const matchMediaInstances = MEDIA_GATES.map((query) => window.matchMedia(query));
    matchMediaInstances.forEach((mql) => mql.addEventListener("change", updateStaticState));

    return () => {
      matchMediaInstances.forEach((mql) => mql.removeEventListener("change", updateStaticState));
    };
  }, []);

  // 2. IntersectionObserver to freeze updates when offscreen
  useEffect(() => {
    const node = containerRef.current;
    if (!node || isStatic) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        isVisibleRef.current = entry.isIntersecting;
      },
      { rootMargin: "100px 0px 100px 0px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [isStatic]);

  // 3. Scroll position tracking & frame-rate-independent lerp
  const handleScroll = useCallback(() => {
    const node = containerRef.current;
    if (!node || isStatic || !isVisibleRef.current) return;

    const rect = node.getBoundingClientRect();
    const scrollableDistance = rect.height - window.innerHeight;

    if (scrollableDistance <= 0) return;

    // Progress 0 to 1 through the pinned scroll container
    const rawP = -rect.top / scrollableDistance;
    const clampedP = Math.max(0, Math.min(1, rawP));

    targetProgressRef.current = clampedP;
  }, [isStatic]);

  useEffect(() => {
    if (isStatic) return;

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    let lastTime = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(32, now - lastTime);
      lastTime = now;

      if (isVisibleRef.current) {
        const target = targetProgressRef.current;
        const current = currentProgressRef.current;
        const diff = target - current;

        // Frame-rate-independent lerp
        if (Math.abs(diff) > 0.0005) {
          const smoothing = 0.12;
          const factor = 1 - Math.pow(1 - smoothing, dt / 16.667);
          const next = current + diff * factor;
          currentProgressRef.current = next;

          // Delta-gated state write to prevent unnecessary React rerenders
          setProgress(Number(next.toFixed(4)));
        }
      }

      rafIdRef.current = requestAnimationFrame(tick);
    };

    rafIdRef.current = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, [handleScroll, isStatic]);

  // HUD State Label computation
  const getHudStateLabel = (p: number) => {
    if (p < 0.20) return "STATE 01 · ASSEMBLED";
    if (p < 0.45) return "STATE 02 · SIGNALS SEPARATING";
    if (p < 0.72) return "STATE 03 · WORKFLOW OPEN";
    return "STATE 04 · EXPLODED SYSTEM";
  };

  return (
    <section
      ref={containerRef}
      id="system-reveal"
      className={styles.scrollContainer}
      aria-label="ZTerminal deconstructed quantitative research architecture"
      data-testid="system-reveal-section"
    >
      <div className={styles.stickyStage}>
        {/* Deep Space Vignette & Ambient Radial Glows */}
        <div className={styles.ambientVignette} aria-hidden="true" />
        <div className={styles.ambientDepthGlow} aria-hidden="true" />

        {/* 4-Layer Legibility Narrative Overlays */}
        <SystemRevealCopy progress={progress} isStatic={isStatic} />

        {/* 3D Exploded Workstation Stage */}
        <SystemRevealStage progress={progress} isStatic={isStatic} />

        {/* Technical HUD Tracker */}
        {!isStatic && (
          <div className={styles.hudTracker} aria-hidden="true">
            <div className={styles.hudPill}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#34d399", display: "inline-block" }} />
              <span>{getHudStateLabel(progress)}</span>
            </div>
            <div className={styles.hudBar}>
              <div
                className={styles.hudFill}
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
            <span style={{ fontFamily: "var(--font-geist-mono, monospace)", fontSize: 10 }}>
              {Math.round(progress * 100)}%
            </span>
          </div>
        )}
      </div>
    </section>
  );
}
export default SystemReveal;
