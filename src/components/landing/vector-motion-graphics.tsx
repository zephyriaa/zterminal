"use client";

import React, { useEffect, useState } from "react";
import styles from "./vector-motion-graphics.module.css";

export function LaserScannerSweep() {
  const [isReduced, setIsReduced] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setIsReduced(mq.matches);
  }, []);

  if (isReduced) return null;

  return (
    <div className={styles.laserContainer} aria-hidden="true">
      <div className={styles.laserLine} />
      <div className={styles.hudCrosshairTopLeft} />
      <div className={styles.hudCrosshairBottomRight} />
    </div>
  );
}

const TICKER_ITEMS = [
  "FEED: L2_UNCOMPRESSED_BOOK",
  "LATENCY: 0.38MS",
  "BTC/USDT CVD: +2.4σ",
  "VOL_SQUEEZE: COMPRESSED",
  "EXECUTION: BARE_METAL_LOCAL",
  "TELEMETRY: ZERO_LEAKAGE",
  "ENGINE: 60FPS_WEBGL",
  "ALGO_CUSTODY: 100%_SOVEREIGN",
];

export function AmbientTelemetryTicker() {
  return (
    <div className={styles.telemetryBar} aria-hidden="true">
      <div className={styles.telemetryStream}>
        {TICKER_ITEMS.concat(TICKER_ITEMS).map((item, idx) => (
          <span key={idx}>{item}</span>
        ))}
      </div>
    </div>
  );
}

export function SelfDrawingDivider() {
  return (
    <svg className={styles.vectorDivider} viewBox="0 0 1200 48" fill="none" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="dividerGrad" x1="0" y1="0" x2="1200" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#6366f1" stopOpacity="0" />
          <stop offset="20%" stopColor="#6366f1" stopOpacity="0.6" />
          <stop offset="50%" stopColor="#a855f7" stopOpacity="0.9" />
          <stop offset="80%" stopColor="#ec4899" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#ec4899" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d="M 0 24 Q 300 8, 600 24 T 1200 24"
        className={styles.dividerPath}
      />
    </svg>
  );
}
