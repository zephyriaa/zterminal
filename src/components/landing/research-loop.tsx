"use client";

import { useEffect, useState } from "react";
import styles from "./research-loop.module.css";

const steps = [
  { label: "Market", title: "Notice the change", detail: "A live book and chart put price, depth, and recent trades in the same view.", signal: "BTC/USDT · depth shifting" },
  { label: "Hypothesis", title: "State what you think is happening", detail: "Turn an observation into a condition that can be inspected and challenged.", signal: "If selling absorbs at support…" },
  { label: "Code", title: "Make the rule explicit", detail: "Write a small, reviewable strategy in Python and keep its inputs visible.", signal: "entry = absorption & trend" },
  { label: "Backtest", title: "Run it against history", detail: "Select a dataset, run the model, and inspect the trades—not just a headline number.", signal: "Run archived · next-bar fills" },
  { label: "Stress test", title: "Question the result", detail: "Use resampling and one-variable experiments to see where assumptions become fragile.", signal: "Monte Carlo · parameter check" },
  { label: "Decision", title: "Keep, refine, or reject", detail: "Research ends with evidence and a documented next step, not a promise about the market.", signal: "Result · refine the exit rule" },
] as const;

export function ResearchLoop() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setActive((value) => (value + 1) % steps.length), 4200);
    return () => window.clearInterval(timer);
  }, [paused]);
  const step = steps[active];
  return <section className={styles.section} id="research-loop" aria-labelledby="research-loop-title">
    <div className={styles.intro}><p className={styles.eyebrow}>THE RESEARCH LOOP</p><h2 id="research-loop-title">From a market observation to a decision you can explain.</h2><p>ZTerminal helps keep the work connected: inspect the market, express an idea, test the assumptions, and preserve the evidence.</p></div>
    <div className={styles.frame} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div className={styles.steps} role="tablist" aria-label="Research loop stages">{steps.map((item, index) => <button key={item.label} role="tab" aria-selected={active === index} className={active === index ? styles.active : ""} onClick={() => setActive(index)}><span>{String(index + 1).padStart(2, "0")}</span>{item.label}</button>)}</div>
      <div className={styles.screen} aria-live="polite"><div className={styles.chrome}><span>ZT / RESEARCH / {step.label.toUpperCase()}</span><span className={styles.live}>DEMO WORKFLOW</span></div><div className={styles.display}><div className={styles.chart} aria-hidden="true"><i /><i /><i /><i /><i /><svg viewBox="0 0 300 110" preserveAspectRatio="none"><path d="M0 85 C38 66 50 82 82 49 S135 68 165 32 S215 60 245 28 S278 38 300 16" /></svg></div><div className={styles.readout}><span>RESEARCH STATE</span><strong>{step.title}</strong><p>{step.detail}</p><code>{step.signal}</code></div></div><div className={styles.progress} aria-hidden="true"><span style={{ width: `${((active + 1) / steps.length) * 100}%` }} /></div></div>
      <p className={styles.note}>Illustrative product workflow. Backtests are hypothetical research outputs, not investment advice or a forecast.</p>
    </div>
  </section>;
}
