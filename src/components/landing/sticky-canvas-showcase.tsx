"use client";

import React from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { LaserScannerSweep } from "./vector-motion-graphics";
import styles from "./sticky-canvas-showcase.module.css";

interface Annotation {
  tag: string;
  spec: string;
  desc: string;
}

const ANNOTATIONS: Annotation[] = [
  {
    tag: "DIRECT L2 FEED",
    spec: "0.38MS LATENCY",
    desc: "Zero Cloud Proxy. Connect directly to exchange matching engines with sub-millisecond execution. Zero dropped ticks, zero packet queuing, and zero third-party lag.",
  },
  {
    tag: "ORDER BOOK HEATMAP",
    spec: "REAL-TIME DEPTH",
    desc: "Live Liquidity Topography. Watch institutional resting limit orders, depth imbalances, and hidden bid/ask walls materialize in real time before price reaches them.",
  },
  {
    tag: "60 FPS ORDER FLOW",
    spec: "CVD & SWEEP ENGINE",
    desc: "Institutional Footprint. Identify aggressive market absorption and volume delta divergences rendered with buttery smooth 60fps WebGL hardware acceleration.",
  },
  {
    tag: "MULTI-TIMEFRAME CONFLUENCE",
    spec: "SYNCHRONIZED CANVAS",
    desc: "Macro-to-Micro Alignment. Project session VWAPs, composite volume profiles, and liquidity pools seamlessly alongside your fast execution triggers.",
  },
  {
    tag: "SUB-BAR TICK REPLAY",
    spec: "MICROSTRUCTURE MAGNIFIER",
    desc: "Audit-Grade Replay. Deconstruct violent liquidity spikes down to the millisecond sequence. Verify exact fill order without hypothetical illusions.",
  },
  {
    tag: "BARE-METAL SOVEREIGNTY",
    spec: "100% PRIVATE ALPHA",
    desc: "Absolute Code Custody. Run vectorized Python strategies and custom indicators directly on your local CPU/GPU. Your algorithms never leave your computer.",
  },
];

export function StickyCanvasShowcase() {
  return (
    <section className={styles.canvasSection} id="canvas" aria-labelledby="canvas-heading">
      {/* Section Header */}
      <div className={styles.intro}>
        <p className={styles.eyebrow}>05 / HIGH-SPEED CANVAS</p>
        <h2 id="canvas-heading" className={styles.heading}>
          Live market structure at the speed of thought.
        </h2>
        <p className={styles.leadText}>
          Zero cloud lag. Zero dropped ticks. Stream sub-millisecond Level 2 order books, institutional volume delta, and dynamic liquidity depth directly onto a hardware-accelerated workstation canvas.
        </p>

        <div className={styles.badgeRail} aria-label="Terminal canvas specifications">
          <span className={styles.badge}>BTC / USDT PERP</span>
          <span className={`${styles.badge} ${styles.badgeActive}`}>DIRECT L2 FEED (0.38MS)</span>
          <span className={styles.badge}>60 FPS HARDWARE WEBGL</span>
          <span className={styles.badge}>ZERO CLOUD PROXY</span>
          <span className={styles.badge}>UNFILTERED TICK DEPTH</span>
        </div>
      </div>

      {/* Dominant Terminal Canvas Window */}
      <div className={styles.canvasStage}>
        {/* Sleek Window Chrome */}
        <div className={styles.canvasChrome}>
          <div className={styles.chromeLeft}>
            <div className={styles.dots} aria-hidden="true">
              <span className={styles.dotClose} />
              <span className={styles.dotMin} />
              <span className={styles.dotMax} />
            </div>
            <span className={styles.chromeTab}>BTC/USDT · 5M PERPETUAL · DESK_WORKSPACE_01</span>
          </div>

          <div className={styles.chromeRight}>
            <span className={styles.chromeTelemetry}>ENGINE: 60 FPS WEBGL</span>
            <span className={styles.chromeTelemetry}>LATENCY: 0.38ms</span>
            <span className={styles.chromeTelemetry}>LOSS: 0.00%</span>
            <div className={styles.liveChip}>
              <span className={styles.liveDot} aria-hidden="true" />
              <span>DIRECT L2 STREAM</span>
            </div>
          </div>
        </div>

        {/* High-Resolution Workstation Canvas */}
        <div className={styles.imageWrapper}>
          <LaserScannerSweep />
          <Image
            src="/landing/terminal-screenshot.webp"
            alt="ZTerminal high-speed market canvas displaying live BTC/USDT price structure, order flow depth, and institutional indicators"
            width={3200}
            height={1800}
            priority
            sizes="(max-width: 1024px) 100vw, 1440px"
            className={styles.canvasImage}
          />
        </div>
      </div>

      {/* High-Impact Workstation Annotations Grid */}
      <div className={styles.annotationGrid} aria-label="Terminal workstation capabilities">
        {ANNOTATIONS.map((item) => (
          <motion.article
            key={item.tag}
            className={styles.annotationCard}
            whileHover={{ y: -4, transition: { duration: 0.22, ease: [0.16, 1, 0.3, 1] } }}
          >
            <div className={styles.annotationHeader}>
              <span className={styles.annotationTag}>{item.tag}</span>
              <span className={styles.annotationSpec}>{item.spec}</span>
            </div>
            <p className={styles.annotationText}>{item.desc}</p>
          </motion.article>
        ))}
      </div>
    </section>
  );
}
