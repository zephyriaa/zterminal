"use client";

import React, { useSyncExternalStore, useRef, useState, useEffect } from "react";
import { motion, useReducedMotion, useScroll, useTransform, useInView } from "framer-motion";

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

export function useIsReducedMotion(): boolean {
  const prefersReduced = useReducedMotion();
  return prefersReduced ?? false;
}

const emptySubscribe = () => () => {};

export function useMotionReady(): boolean {
  const isMounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
  const reduced = useIsReducedMotion();
  return isMounted && !reduced;
}

/**
 * MaskedHeading:
 * Renders lines of typography that slide up crisply from an overflow:hidden mask.
 * Avoids muddy blur filters; delivers crisp, razor-sharp editorial reveals.
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
            {line.italic ? (
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
            {line.italic ? (
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
 * SpotlightCard:
 * High-end interactive card with mouse-driven radial illumination.
 * Updates --mouse-x and --mouse-y CSS variables on cursor movement.
 */
interface SpotlightCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  spotlightColor?: string;
}

export function SpotlightCard({
  children,
  className = "",
  spotlightColor = "rgba(168, 85, 247, 0.15)",
  ...props
}: SpotlightCardProps) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    cardRef.current.style.setProperty("--mouse-x", `${x}px`);
    cardRef.current.style.setProperty("--mouse-y", `${y}px`);
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`relative overflow-hidden transition-all duration-300 ${className}`}
      {...props}
    >
      {/* Dynamic Cursor Spotlight Layer */}
      <div
        className="pointer-events-none absolute inset-0 transition-opacity duration-300"
        style={{
          opacity: isHovered ? 1 : 0,
          background: `radial-gradient(420px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), ${spotlightColor}, transparent 45%)`,
        }}
        aria-hidden="true"
      />
      {children}
    </div>
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
      // Ease-out cubic formula
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

  const formatted = displayValue.toFixed(decimals);

  return (
    <span ref={ref} className={className}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}

/**
 * ParallaxText:
 * Subtle vertical offset driven by scroll progress.
 */
interface ParallaxTextProps {
  children: React.ReactNode;
  className?: string;
  fromY?: number;
  toY?: number;
}

export function ParallaxText({ children, className, fromY = 8, toY = -8 }: ParallaxTextProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const motionReady = useMotionReady();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], [fromY, toY]);

  if (!motionReady) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div ref={ref} className={className} style={{ position: "relative" }}>
      <motion.div style={{ y }}>{children}</motion.div>
    </div>
  );
}
