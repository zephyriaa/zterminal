import { PublicHeader } from "@/components/public/public-header";
import { PublicFooter } from "@/components/public/public-footer";
import {
  BackgroundField,
  CTAButton,
  TechnicalEyebrow,
} from "@/components/public/public-primitives";
import "@/components/public/public-theme.css";
import styles from "./not-found.module.css";

export default function NotFound() {
  return (
    <main className={`${styles.page} publicScope`}>
      <BackgroundField />
      <PublicHeader />

      <section className={styles.content}>
        <TechnicalEyebrow className={styles.eyebrow}>
          404 / SIGNAL LOST
        </TechnicalEyebrow>

        <h1 className={styles.title}>
          Nothing to
          <em>interrogate here.</em>
        </h1>

        <p className={styles.lead}>
          The requested route does not exist or has moved. Return to the public overview
          or launch the live market workspace.
        </p>

        <div className={styles.actions}>
          <CTAButton href="/">Back to overview</CTAButton>
          <CTAButton href="/terminal" secondary>
            Open ZTerminal
          </CTAButton>
        </div>
      </section>

      <PublicFooter />
    </main>
  );
}
