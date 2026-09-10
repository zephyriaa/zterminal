"use client";

import React, { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import styles from "./workflow-sequence.module.css";

interface WorkflowStep {
  num: string;
  phase: string;
  tag: string;
  lead: string;
  details: string;
  spec: string;
}

const WORKFLOW_STEPS: WorkflowStep[] = [
  {
    num: "01",
    phase: "Research",
    tag: "OPPORTUNITY",
    lead: "Isolate high-expectancy setups.",
    details: "Uncover hidden liquidity imbalances, regime shifts, and volatility compression before the crowd catches on.",
    spec: "ALPHA DISCOVERY",
  },
  {
    num: "02",
    phase: "Validate",
    tag: "SIMULATION",
    lead: "Prove your edge before risking $1.",
    details: "Run sub-second backtests with tick-level precision, realistic slippage, and Monte Carlo stress testing.",
    spec: "SUB-BAR ACCURACY",
  },
  {
    num: "03",
    phase: "Monitor",
    tag: "ORDER FLOW",
    lead: "Track institutional flow in real time.",
    details: "Read market depth dynamics, liquidity sweeps, and multi-timeframe volume profiles at fluid 60fps.",
    spec: "REAL-TIME DEPTH",
  },
  {
    num: "04",
    phase: "Decide",
    tag: "DISCIPLINE",
    lead: "Trade with mathematical certainty.",
    details: "Eliminate emotional hesitation with automated position sizing and capital preservation guardrails.",
    spec: "RISK AUTOMATION",
  },
  {
    num: "05",
    phase: "Execute",
    tag: "SOVEREIGN",
    lead: "Keep 100% control of your funds.",
    details: "Execute directly through your preferred broker or exchange. Your funds, keys, and orders stay strictly in your hands.",
    spec: "TOTAL CUSTODY",
  },
  {
    num: "06",
    phase: "Review",
    tag: "COMPOUND",
    lead: "Scale your winning playbooks.",
    details: "Automatically record and audit trade setups against your thesis to systematically compound your trading edge.",
    spec: "SYSTEMATIC GROWTH",
  },
];

export function WorkflowSequence() {
  const [activeStep, setActiveStep] = useState<number>(0);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLUListElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isDesktop = window.matchMedia("(min-width: 900px)").matches;

    if (prefersReduced || !isDesktop) return;

    gsap.registerPlugin(ScrollTrigger);

    const wrapper = wrapperRef.current;
    const track = trackRef.current;
    if (!wrapper || !track) return;

    // Calculate maximum horizontal travel distance
    const totalScrollWidth = track.scrollWidth;
    const containerWidth = wrapper.clientWidth;
    const xDistance = Math.max(0, totalScrollWidth - containerWidth);

    if (xDistance === 0) return;

    const trigger = ScrollTrigger.create({
      trigger: wrapper,
      start: "center center",
      end: () => `+=${xDistance + 200}`,
      pin: true,
      scrub: 0.6,
      anticipatePin: 1,
      onUpdate: (self) => {
        const progress = self.progress;
        gsap.set(track, { x: -progress * xDistance });

        // Calculate active step
        const stepIdx = Math.min(
          WORKFLOW_STEPS.length - 1,
          Math.floor(progress * WORKFLOW_STEPS.length),
        );
        setActiveStep(stepIdx);
      },
    });

    return () => {
      trigger.kill();
    };
  }, []);

  return (
    <div ref={wrapperRef} className={styles.wrapper}>
      <div className={styles.timelineBar} aria-hidden="true">
        <div
          className={styles.timelineProgress}
          style={{ width: `${((activeStep + 1) / WORKFLOW_STEPS.length) * 100}%` }}
        />
      </div>

      <div className={styles.trackContainer}>
        <ul ref={trackRef} className={styles.sequence}>
          {WORKFLOW_STEPS.map((step, idx) => {
            const isActive = activeStep === idx;
            return (
              <li
                key={step.phase}
                className={`${styles.stepItem} ${isActive ? styles.activeItem : ""}`}
                onMouseEnter={() => setActiveStep(idx)}
                onClick={() => setActiveStep(idx)}
              >
                <div className={styles.stepHeader}>
                  <span className={styles.stepNum}>{step.num}</span>
                  <span className={styles.stepTag}>{step.tag}</span>
                </div>
                <h3 className={styles.stepPhase}>{step.phase}</h3>
                <p className={styles.stepLead}>{step.lead}</p>
                <p className={styles.stepDetails}>{step.details}</p>
                <div className={styles.stepFooter}>
                  <span className={styles.stepSpec}>{step.spec}</span>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
