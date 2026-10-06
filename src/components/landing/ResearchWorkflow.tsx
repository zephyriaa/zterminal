import { ProductFigure } from "./ProductFigure";
import { researchSteps } from "./landing-content";
import { WorkflowMotion } from "./WorkflowMotion";
import styles from "./landing.module.css";

export function ResearchWorkflow() {
  return (
    <section id="research-loop" className={`${styles.workflow} ${styles.container}`} aria-labelledby="workflow-heading">
      <div className={styles.sectionHeading}>
        <p className={styles.eyebrow}>01 / The research loop</p>
        <h2 id="workflow-heading">Turn market ideas<br />into <em>evidence.</em></h2>
        <p>From observation to a tested thesis,<br />without breaking context.</p>
      </div>
      <div className={styles.workflowLayout} data-workflow="" data-active-step="0">
        <WorkflowMotion />
        <div className={styles.workflowChapters}>
          {researchSteps.map((step, index) => (
            <article id={`workflow-${step.id}`} key={step.id} className={styles.workflowChapter} data-workflow-step={index}>
              <p className={styles.chapterIndex}><span>{String(index + 1).padStart(2, "0")}</span>{step.label}</p>
              <h3>{step.title}</h3>
              <p className={styles.chapterDescription}>{step.description}</p>
              <p className={styles.chapterDetail}>{step.detail}</p>
              <div className={styles.sequentialVisual}><ProductFigure capture={step.capture} /></div>
            </article>
          ))}
        </div>
        <div className={styles.workflowStage}>
          <div className={styles.workflowStageInner}>
            <div className={styles.chapterTrack}>{researchSteps.map((step, index) => <span key={step.id} data-workflow-indicator={index}><b>{String(index + 1).padStart(2, "0")}</b>{step.label}</span>)}</div>
            <div className={styles.workflowScreens}>
              {researchSteps.map((step, index) => <div key={step.id} className={styles.workflowScreen} data-workflow-screen={index}><ProductFigure capture={step.capture} /></div>)}
            </div>
            <p className={styles.workflowFootnote}>Real interface. One connected research process.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
