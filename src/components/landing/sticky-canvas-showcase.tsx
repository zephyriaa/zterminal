"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import styles from "./sticky-canvas-showcase.module.css";

interface CapabilityCard {
  num: string;
  tag: string;
  title: string;
  desc: string;
}

const CAPABILITIES: CapabilityCard[] = [
  {
    num: "01 / PIPELINE",
    tag: "ZERO-LATENCY",
    title: "Direct L2/L3 Exchange Feed",
    desc: "Stream live order books, aggressive trade executions, and millisecond book depth without cloud queue bottlenecks or dropped ticks.",
  },
  {
    num: "02 / ENGINE",
    tag: "DETERMINISTIC",
    title: "Sub-Bar Bar Magnifier",
    desc: "Inspect intra-bar price action down to the second. Eliminates ambiguous High/Low fill order assumptions with authentic tick matching.",
  },
  {
    num: "03 / CONTEXT",
    tag: "CONFLUENCE",
    title: "Multi-Data Correlation Matrix",
    desc: "Overlay Pearson cross-market beta, cumulative volume delta (CVD) divergences, and institutional volume profiles on a single synchronized canvas.",
  },
];

export function StickyCanvasShowcase() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const imageWrapperRef = useRef<HTMLDivElement | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isDesktop = window.matchMedia("(min-width: 900px)").matches;

    if (prefersReduced || !isDesktop) return;

    gsap.registerPlugin(ScrollTrigger);

    const container = containerRef.current;
    const imageWrapper = imageWrapperRef.current;
    if (!container || !imageWrapper) return;

    // Scroll scrub: scale canvas 1.03 -> 1.0 and advance active card
    const trigger = ScrollTrigger.create({
      trigger: container,
      start: "top 90px",
      end: "bottom bottom",
      scrub: 0.5,
      onUpdate: (self) => {
        const progress = self.progress; // 0 to 1

        // Scale 1.03 -> 1.0
        const scale = 1.03 - progress * 0.03;
        gsap.set(imageWrapper, { scale });

        // Update card index
        if (progress < 0.33) {
          setActiveIdx(0);
        } else if (progress < 0.66) {
          setActiveIdx(1);
        } else {
          setActiveIdx(2);
        }
      },
    });

    return () => {
      trigger.kill();
    };
  }, []);

  const current = CAPABILITIES[activeIdx];

  return (
    <div ref={containerRef} className={styles.showcasePinContainer}>
      <div className={styles.showcaseSticky}>
        <div className={styles.intro}>
          <p className={styles.eyebrow}>04 / HIGH-SPEED CANVAS</p>
          <h2 className={styles.heading}>Read the market in context.</h2>
        </div>

        <div className={styles.canvasStage}>
          <div className={styles.canvasChrome}>
            <div className={styles.dots}>
              <span />
              <span />
              <span />
            </div>
            <span className={styles.badge}>BTC / USDT · 5M CANVAS · PERPETUAL · DIRECT L2 FEED</span>
            <span className={styles.chip}>PRO WORKSTATION</span>
          </div>

          <div ref={imageWrapperRef} className={styles.imageWrapper}>
            <Image
              src="/landing/terminal-screenshot.webp"
              alt="Full ZTerminal market canvas displaying real Bitcoin price action and indicators"
              width={3200}
              height={1800}
              priority
              sizes="(max-width: 900px) 95vw, 85vw"
              className={styles.canvasImage}
            />
          </div>

          {/* Floating Capability Cards HUD */}
          <aside className={styles.cardsHud} aria-live="polite">
            <div className={styles.hudCard}>
              <div className={styles.hudStep}>
                <span className={styles.hudStepNum}>{current.num}</span>
                <span className={styles.hudStepTag}>{current.tag}</span>
              </div>
              <h3 className={styles.hudTitle}>{current.title}</h3>
              <p className={styles.hudDesc}>{current.desc}</p>
              <div className={styles.hudPills} aria-hidden="true">
                {CAPABILITIES.map((_, i) => (
                  <span
                    key={i}
                    className={`${styles.hudPill} ${i === activeIdx ? styles.hudPillActive : ""}`}
                  />
                ))}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
