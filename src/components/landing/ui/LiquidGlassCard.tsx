'use client';

import React, { useRef } from 'react';
import {
  motion,
  useMotionValue,
  useSpring,
  useMotionTemplate,
  useMotionValueEvent,
} from 'framer-motion';
import { springPhysics } from '../motion/springConfig';

export interface LiquidGlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  elevated?: boolean;
}

export function LiquidGlassCard({
  children,
  className = '',
  elevated = false,
  style,
  ...props
}: LiquidGlassCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  const mouseX = useMotionValue(200);
  const mouseY = useMotionValue(200);

  const springX = useSpring(mouseX, springPhysics.snappy);
  const springY = useSpring(mouseY, springPhysics.snappy);

  useMotionValueEvent(springX, 'change', (latest) => {
    if (cardRef.current) {
      cardRef.current.style.setProperty('--mouse-x', `${latest}px`);
    }
  });

  useMotionValueEvent(springY, 'change', (latest) => {
    if (cardRef.current) {
      cardRef.current.style.setProperty('--mouse-y', `${latest}px`);
    }
  });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    mouseX.set(x);
    mouseY.set(y);
  };

  const specularBackground = useMotionTemplate`radial-gradient(480px circle at ${springX}px ${springY}px, rgba(255, 255, 255, 0.12), transparent 70%)`;

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      className={`group relative rounded-2xl overflow-hidden will-change-transform specular-border transition-all duration-500 ${
        elevated ? 'liquid-glass-elevated' : 'liquid-glass'
      } ${className}`}
      style={style}
      {...props}
    >
      {/* Specular Edge Refraction Overlay */}
      <motion.div
        className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100 z-10"
        style={{
          background: specularBackground,
        }}
      />

      {/* Micro-Noise Grain Overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.015] mix-blend-overlay z-0"
        style={{
          backgroundImage:
            "url('data:image/svg+xml,%3Csvg viewBox=\"0 0 200 200\" xmlns=\"http://www.w3.org/2000/svg\"%3E%3Cfilter id=\"noiseFilter\"%3E%3CfeTurbulence type=\"fractalNoise\" baseFrequency=\"0.65\" numOctaves=\"3\" stitchTiles=\"stitch\"/%3E%3C/filter%3E%3Crect width=\"100%25\" height=\"100%25\" filter=\"url(%23noiseFilter)\"/%3E%3C/svg%3E')",
        }}
      />

      {/* Content */}
      <div className="relative z-10 h-full w-full">{children}</div>
    </div>
  );
}


