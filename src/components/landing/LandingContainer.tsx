import React from 'react';

interface LandingContainerProps {
  children: React.ReactNode;
  className?: string;
}

export function LandingContainer({
  children,
  className = '',
}: LandingContainerProps) {
  return (
    <div className={`relative w-full bg-black text-white overflow-x-clip ${className}`}>
      {/* Lightweight Radial Ambient Caustics (GPU-friendly, no heavy blur filters) */}
      <div
        className="pointer-events-none absolute top-[8%] left-1/2 -translate-x-1/2 w-[900px] h-[500px] rounded-full [background:radial-gradient(ellipse_at_center,rgba(16,185,129,0.035)_0%,transparent_70%)]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute top-[32%] -left-[150px] w-[700px] h-[450px] rounded-full [background:radial-gradient(ellipse_at_center,rgba(6,182,212,0.03)_0%,transparent_70%)]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute top-[58%] right-[-100px] w-[650px] h-[450px] rounded-full [background:radial-gradient(ellipse_at_center,rgba(168,85,247,0.025)_0%,transparent_70%)]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute bottom-[8%] left-1/2 -translate-x-1/2 w-[800px] h-[450px] rounded-full [background:radial-gradient(ellipse_at_center,rgba(16,185,129,0.03)_0%,transparent_70%)]"
        aria-hidden="true"
      />

      {/* Subtle Micro-Grid Ambient Texture */}
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.03)_1px,transparent_1px)] [background-size:32px_32px] opacity-40"
        aria-hidden="true"
      />

      {/* Primary Section Content */}
      <div className="relative z-10 w-full">{children}</div>
    </div>
  );
}
