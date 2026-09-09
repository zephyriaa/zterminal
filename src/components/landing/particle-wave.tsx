"use client";

import React, { useEffect, useRef } from "react";
import { useIsReducedMotion } from "./motion-primitives";

interface ParticleWaveProps {
  className?: string;
  mouseNormalizedX?: number; // -0.5 to 0.5
  mouseNormalizedY?: number; // -0.5 to 0.5
}

interface Particle {
  baseX: number;
  baseY: number;
  row: number;
  col: number;
  band: number;
  alpha: number;
  radius: number;
  r: number;
  g: number;
  b: number;
}

export function ParticleWave({
  className,
  mouseNormalizedX = 0,
  mouseNormalizedY = 0,
}: ParticleWaveProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const reduced = useIsReducedMotion();

  // Generate deterministic particles matching the exact seed & formula from index.html
  useEffect(() => {
    let seed = 731;
    function rand() {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    }

    const particles: Particle[] = [];

    for (let band = 0; band < 2; band++) {
      for (let row = 0; row < 47; row++) {
        for (let col = 0; col < 218; col++) {
          const x = col * 8 + (rand() - 0.5) * 5;
          const ridge =
            band === 0
              ? 794 + x * 0.26 + 20 * Math.sin(x / 220)
              : 878 - 235 * Math.exp(-Math.pow((x - 1150) / 480, 2));
          const y = ridge + row * (2.1 + row * 0.047) + (rand() - 0.5) * 5;
          const alpha =
            (0.16 + rand() * 0.62) * Math.exp(-row / 19) * (band === 0 ? 1 : 0.35);
          const radius = (0.25 + rand() * 0.95) * (row < 7 ? 1.2 : 0.7);

          particles.push({
            baseX: x,
            baseY: y,
            row,
            col,
            band,
            alpha,
            radius,
            r: 75 + Math.floor(rand() * 45),
            g: 48 + Math.floor(rand() * 35),
            b: 155 + Math.floor(rand() * 90),
          });
        }
      }
    }

    particlesRef.current = particles;
  }, []);

  // Animation loop with restrained phase drift and pointer interaction
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let time = 0;
    let isVisible = true;

    function handleVisibility() {
      isVisible = !document.hidden;
    }
    document.addEventListener("visibilitychange", handleVisibility);

    function render() {
      if (!isVisible || !ctx || !canvas) {
        animFrameIdRef.current = requestAnimationFrame(render);
        return;
      }

      ctx.clearRect(0, 0, 1672, 941);

      if (!reduced) {
        time += 0.008;
      }

      const particles = particlesRef.current;
      const count = particles.length;

      for (let i = 0; i < count; i++) {
        const p = particles[i];

        // Restrained phase drift (under 3px total displacement)
        let dy = 0;
        let dx = 0;

        if (!reduced) {
          const wavePhase = p.baseX / 210 + time;
          dy = Math.sin(wavePhase) * 2.2 * (1 - p.row / 52);
          dx = Math.cos(wavePhase * 0.7) * 1.0;

          // Gentle pointer influence
          const mouseDistY = (mouseNormalizedY || 0) * 12 * (1 - p.row / 47);
          const mouseDistX = (mouseNormalizedX || 0) * 8 * (1 - p.row / 47);
          dy += mouseDistY;
          dx += mouseDistX;
        }

        const x = p.baseX + dx;
        const y = p.baseY + dy;

        ctx.fillStyle = `rgba(${p.r},${p.g},${p.b},${p.alpha})`;
        ctx.beginPath();
        ctx.arc(x, y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      if (!reduced) {
        animFrameIdRef.current = requestAnimationFrame(render);
      }
    }

    render();

    return () => {
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [reduced, mouseNormalizedX, mouseNormalizedY]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      width={1672}
      height={941}
      aria-hidden="true"
    />
  );
}
