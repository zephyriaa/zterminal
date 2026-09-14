"use client";

import React, { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";

export const EASE_OUT_QUINT = [0.22, 1, 0.36, 1] as const;
export const EASE_OUT_EXPO = EASE_OUT_QUINT;

/** Unified ZTerminal motion design system tokens */
export const MOTION_EASE = {
  out: [0.22, 1, 0.36, 1] as const,
  standard: [0.25, 0.1, 0.25, 1] as const,
} as const;

export const MOTION_DURATION = {
  fast: 0.22,
  normal: 0.38,
  heading: 0.45,
  showcase: 0.55,
} as const;

export const MOTION_DISTANCE = {
  micro: 8,
  small: 12,
  medium: 16,
} as const;

/** Calibrated viewport reveal settings: triggers just as content crosses reading zone */
export const VIEWPORT_CONFIG = {
  once: true,
  amount: 0.15,
  margin: "0px 0px -40px 0px",
} as const;

export function useIsReducedMotion(): boolean {
  const prefersReduced = useReducedMotion();
  return prefersReduced ?? false;
}

/**
 * MaskedHeading renders lines of text inside an overflow-hidden mask.
 * Smoothly slides up from small offset with crisp ease-out.
 */
interface MaskedHeadingProps {
  as?: "h1" | "h2" | "h3" | "h4" | "p" | "div";
  className?: string;
  id?: string;
  lines: Array<{
    text: string;
    italic?: boolean;
    className?: string;
  }>;
  delay?: number;
  stagger?: number;
  triggerOnMount?: boolean;
}

export function MaskedHeading({
  as = "h2",
  className,
  id,
  lines,
  delay = 0,
  stagger = 0.04,
  triggerOnMount = false,
}: MaskedHeadingProps) {
  const reduced = useIsReducedMotion();
  const Tag = as;

  return (
    <Tag id={id} className={className}>
      {lines.map((line, idx) => {
        const lineDelay = delay + idx * stagger;

        if (reduced) {
          return (
            <span key={idx} style={{ display: "block" }}>
              {line.italic ? <em className={line.className}>{line.text}</em> : <span className={line.className}>{line.text}</span>}
            </span>
          );
        }

        return (
          <motion.span
            key={idx}
            style={{ display: "block" }}
            initial={{ opacity: 0, y: MOTION_DISTANCE.small }}
            {...(triggerOnMount
              ? { animate: { opacity: 1, y: 0 } }
              : {
                  whileInView: { opacity: 1, y: 0 },
                  viewport: VIEWPORT_CONFIG,
                })}
            transition={{
              duration: MOTION_DURATION.heading,
              ease: MOTION_EASE.out,
              delay: lineDelay,
            }}
          >
            {line.italic ? (
              <em className={line.className}>{line.text}</em>
            ) : (
              <span className={line.className}>{line.text}</span>
            )}
          </motion.span>
        );
      })}
    </Tag>
  );
}

/**
 * FadeInView provides restrained fade + subtle vertical slide.
 * Content becomes readable immediately without forcing the user to wait.
 */
interface FadeInViewProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  yOffset?: number;
  duration?: number;
  triggerOnMount?: boolean;
}

export function FadeInView({
  children,
  className,
  delay = 0,
  yOffset = MOTION_DISTANCE.small,
  duration = MOTION_DURATION.normal,
  triggerOnMount = false,
}: FadeInViewProps) {
  const reduced = useIsReducedMotion();

  if (reduced) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: yOffset }}
      {...(triggerOnMount
        ? { animate: { opacity: 1, y: 0 } }
        : {
            whileInView: { opacity: 1, y: 0 },
            viewport: VIEWPORT_CONFIG,
          })}
      transition={{
        duration,
        ease: MOTION_EASE.out,
        delay,
      }}
    >
      {children}
    </motion.div>
  );
}

/**
 * ScaleReveal provides subtle scale (0.99 -> 1.0) and opacity entrance for frames,
 * keeping screenshots and inspector panels crisp and physically stable.
 */
interface ScaleRevealProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}

export function ScaleReveal({ children, className, delay = 0 }: ScaleRevealProps) {
  const reduced = useIsReducedMotion();

  if (reduced) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, scale: 0.99, y: MOTION_DISTANCE.small }}
      whileInView={{ opacity: 1, scale: 1, y: 0 }}
      viewport={VIEWPORT_CONFIG}
      transition={{
        duration: MOTION_DURATION.showcase,
        ease: MOTION_EASE.out,
        delay,
      }}
    >
      {children}
    </motion.div>
  );
}

/**
 * StaggerContainer and StaggerItem coordinate restrained sequential reveals.
 */
interface StaggerContainerProps {
  children: React.ReactNode;
  className?: string;
  staggerDelay?: number;
  delay?: number;
}

export function StaggerContainer({
  children,
  className,
  staggerDelay = 0.04,
  delay = 0,
}: StaggerContainerProps) {
  const reduced = useIsReducedMotion();

  if (reduced) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={VIEWPORT_CONFIG}
      variants={{
        hidden: {},
        show: {
          transition: {
            staggerChildren: staggerDelay,
            delayChildren: delay,
          },
        },
      }}
    >
      {children}
    </motion.div>
  );
}

interface StaggerItemProps {
  children: React.ReactNode;
  className?: string;
  yOffset?: number;
}

export function StaggerItem({ children, className, yOffset = MOTION_DISTANCE.micro }: StaggerItemProps) {
  const reduced = useIsReducedMotion();

  if (reduced) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: yOffset },
        show: {
          opacity: 1,
          y: 0,
          transition: {
            duration: MOTION_DURATION.normal,
            ease: MOTION_EASE.out,
          },
        },
      }}
    >
      {children}
    </motion.div>
  );
}

/**
 * ParallaxText applies a subtle, grounded vertical offset.
 * Calibrated to never detach text from its reading context.
 */
interface ParallaxTextProps {
  children: React.ReactNode;
  className?: string;
  fromY?: number;
  toY?: number;
}

export function ParallaxText({ children, className, fromY = 8, toY = -8 }: ParallaxTextProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const reduced = useIsReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], [fromY, toY]);

  if (reduced) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div ref={ref} className={className} style={{ position: "relative" }}>
      <motion.div style={{ y }}>{children}</motion.div>
    </div>
  );
}

