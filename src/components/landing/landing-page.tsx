"use client";

import React from "react";
import { HeroSection } from "./HeroSection";
import { SystemReveal } from "./system-reveal";
import { ResearchLoop } from "./research-loop";
import { LandingContainer } from "./LandingContainer";
import { MicrostructureLens } from "./sections/MicrostructureLens";
import { QuantBentoMatrix } from "./sections/QuantBentoMatrix";
import { ExecutionEngine } from "./sections/ExecutionEngine";
import { InstitutionalCta } from "./sections/InstitutionalCta";
import { PublicFooter } from "@/components/public/public-footer";

/**
 * ZTerminal Canonical Landing Page Architecture
 * 
 * Flow:
 * ACT I · SEE: Price is only the surface.
 * CINEMATIC SYSTEM REVEAL: See Further. Guess Less.
 * ACT II · THE RESEARCH LOOP: Hypothesize. Code. Execute.
 * ACT III · MICROSTRUCTURE & EXECUTION ENGINE
 */
export function LandingPageContent() {
  return (
    <div className="relative w-full bg-[#050505] text-[#f5f6fc] overflow-x-clip publicScope">
      {/* ACT I · SEE (Market Canvas) */}
      <HeroSection />

      {/* THE CINEMATIC SYSTEM REVEAL (Deconstructed Architecture) */}
      <SystemReveal />

      {/* ACT II · THE RESEARCH LOOP (Interactive 7-Stage Workflow) */}
      <ResearchLoop />

      {/* ACT III · DEEP DIVE (Microstructure, Matrix, Execution Engine, CTA) */}
      <LandingContainer>
        <MicrostructureLens />
        <QuantBentoMatrix />
        <ExecutionEngine />
        <InstitutionalCta />
      </LandingContainer>

      <PublicFooter />
    </div>
  );
}

export default LandingPageContent;
