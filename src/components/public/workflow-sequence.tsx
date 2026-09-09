"use client";

import React, { useState } from "react";
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
    tag: "HYPOTHESIS",
    lead: "Isolate the structural edge.",
    details: "Frame a question about price, volume distribution, or regime compression before looking at charts.",
    spec: "INPUT: LOCAL PARQUET",
  },
  {
    num: "02",
    phase: "Validate",
    tag: "SIMULATION",
    lead: "Test with mathematical rigor.",
    details: "Express logic in Python. Measure Sharpe, drawdowns, and sample size with visible simulation limits.",
    spec: "ENGINE: POLARS / VECTORBT",
  },
  {
    num: "03",
    phase: "Monitor",
    tag: "MARKET CANVAS",
    lead: "Track multi-timeframe regime.",
    details: "Inspect real-time order flow, volume profile, and moving average envelopes on the GPU canvas.",
    spec: "STREAM: DIRECT WEBSOCKET",
  },
  {
    num: "04",
    phase: "Decide",
    tag: "CONVICTION",
    lead: "Weigh edge against friction.",
    details: "Evaluate the statistical setup against risk budget, drawdown limits, and portfolio allocation.",
    spec: "RULE: ZERO LEVERAGE",
  },
  {
    num: "05",
    phase: "Execute",
    tag: "SOVEREIGN",
    lead: "Place separately with broker.",
    details: "ZTerminal maintains no broker routing. You retain 100% control of order entry and capital custody.",
    spec: "STATUS: USER EXECUTED",
  },
  {
    num: "06",
    phase: "Review",
    tag: "AUDIT",
    lead: "Compare outcome to premise.",
    details: "Record entry rationale and outcome in the local journal with SHA-256 reproducible data archives.",
    spec: "ARCHIVE: LOCAL DISK",
  },
];

export function WorkflowSequence() {
  const [activeStep, setActiveStep] = useState<number>(0);

  return (
    <div className={styles.wrapper}>
      <div className={styles.timelineBar} aria-hidden="true">
        <div
          className={styles.timelineProgress}
          style={{ width: `${((activeStep + 1) / WORKFLOW_STEPS.length) * 100}%` }}
        />
      </div>

      <ol className={styles.sequence}>
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
      </ol>
    </div>
  );
}
