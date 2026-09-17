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

  const mouseX = useMotionValue(100);
  const mouseY = useMotionValue(100);

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

  const specularBackground = useMotionTemplate`radial-gradient(420px circle at ${springX}px ${springY}px, rgba(255, 255, 255, 0.14), transparent 75%)`;

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      className={`group relative rounded-2xl transition-shadow duration-500 ${
        elevated ? 'liquid-glass-elevated' : 'liquid-glass'
      } ${className}`}
      style={style}
      {...props}
    >
      {/* Specular Edge Refraction Overlay */}
      <motion.div
        className="pointer-events-none absolute -inset-px rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100 z-10"
        style={{
          background: specularBackground,
        }}
      />

      {/* Content */}
      <div className="relative z-10 h-full w-full">{children}</div>
    </div>
  );
}
