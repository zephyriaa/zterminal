'use client';

import React from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { fadeInUp } from './springConfig';

interface MotionWrapperProps extends HTMLMotionProps<'div'> {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  viewportMargin?: string;
}

export function MotionWrapper({
  children,
  className = '',
  delay = 0,
  viewportMargin = '-80px',
  ...props
}: MotionWrapperProps) {
  const customVariant = delay
    ? {
        ...fadeInUp,
        visible: {
          ...fadeInUp.visible,
          transition: {
            ...fadeInUp.visible.transition,
            delay,
          },
        },
      }
    : fadeInUp;

  return (
    <motion.div
      variants={customVariant}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: viewportMargin }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}
