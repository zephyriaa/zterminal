"use client";

import React, { useSyncExternalStore, useRef, useState, useEffect } from "react";
import { motion, useScroll, useTransform, useInView } from "framer-motion";

/** Precision kinetic easing curves */
export const EASE_HYPER_EXPO = [0.19, 1, 0.22, 1] as const;
export const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;
export const EASE_OUT_QUINT = [0.22, 1, 0.36, 1] as const;
export const EASE_DECEL = [0.0, 0.0, 0.2, 1] as const;

export const MOTION_EASE = {
  hyper: EASE_HYPER_EXPO,
  out: EASE_OUT_EXPO,
  quint: EASE_OUT_QUINT,
  standard: [0.25, 0.1, 0.25, 1] as const,
} as const;

export const MOTION_DURATION = {
  instant: 0.15,
  fast: 0.28,
  normal: 0.48,
  heading: 0.62,
  showcase: 0.75,
} as const;

export const MOTION_DISTANCE = {
  micro: 6,
  small: 12,
  medium: 20,
  large: 32,
} as const;

export const VIEWPORT_CONFIG = {
  once: true,
  amount: 0.05,
} as const;

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

function getReducedMotionSnapshot() {
  if (typeof window === "undefined") return false;
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

export function useIsReducedMotion(): boolean {
  return useSyncExternalStore(subscribeReducedMotion, getReducedMotionSnapshot, () => false);
}

const emptySubscribe = () => () => {};

export function useMotionReady(): boolean {
  const [ready, setReady] = useState(false);
  const reduced = useIsReducedMotion();

  useEffect(() => {
    setReady(true);
  }, []);

  return ready && !reduced;
}

/**
 * MaskedHeading:
 * Renders lines of typography that slide up crisply from an overflow:hidden mask.
 */
interface MaskedHeadingProps {
  as?: "h1" | "h2" | "h3" | "h4" | "p" | "div";
  className?: string;
  id?: string;
  lines: Array<{
    text?: string;
    content?: React.ReactNode;
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
  stagger = 0.08,
  triggerOnMount = false,
}: MaskedHeadingProps) {
  const motionReady = useMotionReady();
  const Tag = as;
  const MotionTag = (motion[as as keyof typeof motion] || motion.h2) as typeof motion.h2;

  if (!motionReady) {
    return (
      <Tag id={id} className={className}>
        {lines.map((line, idx) => (
          <span key={idx} style={{ display: "block" }}>
            {line.content ? (
              line.content
            ) : line.italic ? (
              <em className={line.className}>{line.text}</em>
            ) : (
              <span className={line.className}>{line.text}</span>
            )}
          </span>
        ))}
      </Tag>
    );
  }

  return (
    <MotionTag
      id={id}
      className={className}
      initial="hidden"
      {...(triggerOnMount
        ? { animate: "show" }
        : {
            whileInView: "show",
            viewport: { once: true, amount: 0 },
          })}
      variants={{
        hidden: {},
        show: {
          transition: {
            staggerChildren: stagger,
            delayChildren: delay,
          },
        },
      }}
    >
      {lines.map((line, idx) => (
        <span key={idx} style={{ display: "block", overflow: "hidden" }}>
          <motion.span
            style={{ display: "block", willChange: "transform, opacity" }}
            variants={{
              hidden: { opacity: 0, y: "115%" },
              show: {
                opacity: 1,
                y: "0%",
                transition: {
                  duration: MOTION_DURATION.heading,
                  ease: MOTION_EASE.hyper,
                },
              },
            }}
          >
            {line.content ? (
              line.content
            ) : line.italic ? (
              <em className={line.className}>{line.text}</em>
            ) : (
              <span className={line.className}>{line.text}</span>
            )}
          </motion.span>
        </span>
      ))}
    </MotionTag>
  );
}

/**
 * FadeInView:
 * Physics-based vertical entrance with crisp opacity.
 */
interface FadeInViewProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  yOffset?: number;
  duration?: number;
  triggerOnMount?: boolean;
  style?: React.CSSProperties;
}

export function FadeInView({
  children,
  className,
  delay = 0,
  yOffset = MOTION_DISTANCE.small,
  duration = MOTION_DURATION.normal,
  triggerOnMount = false,
  style,
}: FadeInViewProps) {
  const motionReady = useMotionReady();

  if (!motionReady) {
    return <div className={className} style={style}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      style={style}
      initial={{ opacity: 0, y: yOffset }}
      {...(triggerOnMount
        ? { animate: { opacity: 1, y: 0 } }
        : {
            whileInView: { opacity: 1, y: 0 },
            viewport: VIEWPORT_CONFIG,
          })}
      transition={{
        duration,
        ease: MOTION_EASE.hyper,
        delay,
      }}
    >
      {children}
    </motion.div>
  );
}

/**
 * ScaleReveal:
 * Subtle scale expansion (0.975 -> 1.0) and opacity for UI frames and inspectors.
 */
interface ScaleRevealProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  style?: React.CSSProperties;
}

export function ScaleReveal({ children, className, delay = 0, style }: ScaleRevealProps) {
  const motionReady = useMotionReady();

  if (!motionReady) {
    return <div className={className} style={style}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      style={style}
      initial={{ opacity: 0, scale: 0.975, y: MOTION_DISTANCE.micro }}
      whileInView={{ opacity: 1, scale: 1, y: 0 }}
      viewport={VIEWPORT_CONFIG}
      transition={{
        duration: MOTION_DURATION.showcase,
        ease: MOTION_EASE.hyper,
        delay,
      }}
    >
      {children}
    </motion.div>
  );
}

/**
 * StaggerContainer & StaggerItem:
 * Orchestrates sequential micro-reveals with minimal delay.
 */
interface StaggerContainerProps {
  children: React.ReactNode;
  className?: string;
  staggerDelay?: number;
  delay?: number;
  style?: React.CSSProperties;
}

export function StaggerContainer({
  children,
  className,
  staggerDelay = 0.04,
  delay = 0,
  style,
}: StaggerContainerProps) {
  const motionReady = useMotionReady();

  if (!motionReady) {
    return <div className={className} style={style}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      style={style}
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
  style?: React.CSSProperties;
}

export function StaggerItem({ children, className, yOffset = MOTION_DISTANCE.micro, style }: StaggerItemProps) {
  const motionReady = useMotionReady();

  if (!motionReady) {
    return <div className={className} style={style}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      style={style}
      variants={{
        hidden: { opacity: 0, y: yOffset },
        show: {
          opacity: 1,
          y: 0,
          transition: {
            duration: MOTION_DURATION.fast,
            ease: MOTION_EASE.hyper,
          },
        },
      }}
    >
      {children}
    </motion.div>
  );
}

/**
 * CounterReveal:
 * Live quantitative stat counter that smoothly increments from 0 to target value on viewport enter.
 */
interface CounterRevealProps {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  duration?: number;
  className?: string;
}

export function CounterReveal({
  value,
  prefix = "",
  suffix = "",
  decimals = 0,
  duration = 1.4,
  className,
}: CounterRevealProps) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const isInView = useInView(ref, { once: true, amount: 0.2 });
  const [displayValue, setDisplayValue] = useState(0);
  const reduced = useIsReducedMotion();

  useEffect(() => {
    if (reduced) {
      setDisplayValue(value);
      return;
    }

    if (!isInView) return;

    let startTimestamp: number | null = null;
    const startVal = 0;
    const endVal = value;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / (duration * 1000), 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const current = startVal + (endVal - startVal) * easeOut;
      setDisplayValue(current);

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        setDisplayValue(endVal);
      }
    };

    requestAnimationFrame(step);
  }, [isInView, value, duration, reduced]);

  return (
    <span ref={ref} className={className}>
      {prefix}
      {displayValue.toFixed(decimals)}
      {suffix}
    </span>
  );
}
