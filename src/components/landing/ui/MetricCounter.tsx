'use client';

import React, { useEffect, useRef } from 'react';
import { useInView, useMotionValue, useSpring, useReducedMotion } from 'framer-motion';
import { springPhysics } from '../motion/springConfig';

interface MetricCounterProps {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  label?: string;
}

export function MetricCounter({
  value,
  decimals = 0,
  prefix = '',
  suffix = '',
  className = '',
  label,
}: MetricCounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  const shouldReduceMotion = useReducedMotion();
  const motionVal = useMotionValue(shouldReduceMotion ? value : 0);
  const spring = useSpring(motionVal, springPhysics.smooth);
  const hasAnimatedRef = useRef(false);

  useEffect(() => {
    if (shouldReduceMotion) return;
    if (inView && !hasAnimatedRef.current) {
      hasAnimatedRef.current = true;
      motionVal.set(value);
    }
  }, [inView, value, motionVal, shouldReduceMotion]);

  useEffect(() => {
    if (shouldReduceMotion) return;
    const unsubscribe = spring.on('change', (latest) => {
      if (ref.current && hasAnimatedRef.current) {
        ref.current.textContent = `${prefix}${latest.toFixed(decimals)}${suffix}`;
      }
    });
    return () => unsubscribe();
  }, [spring, decimals, prefix, suffix, shouldReduceMotion]);

  return (
    <div className="flex flex-col">
      <span
        ref={ref}
        className={`font-mono text-white tracking-tight ${className}`}
      >
        {prefix}
        {value.toFixed(decimals)}
        {suffix}
      </span>
      {label && (
        <span className="text-xs text-zinc-500 uppercase font-mono mt-1 tracking-wider">
          {label}
        </span>
      )}
    </div>
  );
}
