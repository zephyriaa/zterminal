"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import styles from "./workflow-sequence.module.css";

interface WorkflowStep {
  num: string;
  phase: string;
  tag: string;
  lead: string;
  details: string;
  spec: string;
  gate: string;
}

const WORKFLOW_STEPS: WorkflowStep[] = [
  {
    num: "01",
    phase: "Alpha Discovery",
    tag: "ANOMALY DETECTION",
    lead: "Spot institutional order book anomalies before price expands.",
    details: "Algorithmic regime scanning isolates resting liquidity clusters, volatility compression bands, and high-expectancy asymmetric setups before the breakout prints.",
    spec: "SUB-SECOND SCANNER",
    gate: "MICROSTRUCTURE: VOLATILITY COMPRESSION · LEVEL 2 IMBALANCE",
  },
  {
    num: "02",
    phase: "Vectorized Backtesting",
    tag: "STRESS AUDIT",
    lead: "Simulate decades of tick data in milliseconds.",
    details: "Execute vectorized Python backtests with sub-bar tick magnification, authentic exchange taker slippage, and Monte Carlo ruin stress testing. Zero look-ahead bias guaranteed.",
    spec: "VECTORIZED ENGINE",
    gate: "SIMULATION: SUB-BAR FILL RESOLUTION · REALISTIC SLIPPAGE",
  },
  {
    num: "03",
    phase: "Tape Telemetry",
    tag: "60 FPS ORDER FLOW",
    lead: "Watch smart money absorption in fluid 60 FPS.",
    details: "Track aggressive market orders, cumulative volume delta (CVD) divergences, and resting limit depth sweeps in real time. Never get trapped by spoofed depth walls again.",
    spec: "DIRECT L2 FEED",
    gate: "ORDER FLOW: LIVE CVD DELTA · RESTING DEPTH SWEEPS",
  },
  {
    num: "04",
    phase: "Capital Defense",
    tag: "AUTOMATED RISK",
    lead: "Cut emotional tilt and enforce non-negotiable risk.",
    details: "Eliminate emotional hesitation and revenge trading. Hardcode volatility-scaled position sizing, dynamic ATR stop-losses, and hard drawdown circuit breakers that act instantly.",
    spec: "RISK AUTOMATION",
    gate: "DEFENSE: FRACTIONAL KELLY · STRICT 1.5% MAX RISK",
  },
  {
    num: "05",
    phase: "Sovereign Execution",
    tag: "LOCAL DEPLOYMENT",
    lead: "Route sub-millisecond orders with 100% strategy privacy.",
    details: "Dispatch orders straight from your local hardware to your exchange gateway. Your trading models, secret API keys, and account balances remain sovereign in your local custody.",
    spec: "ZERO-CLOUD GATEWAY",
    gate: "SOVEREIGNTY: DIRECT LOCAL ROUTING · ZERO DATA LOGGING",
  },
  {
    num: "06",
    phase: "Compounding Audit",
    tag: "ALPHA COMPOUNDING",
    lead: "Transform winning executions into a scalable playbook.",
    details: "Every executed order is automatically journaled with exact entry microstructure, slippage cost attribution, and statistical expectancy drift. Turn edge into exponential compounding.",
    spec: "STATISTICAL JOURNAL",
    gate: "AUDIT: EXPECTANCY DRIFT · SHARPE ATTRIBUTION",
  },
];

export function WorkflowSequence() {
  const [activeStep, setActiveStep] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Observe step items with lightweight IntersectionObserver to update active highlight smoothly
    const container = containerRef.current;
    if (!container) return;

    const cards = container.querySelectorAll<HTMLElement>("[data-workflow-step]");
    if (!cards.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = Number(entry.target.getAttribute("data-workflow-step"));
            if (!Number.isNaN(idx)) {
              setActiveStep(idx);
            }
          }
        });
      },
      {
        rootMargin: "-20% 0px -40% 0px",
        threshold: 0.2,
      },
    );

    cards.forEach((card) => observer.observe(card));

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className={styles.pipelineWrapper}>
      {/* Top High-Level Telemetry Flow Bar */}
      <nav className={styles.flowNav} aria-label="Research pipeline stages">
        <div className={styles.progressBarTrack} aria-hidden="true">
          <div
            className={styles.progressBarFill}
            style={{ width: `${((activeStep + 1) / WORKFLOW_STEPS.length) * 100}%` }}
          />
        </div>

        <div className={styles.flowLabel}>
          <span className={styles.pulseDot} aria-hidden="true" />
          <span>RESEARCH PIPELINE EXECUTION</span>
          <span className={styles.flowTelemetry}>STAGE 0{activeStep + 1} / 06</span>
        </div>
        <ol className={styles.flowList}>
          {WORKFLOW_STEPS.map((step, idx) => {
            const isActive = activeStep === idx;
            const isCompleted = activeStep > idx;
            return (
              <li
                key={step.num}
                className={`${styles.flowNode} ${isActive ? styles.flowNodeActive : ""} ${
                  isCompleted ? styles.flowNodeCompleted : ""
                }`}
                onClick={() => setActiveStep(idx)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    setActiveStep(idx);
                  }
                }}
                tabIndex={0}
                role="button"
                aria-current={isActive ? "step" : undefined}
                aria-label={`Step ${step.num}: ${step.phase}`}
              >
                {isActive && (
                  <motion.span
                    layoutId="activeFlowNodePill"
                    className={styles.activeFlowNodePill}
                    transition={{ type: "spring", stiffness: 350, damping: 30 }}
                  />
                )}
                <span className={styles.flowNodeNum}>{step.num}</span>
                <span className={styles.flowNodePhase}>{step.phase}</span>
                {idx < WORKFLOW_STEPS.length - 1 && (
                  <span className={styles.flowConnector} aria-hidden="true">
                    →
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      {/* 6-Stage Research Pipeline Grid */}
      <div className={styles.pipelineGrid}>
        {WORKFLOW_STEPS.map((step, idx) => {
          const isActive = activeStep === idx;
          return (
            <motion.article
              key={step.phase}
              data-workflow-step={idx}
              className={`${styles.stageCard} ${isActive ? styles.stageCardActive : ""}`}
              onMouseEnter={() => setActiveStep(idx)}
              onClick={() => setActiveStep(idx)}
              whileHover={{ y: -4, transition: { duration: 0.22, ease: [0.16, 1, 0.3, 1] } }}
            >
              {/* Card Meta Header */}
              <div className={styles.cardHeader}>
                <div className={styles.cardNumGroup}>
                  <span className={styles.stageNum}>{step.num}</span>
                  <span className={styles.stageTag}>{step.tag}</span>
                </div>
                <span className={styles.stageSpec}>{step.spec}</span>
              </div>

              {/* Stage Title & Lead */}
              <h3 className={styles.stagePhase}>{step.phase}</h3>
              <p className={styles.stageLead}>{step.lead}</p>
              <p className={styles.stageDetails}>{step.details}</p>

              {/* Bottom Telemetry Gate */}
              <div className={styles.cardFooter}>
                <span className={styles.stageGate}>{step.gate}</span>
                <span className={styles.statusIndicator} aria-hidden="true">
                  {isActive ? (
                    <>
                      <span className={styles.activeDot} />
                      <span>ACTIVE</span>
                    </>
                  ) : (
                    "READY"
                  )}
                </span>
              </div>
            </motion.article>
          );
        })}
      </div>
    </div>
  );
}
