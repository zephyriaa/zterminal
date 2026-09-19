"use client";

import React from "react";
import styles from "./system-reveal.module.css";

interface SystemRevealCopyProps {
  progress: number;
  isStatic?: boolean;
}

interface BeatConfig {
  id: string;
  actNumber: string;
  title: React.ReactNode;
  body: string;
  start: number;
  peakStart: number;
  peakEnd: number;
  end: number;
}

const BEATS: BeatConfig[] = [
  {
    id: "beat-1",
    actNumber: "01 / COMPLETE WORKSTATION",
    title: (
      <>
        See Further.<br />
        <em>Guess Less.</em>
      </>
    ),
    body: "Research begins with a hypothesis, not a dashboard.",
    start: 0.0,
    peakStart: 0.02,
    peakEnd: 0.18,
    end: 0.22,
  },
  {
    id: "beat-2",
    actNumber: "02 / MICROSTRUCTURE VISIBILITY",
    title: (
      <>
        See the market<br />
        <em>beneath the candle.</em>
      </>
    ),
    body: "Trades, depth, volume and microstructure become part of the research context.",
    start: 0.20,
    peakStart: 0.26,
    peakEnd: 0.40,
    end: 0.45,
  },
  {
    id: "beat-3",
    actNumber: "03 / REPRODUCIBLE RESEARCH",
    title: (
      <>
        Turn hypotheses<br />
        <em>into experiments.</em>
      </>
    ),
    body: "Code the idea. Configure the test. Run it against reproducible data.",
    start: 0.45,
    peakStart: 0.50,
    peakEnd: 0.68,
    end: 0.73,
  },
  {
    id: "beat-4",
    actNumber: "04 / EMPIRICAL PROVENANCE",
    title: (
      <>
        Know why the<br />
        <em>result exists.</em>
      </>
    ),
    body: "Performance, risk, robustness and experiment lineage remain connected to the research that produced them.",
    start: 0.72,
    peakStart: 0.77,
    peakEnd: 0.96,
    end: 1.0,
  },
];

/**
 * Calculates smoothstep interpolation for disciplined text transitions:
 * Enter:  opacity 0 -> 1, y 18px -> 0
 * Hold:   opacity 1, y 0
 * Exit:   opacity 1 -> 0, y 0 -> -14px
 */
function calculateBeatMotion(
  p: number,
  beat: BeatConfig,
  isStatic: boolean
): { opacity: number; y: number; pointerEvents: "auto" | "none" } {
  if (isStatic) {
    return { opacity: 1, y: 0, pointerEvents: "auto" };
  }

  if (p < beat.start || p > beat.end) {
    return { opacity: 0, y: 24, pointerEvents: "none" };
  }

  // Entering phase
  if (p < beat.peakStart) {
    const t = (p - beat.start) / (beat.peakStart - beat.start);
    const eased = t * t * (3 - 2 * t);
    return {
      opacity: Math.max(0, Math.min(1, eased)),
      y: (1 - eased) * 18,
      pointerEvents: eased > 0.6 ? "auto" : "none",
    };
  }

  // Holding plateau
  if (p <= beat.peakEnd) {
    return { opacity: 1, y: 0, pointerEvents: "auto" };
  }

  // Exiting phase
  const t = (p - beat.peakEnd) / (beat.end - beat.peakEnd);
  const eased = t * t * (3 - 2 * t);
  return {
    opacity: Math.max(0, Math.min(1, 1 - eased)),
    y: -eased * 14,
    pointerEvents: eased > 0.4 ? "none" : "auto",
  };
}

export function SystemRevealCopy({ progress, isStatic = false }: SystemRevealCopyProps) {
  if (isStatic) {
    // In static mode, render a clean editorial presentation of the 4 beats
    return (
      <div className={styles.narrativeOverlay} data-testid="system-reveal-copy-static">
        <div className={styles.bandContainer}>
          <div className={styles.beatEyebrow}>
            <span className={styles.beatEyebrowDot} />
            <span>QUANTITATIVE RESEARCH WORKSTATION</span>
          </div>
          <h2 className={styles.beatTitle}>
            See Further.<br />
            <em>Guess Less.</em>
          </h2>
          <p className={styles.beatCopy}>
            Research begins with a hypothesis, not a dashboard. ZTerminal deconstructs market observation into explicit code, verifiable datasets, and stress-tested empirical evidence.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.narrativeOverlay} data-testid="system-reveal-copy" aria-live="polite">
      {BEATS.map((beat) => {
        const { opacity, y, pointerEvents } = calculateBeatMotion(progress, beat, isStatic);

        if (opacity <= 0.001) return null;

        return (
          <div
            key={beat.id}
            className={styles.bandContainer}
            style={{
              opacity,
              transform: `translate3d(0, ${y}px, 0)`,
              pointerEvents,
              transition: "opacity 0.12s linear, transform 0.12s cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          >
            {/* Local Band Scrim for 4-Layer Legibility */}
            <div className={styles.bandScrim} aria-hidden="true" />

            <div className={styles.beatEyebrow}>
              <span className={styles.beatEyebrowDot} />
              <span>{beat.actNumber}</span>
            </div>

            <h2 className={styles.beatTitle}>{beat.title}</h2>
            <p className={styles.beatCopy}>{beat.body}</p>
          </div>
        );
      })}
    </div>
  );
}
