"use client";

import React, { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";

export const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;

export function useIsReducedMotion(): boolean {
  const shouldReduce = useReducedMotion();
  return Boolean(shouldReduce);
}

/**
 * MaskedHeading renders lines of text inside an overflow-hidden mask.
 * Each line smoothly slides up from 100% to 0% with ease-out-expo.
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
  stagger = 0.14,
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
          <span
            key={idx}
            style={{
              display: "block",
              overflow: "hidden",
              paddingBottom: "0.08em",
            }}
          >
            <motion.span
              style={{ display: "block" }}
              initial={{ y: "110%", opacity: 0 }}
              {...(triggerOnMount
                ? { animate: { y: "0%", opacity: 1 } }
                : {
                    whileInView: { y: "0%", opacity: 1 },
                    viewport: { once: true, margin: "-10%" },
                  })}
              transition={{
                duration: 0.85,
                ease: EASE_OUT_EXPO,
                delay: lineDelay,
              }}
            >
              {line.italic ? (
                <em className={line.className}>{line.text}</em>
              ) : (
                <span className={line.className}>{line.text}</span>
              )}
            </motion.span>
          </span>
        );
      })}
    </Tag>
  );
}

/**
 * FadeInView provides restrained fade + vertical slide.
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
  yOffset = 20,
  duration = 0.65,
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
            viewport: { once: true, margin: "-8%" },
          })}
      transition={{
        duration,
        ease: EASE_OUT_EXPO,
        delay,
      }}
    >
      {children}
    </motion.div>
  );
}

/**
 * ScaleReveal provides subtle scale (0.97 -> 1.0) and opacity entrance for frames,
 * screenshots, or inspector panels.
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
      initial={{ opacity: 0, scale: 0.97, y: 22 }}
      whileInView={{ opacity: 1, scale: 1, y: 0 }}
      viewport={{ once: true, margin: "-8%" }}
      transition={{
        duration: 0.8,
        ease: EASE_OUT_EXPO,
        delay,
      }}
    >
      {children}
    </motion.div>
  );
}

/**
 * StaggerContainer and StaggerItem coordinate sequential reveals of cards,
 * metrics, or chips.
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
  staggerDelay = 0.08,
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
      viewport={{ once: true, margin: "-6%" }}
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

export function StaggerItem({ children, className, yOffset = 16 }: StaggerItemProps) {
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
            duration: 0.6,
            ease: EASE_OUT_EXPO,
          },
        },
      }}
    >
      {children}
    </motion.div>
  );
}

/**
 * ParallaxText applies a subtle scroll-linked vertical translation to display copy.
 */
interface ParallaxTextProps {
  children: React.ReactNode;
  className?: string;
  fromY?: number;
  toY?: number;
}

export function ParallaxText({ children, className, fromY = 24, toY = -24 }: ParallaxTextProps) {
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
