import Link from "next/link";
import { HeroActTransition } from "./hero-act-transition";
import { LiquidGlassStream } from "./liquid-glass-stream";
import { PublicFooter } from "@/components/public/public-footer";
import {
  BackgroundField,
  CTAButton,
  EditorialHeading,
  TechnicalEyebrow,
} from "@/components/public/public-primitives";
import "@/components/public/public-theme.css";
import styles from "./landing-page.module.css";



export function LandingPage() {
  return (
    <main className={`${styles.page} publicScope`} id="main">
      <a className={styles.skip} href="#see">
        Skip to content
      </a>

      <HeroActTransition
        atmosphere={<BackgroundField />}
        eyebrow={<TechnicalEyebrow>ACT I · SEE</TechnicalEyebrow>}
        heading={
          <EditorialHeading>
            Price is only
            <br />
            <em>the surface.</em>
          </EditorialHeading>
        }
        body={
          <p className="max-w-2xl mx-auto">
            Charts, market context, public depth, and recent trades stay in one
            frame—so the next question starts with evidence, not a guess.
          </p>
        }
      />

      <LiquidGlassStream />

      <PublicFooter />
    </main>
  );
}
