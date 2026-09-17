'use client';

import React from 'react';
import { motion, useMotionValue, useSpring, useMotionTemplate } from 'framer-motion';
import { springPhysics } from '../motion/springConfig';

interface SpecularHighlightProps {
  className?: string;
  intensity?: 'subtle' | 'vibrant';
}

export function SpecularHighlight({
  className = '',
  intensity = 'subtle',
}: SpecularHighlightProps) {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const springX = useSpring(mouseX, springPhysics.snappy);
  const springY = useSpring(mouseY, springPhysics.snappy);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    mouseX.set(e.clientX - rect.left);
    mouseY.set(e.clientY - rect.top);
  };

  const alpha = intensity === 'vibrant' ? '0.22' : '0.12';
  const background = useMotionTemplate`radial-gradient(350px circle at ${springX}px ${springY}px, rgba(255, 255, 255, ${alpha}), transparent 70%)`;

  return (
    <div
      onMouseMove={handleMouseMove}
      className={`pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit] ${className}`}
    >
      <motion.div
        className="h-full w-full opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background }}
      />
    </div>
  );
}
