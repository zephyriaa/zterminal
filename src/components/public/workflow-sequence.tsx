"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./workflow-sequence.module.css";

const steps = [
  { id: "01", title: "Research", desc: "Start with the market as it is, not the trade you want it to become." },
  { id: "02", title: "Validate", desc: "Make the rule clear enough for history to challenge it." },
  { id: "03", title: "Monitor", desc: "Track live conditions against the validated rule." },
  { id: "04", title: "Decide", desc: "Review the evidence, know the risk, and keep the call human." },
  { id: "05", title: "Execute", desc: "Carry out the decision precisely as planned." },
  { id: "06", title: "Review", desc: "Journal the outcome against the original hypothesis." }
];

export function WorkflowSequence() {
  const [activeStep, setActiveStep] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let ticking = false;

    const updateStep = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      
      const topOffset = rect.top - (windowHeight / 3);
      const height = rect.height;
      const progress = Math.max(0, Math.min(1, -topOffset / height));
      
      const currentStep = Math.min(steps.length - 1, Math.floor(progress * steps.length));
      setActiveStep(currentStep);
      ticking = false;
    };

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(updateStep);
        ticking = true;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll(); // init
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className={styles.workflowContainer} ref={containerRef}>
      <div className={styles.stickyTrack}>
        <div className={styles.stepGrid}>
          {steps.map((step, index) => (
            <div 
              key={step.id} 
              className={`${styles.stepCard} ${index === activeStep ? styles.active : ''} ${index < activeStep ? styles.past : ''}`}
            >
              <div className={styles.stepHeader}>
                <span className={styles.stepNumber}>{step.id}</span>
                <span className={styles.stepConnector} aria-hidden="true" />
              </div>
              <h3>{step.title}</h3>
              <p>{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

