import type { Variants } from "framer-motion";

export const springPhysics = {
  smooth: {
    type: "spring",
    stiffness: 120,
    damping: 24,
    mass: 0.8,
  },
  snappy: {
    type: "spring",
    stiffness: 240,
    damping: 28,
    mass: 0.6,
  },
  gentle: {
    type: "spring",
    stiffness: 80,
    damping: 20,
    mass: 1.0,
  },
} as const;

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 28, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: springPhysics.smooth,
  },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.94 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: springPhysics.smooth,
  },
};

export const conduitDraw: Variants = {
  hidden: { pathLength: 0, opacity: 0 },
  visible: {
    pathLength: 1,
    opacity: 1,
    transition: {
      pathLength: { duration: 1.4, ease: "easeInOut" },
      opacity: { duration: 0.4 },
    },
  },
};

export const staggerContainer = (staggerChildren = 0.08, delayChildren = 0.1): Variants => ({
  hidden: {},
  visible: {
    transition: {
      staggerChildren,
      delayChildren,
    },
  },
});

