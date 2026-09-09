import React from "react";

interface WaveRow {
  baseY: number;
  amp: number;
  count: number;
  opacity: number;
  size: number;
  color: string;
  blur?: boolean;
}

interface DotPoint {
  cx: number;
  cy: number;
  r: number;
  opacity: number;
}

export function HeroParticleWave() {
  // Layered particle wave with depth-of-field, organic scatter, and volumetric bloom
  const waveLayers: WaveRow[] = [
    // Background out-of-focus soft glowing layer
    { baseY: 130, amp: 48, count: 50, opacity: 0.28, size: 2.8, color: "#6d28d9", blur: true },
    { baseY: 150, amp: 52, count: 55, opacity: 0.35, size: 3.2, color: "#7c3aed", blur: true },
    
    // Midground ribbons
    { baseY: 135, amp: 44, count: 65, opacity: 0.40, size: 1.3, color: "#8b5cf6" },
    { baseY: 150, amp: 48, count: 70, opacity: 0.55, size: 1.6, color: "#9333ea" },
    { baseY: 165, amp: 52, count: 75, opacity: 0.70, size: 1.9, color: "#a855f7" },
    { baseY: 180, amp: 56, count: 80, opacity: 0.85, size: 2.2, color: "#c084fc" },
    { baseY: 195, amp: 60, count: 85, opacity: 0.95, size: 2.5, color: "#d8b4fe" },
    { baseY: 210, amp: 63, count: 80, opacity: 0.80, size: 2.1, color: "#bfa1fc" },
    { baseY: 225, amp: 65, count: 75, opacity: 0.60, size: 1.7, color: "#9333ea" },
    { baseY: 240, amp: 68, count: 70, opacity: 0.42, size: 1.4, color: "#7c3aed" },
    { baseY: 255, amp: 70, count: 60, opacity: 0.26, size: 1.2, color: "#5b21b6" },
  ];

  // Foreground sparkling anchor particles scattered naturally
  const sparklers = [
    { x: 180, y: 150, r: 2.6, op: 0.9, col: "#ffffff" },
    { x: 260, y: 142, r: 2.2, op: 0.85, col: "#f3e8ff" },
    { x: 340, y: 138, r: 2.8, op: 0.95, col: "#ffffff" },
    { x: 420, y: 146, r: 2.4, op: 0.88, col: "#e9d5ff" },
    { x: 510, y: 160, r: 2.0, op: 0.82, col: "#ffffff" },
    { x: 590, y: 182, r: 2.5, op: 0.90, col: "#d8b4fe" },
    { x: 670, y: 210, r: 2.2, op: 0.75, col: "#c084fc" },
    { x: 750, y: 245, r: 1.9, op: 0.65, col: "#a855f7" },
  ];

  return (
    <svg
      viewBox="0 0 1140 370"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{
        width: "100%",
        height: "100%",
        overflow: "visible",
      }}
      aria-hidden="true"
    >
      <defs>
        <filter id="softDofBlur" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3.5" />
        </filter>
        <radialGradient id="waveBackGlow" cx="42%" cy="58%" r="52%">
          <stop offset="0%" stopColor="#8b4cf7" stopOpacity="0.34" />
          <stop offset="45%" stopColor="#581cd8" stopOpacity="0.14" />
          <stop offset="100%" stopColor="#03050c" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="fadeH" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.04" />
          <stop offset="18%" stopColor="#fff" stopOpacity="0.96" />
          <stop offset="68%" stopColor="#fff" stopOpacity="0.88" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0.01" />
        </linearGradient>
        <mask id="organicWaveMask">
          <rect x="0" y="0" width="1140" height="370" fill="url(#fadeH)" />
        </mask>
      </defs>

      {/* Atmospheric ambient bloom behind particle wave */}
      <ellipse cx="490" cy="205" rx="460" ry="145" fill="url(#waveBackGlow)" />

      {/* Wave lines and dot particles */}
      <g mask="url(#organicWaveMask)">
        {waveLayers.map((w, wIdx) => {
          const points: DotPoint[] = [];
          for (let i = 0; i <= w.count; i++) {
            const t = i / w.count;
            const x = t * 1140;
            // Wave formulation: organic arch with harmonic perturbation
            const arch = Math.sin(t * Math.PI) * -52;
            const ripple = Math.sin(x * 0.0058 + wIdx * 0.26) * (w.amp * 0.44);
            const harmonic = Math.cos(x * 0.0034 + wIdx * 0.18) * 16;
            // Pseudo-random subtle organic jitter based on index
            const jitter = ((i * 17 + wIdx * 31) % 11 - 5) * 0.6;
            const y = w.baseY + arch + ripple + harmonic + jitter;

            const centerFactor = Math.sin(t * Math.PI);
            const dotR = w.size * (0.65 + centerFactor * 0.55);
            const dotAlpha = w.opacity * (0.22 + centerFactor * 0.78);

            points.push({
              cx: Number(x.toFixed(1)),
              cy: Number(y.toFixed(1)),
              r: Number(dotR.toFixed(2)),
              opacity: Number(dotAlpha.toFixed(2)),
            });
          }

          const pathD = points.reduce((acc, pt, idx) => {
            return idx === 0 ? `M ${pt.cx} ${pt.cy}` : `${acc} L ${pt.cx} ${pt.cy}`;
          }, "");

          return (
            <g key={wIdx} filter={w.blur ? "url(#softDofBlur)" : undefined}>
              <path
                d={pathD}
                stroke={w.color}
                strokeWidth={w.blur ? 1.2 : 0.65}
                strokeOpacity={Number((w.opacity * (w.blur ? 0.35 : 0.22)).toFixed(2))}
                fill="none"
              />
              {points.map((pt, pIdx) => (
                <circle
                  key={pIdx}
                  cx={pt.cx}
                  cy={pt.cy}
                  r={pt.r}
                  fill={w.color}
                  opacity={pt.opacity}
                />
              ))}
            </g>
          );
        })}

        {/* Foreground sharp sparkle particles */}
        {sparklers.map((sp, sIdx) => (
          <g key={`sp-${sIdx}`}>
            <circle cx={sp.x} cy={sp.y} r={sp.r * 2} fill={sp.col} opacity={sp.op * 0.25} />
            <circle cx={sp.x} cy={sp.y} r={sp.r} fill={sp.col} opacity={sp.op} />
          </g>
        ))}
      </g>
    </svg>
  );
}
