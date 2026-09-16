"use client";

import React, { useEffect, useRef } from "react";
import { useIsReducedMotion } from "./motion-primitives";

interface ParticleWaveProps {
  className?: string;
  mouseNormalizedX?: number;
  mouseNormalizedY?: number;
}

interface Particle {
  baseX: number;
  baseY: number;
  row: number;
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
  const frameRef = useRef<number | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const pointerRef = useRef({ x: mouseNormalizedX, y: mouseNormalizedY });
  const reduced = useIsReducedMotion();

  useEffect(() => {
    pointerRef.current = { x: mouseNormalizedX, y: mouseNormalizedY };
  }, [mouseNormalizedX, mouseNormalizedY]);

  useEffect(() => {
    let seed = 731;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };

    const particles: Particle[] = [];
    for (let band = 0; band < 2; band++) {
      for (let row = 0; row < 47; row++) {
        for (let col = 0; col < 218; col++) {
          const x = col * 8 + (random() - 0.5) * 5;
          const ridge =
            band === 0
              ? 794 + x * 0.26 + 20 * Math.sin(x / 220)
              : 878 - 235 * Math.exp(-Math.pow((x - 1150) / 480, 2));
          particles.push({
            baseX: x,
            baseY: ridge + row * (2.1 + row * 0.047) + (random() - 0.5) * 5,
            row,
            alpha:
              (0.16 + random() * 0.62) *
              Math.exp(-row / 19) *
              (band === 0 ? 1 : 0.35),
            radius: (0.25 + random() * 0.95) * (row < 7 ? 1.2 : 0.7),
            r: 75 + Math.floor(random() * 45),
            g: 48 + Math.floor(random() * 35),
            b: 155 + Math.floor(random() * 90),
          });
        }
      }
    }
    particlesRef.current = particles;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    let time = 0;
    let visible = !document.hidden;
    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting && !document.hidden;
        if (visible && !reduced && frameRef.current === null) frameRef.current = requestAnimationFrame(render);
      },
      { threshold: 0.01 },
    );

    const setVisibility = () => {
      visible = !document.hidden;
      if (visible && !reduced && frameRef.current === null) frameRef.current = requestAnimationFrame(render);
    };

    const render = () => {
      frameRef.current = null;
      ctx.clearRect(0, 0, 1672, 941);
      if (!reduced) time += 0.008;

      for (const particle of particlesRef.current) {
        const amount = 1 - particle.row / 52;
        const phase = particle.baseX / 210 + time;
        const pointer = pointerRef.current;
        const dx = reduced ? 0 : Math.cos(phase * 0.7) + pointer.x * 8 * amount;
        const dy = reduced ? 0 : Math.sin(phase) * 2.2 * amount + pointer.y * 12 * amount;
        ctx.fillStyle = `rgba(${particle.r}, ${particle.g}, ${particle.b}, ${particle.alpha})`;
        ctx.beginPath();
        ctx.arc(particle.baseX + dx, particle.baseY + dy, particle.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      if (visible && !reduced) frameRef.current = requestAnimationFrame(render);
    };

    observer.observe(canvas);
    document.addEventListener("visibilitychange", setVisibility);
    render();

    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", setVisibility);
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [reduced]);

  return <canvas ref={canvasRef} className={className} width={1672} height={941} aria-hidden="true" />;
}
