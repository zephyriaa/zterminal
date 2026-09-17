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

export const fadeInUp = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: springPhysics.smooth,
  },
};

export const staggerContainer = (staggerChildren = 0.08) => ({
  hidden: {},
  visible: {
    transition: {
      staggerChildren,
      delayChildren: 0.1,
    },
  },
});
