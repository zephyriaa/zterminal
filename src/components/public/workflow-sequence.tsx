"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { EASE_OUT_EXPO, useIsReducedMotion } from "@/components/landing/motion-primitives";
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
  const reduced = useIsReducedMotion();

  return (
    <div className={styles.wrapper}>
      <div className={styles.timelineBar} aria-hidden="true">
        <motion.div
          className={styles.timelineProgress}
          animate={{ width: `${((activeStep + 1) / WORKFLOW_STEPS.length) * 100}%` }}
          transition={{ duration: 0.35, ease: EASE_OUT_EXPO }}
        />
      </div>

      <motion.ol
        className={styles.sequence}
        initial={reduced ? undefined : "hidden"}
        whileInView={reduced ? undefined : "show"}
        viewport={{ once: true, margin: "120px 0px" }}
        variants={{
          hidden: {},
          show: {
            transition: {
              staggerChildren: 0.07,
            },
          },
        }}
      >
        {WORKFLOW_STEPS.map((step, idx) => {
          const isActive = activeStep === idx;
          return (
            <motion.li
              key={step.phase}
              className={`${styles.stepItem} ${isActive ? styles.activeItem : ""}`}
              onMouseEnter={() => setActiveStep(idx)}
              onClick={() => setActiveStep(idx)}
              variants={{
                hidden: { opacity: 0, y: 20 },
                show: {
                  opacity: 1,
                  y: 0,
                  transition: {
                    duration: 0.6,
                    ease: EASE_OUT_EXPO,
                  },
                },
              }}
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
            </motion.li>
          );
        })}
      </motion.ol>
    </div>
  );
}
