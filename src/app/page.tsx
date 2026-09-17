import { SmoothScrollProvider } from '@/components/motion/smooth-scroll-provider';
import { HeroSection } from '@/components/landing/HeroSection';
import { ResearchLoop } from '@/components/landing/research-loop';
import { LandingContainer } from '@/components/landing/LandingContainer';
import { MicrostructureLens } from '@/components/landing/sections/MicrostructureLens';
import { QuantBentoMatrix } from '@/components/landing/sections/QuantBentoMatrix';
import { ExecutionEngine } from '@/components/landing/sections/ExecutionEngine';
import { InstitutionalCta } from '@/components/landing/sections/InstitutionalCta';
import '@/components/public/public-theme.css';

export default function LandingPage() {
  return (
    <SmoothScrollProvider>
      <main id="overview" className="publicScope relative w-full bg-black text-white selection:bg-white/20 selection:text-white">
        {/* Act I: Hero Workstation & Narrative Opening */}
        <HeroSection />

        {/* Act II: The Research Loop Stage Sequence */}
        <ResearchLoop />

        {/* Acts III–VI: Microstructure, Matrix, Architecture & Conversion */}
        <LandingContainer className="relative z-20 space-y-0">
          <MicrostructureLens />
          <QuantBentoMatrix />
          <ExecutionEngine />
          <InstitutionalCta />
        </LandingContainer>
      </main>
    </SmoothScrollProvider>
  );
}
