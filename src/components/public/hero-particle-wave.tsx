import React from "react";

interface WaveConfig {
  baseY: number;
  amp: number;
  count: number;
  opacity: number;
  size: number;
  color: string;
}

interface DotPoint {
  cx: number;
  cy: number;
  r: number;
  opacity: number;
}

export function HeroParticleWave() {
  const waves: WaveConfig[] = [
    { baseY: 140, amp: 45, count: 65, opacity: 0.35, size: 1.4, color: "#7c3aed" },
    { baseY: 155, amp: 48, count: 70, opacity: 0.50, size: 1.6, color: "#8b5cf6" },
    { baseY: 170, amp: 52, count: 75, opacity: 0.65, size: 1.8, color: "#9d6eff" },
    { baseY: 185, amp: 56, count: 80, opacity: 0.85, size: 2.2, color: "#bfa3ff" },
    { baseY: 200, amp: 60, count: 85, opacity: 0.95, size: 2.4, color: "#d2bfff" },
    { baseY: 215, amp: 62, count: 80, opacity: 0.80, size: 2.0, color: "#a87ff5" },
    { baseY: 230, amp: 64, count: 75, opacity: 0.60, size: 1.7, color: "#8b5cf6" },
    { baseY: 245, amp: 66, count: 70, opacity: 0.40, size: 1.5, color: "#7033ea" },
    { baseY: 260, amp: 68, count: 65, opacity: 0.25, size: 1.3, color: "#581cd8" },
  ];

  return (
    <svg
      viewBox="0 0 1100 360"
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
        <radialGradient id="waveBackGlow" cx="45%" cy="60%" r="50%">
          <stop offset="0%" stopColor="#7a3cf5" stopOpacity="0.32" />
          <stop offset="50%" stopColor="#4f17d2" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#03050c" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="fadeHorizontal" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.05" />
          <stop offset="20%" stopColor="#fff" stopOpacity="0.95" />
          <stop offset="65%" stopColor="#fff" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0.02" />
        </linearGradient>
        <mask id="particleWaveMask">
          <rect x="0" y="0" width="1100" height="360" fill="url(#fadeHorizontal)" />
        </mask>
      </defs>

      {/* Atmospheric ambient bloom behind particle wave */}
      <ellipse cx="480" cy="210" rx="440" ry="140" fill="url(#waveBackGlow)" />

      {/* Wave lines and dot particles */}
      <g mask="url(#particleWaveMask)">
        {waves.map((w, wIdx) => {
          const points: DotPoint[] = [];
          for (let i = 0; i <= w.count; i++) {
            const t = i / w.count;
            const x = t * 1100;
            const arch = Math.sin(t * Math.PI) * -50;
            const ripple = Math.sin(x * 0.0055 + wIdx * 0.28) * (w.amp * 0.45);
            const secondary = Math.cos(x * 0.0032 + wIdx * 0.15) * 14;
            const y = w.baseY + arch + ripple + secondary;

            const centerFactor = Math.sin(t * Math.PI);
            const dotR = w.size * (0.6 + centerFactor * 0.55);
            const dotAlpha = w.opacity * (0.2 + centerFactor * 0.8);

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
            <g key={wIdx}>
              <path
                d={pathD}
                stroke={w.color}
                strokeWidth={0.65}
                strokeOpacity={Number((w.opacity * 0.22).toFixed(2))}
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
      </g>
    </svg>
  );
}
