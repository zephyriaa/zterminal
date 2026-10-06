import { PublicHeader } from "@/components/public/public-header";
import { PublicFooter } from "@/components/public/public-footer";
import { LandingHero } from "./LandingHero";
import { ResearchWorkflow } from "./ResearchWorkflow";
import { CapabilitySections, EcosystemSection, FinalCTA } from "./LandingSections";
import styles from "./landing.module.css";

export default function ZTerminalLanding() {
  return (
    <div className={`${styles.page} publicScope`} data-landing="true">
      <a className={styles.skipLink} href="#landing-main">Skip to content</a>
      <PublicHeader hero />
      <main id="landing-main" className={styles.content}>
        <LandingHero />
        <ResearchWorkflow />
        <CapabilitySections />
        <EcosystemSection />
        <FinalCTA />
      </main>
      <PublicFooter />
    </div>
  );
}
