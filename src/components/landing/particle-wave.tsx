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
            (0.2 + rand() * 0.7) * Math.exp(-row / 18) * (band === 0 ? 1 : 0.4);
          const radius = (0.3 + rand() * 1.1) * (row < 8 ? 1.25 : 0.75);

          // Deep violet-indigo palette matching reference image: #a855f7, #7c3aed, #818cf8
          const isHighlight = rand() > 0.82;
          const r = isHighlight ? 180 + Math.floor(rand() * 45) : 110 + Math.floor(rand() * 55);
          const g = isHighlight ? 85 + Math.floor(rand() * 45) : 45 + Math.floor(rand() * 40);
          const b = isHighlight ? 245 + Math.floor(rand() * 10) : 210 + Math.floor(rand() * 45);

          particles.push({
            baseX: x,
            baseY: y,
            row,
            col,
            band,
            alpha,
            radius,
            r,
            g,
            b,
          });
        }
      }
    }

    particlesRef.current = particles;
  }, []);

  // Animation loop with restrained phase drift, opening energy pulse, and IntersectionObserver pausing
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let time = 0;
    let isDocumentVisible = !document.hidden;
    let isIntersecting = true;
    let isRunning = true;
    const mountTime = performance.now();

    function handleVisibility() {
      isDocumentVisible = !document.hidden;
      if (isDocumentVisible && isIntersecting && !isRunning) {
        isRunning = true;
        animFrameIdRef.current = requestAnimationFrame(render);
      }
    }
    document.addEventListener("visibilitychange", handleVisibility);

    // Pause rendering when offscreen to achieve 0% idle CPU utilization
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        isIntersecting = entry.isIntersecting;
        if (isIntersecting && isDocumentVisible && !isRunning) {
          isRunning = true;
          animFrameIdRef.current = requestAnimationFrame(render);
        }
      },
      { threshold: 0.05 }
    );
    observer.observe(canvas);

    function render() {
      if (!isDocumentVisible || !isIntersecting || !ctx || !canvas) {
        isRunning = false;
        return;
      }

      ctx.clearRect(0, 0, 1672, 941);

      const now = performance.now();
      const elapsedSec = (now - mountTime) / 1000;

      if (!reduced) {
        time += 0.008;
      }

      // Opening horizon pulse sweep (0.4s to 1.8s)
      const pulseDuration = 1.4;
      const pulseStart = 0.4;
      let pulseActive = false;
      let pulseSweepX = -500;
      let pulseIntensity = 0;

      if (!reduced && elapsedSec >= pulseStart && elapsedSec <= pulseStart + pulseDuration) {
        pulseActive = true;
        const norm = (elapsedSec - pulseStart) / pulseDuration;
        // Smooth sine ease
        const ease = Math.sin((norm * Math.PI) / 2);
        pulseSweepX = ease * 2000;
        pulseIntensity = Math.sin(norm * Math.PI); // peaks at mid-pulse
      }

      const particles = particlesRef.current;
      const count = particles.length;

      for (let i = 0; i < count; i++) {
        const p = particles[i];

        // Restrained phase drift (under 3px total displacement)
        let dy = 0;
        let dx = 0;
        let alphaBoost = 0;
        let radiusScale = 1;

        if (!reduced) {
          const wavePhase = p.baseX / 210 + time;
          dy = Math.sin(wavePhase) * 2.2 * (1 - p.row / 52);
          dx = Math.cos(wavePhase * 0.7) * 1.0;

          // Gentle pointer influence
          const mouseDistY = (mouseNormalizedY || 0) * 12 * (1 - p.row / 47);
          const mouseDistX = (mouseNormalizedX || 0) * 8 * (1 - p.row / 47);
          dy += mouseDistY;
          dx += mouseDistX;

          // Horizon pulse boost
          if (pulseActive) {
            const distFromPulse = Math.abs(p.baseX - pulseSweepX);
            if (distFromPulse < 280) {
              const prox = (1 - distFromPulse / 280) * pulseIntensity;
              alphaBoost = prox * 0.45;
              radiusScale = 1 + prox * 0.35;
              dy -= prox * 4 * (1 - p.row / 47);
            }
          }
        }

        const x = p.baseX + dx;
        const y = p.baseY + dy;
        const finalAlpha = Math.min(1, p.alpha + alphaBoost);
        const finalRadius = p.radius * radiusScale;

        ctx.fillStyle = `rgba(${p.r},${p.g},${p.b},${finalAlpha})`;
        ctx.beginPath();
        ctx.arc(x, y, finalRadius, 0, Math.PI * 2);
        ctx.fill();
      }

      if (!reduced) {
        animFrameIdRef.current = requestAnimationFrame(render);
      }
    }

    isRunning = true;
    animFrameIdRef.current = requestAnimationFrame(render);

    return () => {
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      document.removeEventListener("visibilitychange", handleVisibility);
      observer.disconnect();
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
