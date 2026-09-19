import { LandingPageContent } from "@/components/landing/landing-page";
import { SmoothScrollProvider } from "@/components/motion/smooth-scroll-provider";
import "@/components/public/public-theme.css";

export default function LandingPage() {
  return (
    <SmoothScrollProvider>
      <main className="relative min-h-screen bg-[#050505] text-[#f5f6fc] overflow-x-clip publicScope">
        <LandingPageContent />
      </main>
    </SmoothScrollProvider>
  );
}
