"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { motion, useScroll, useTransform, useSpring } from "framer-motion";
import { HeroScene, type HeroTransitionMode } from "./hero-scene";
import { useIsReducedMotion } from "./motion-primitives";
import styles from "./hero-act-transition.module.css";

interface HeroActTransitionProps {
  atmosphere: ReactNode;
  eyebrow: ReactNode;
  heading: ReactNode;
  body: ReactNode;
}

function readMode(): HeroTransitionMode {
  if (typeof window === "undefined") return "desktop";
  if (window.matchMedia("(min-width: 1025px)").matches) return "desktop";
  if (window.matchMedia("(min-width: 801px)").matches) return "tablet";
  return "mobile";
}

export function HeroActTransition({
  atmosphere,
  eyebrow,
  heading,
  body,
}: HeroActTransitionProps) {
  const sceneRef = useRef<HTMLElement>(null);
  const [mode, setMode] = useState<HeroTransitionMode>("desktop");
  const [scrollSpan, setScrollSpan] = useState(480);
  const reduced = useIsReducedMotion();
  const { scrollY } = useScroll();
  const rawProgress = useTransform(scrollY, [0, scrollSpan], [0, 1]);
  const smoothProgress = useSpring(rawProgress, { stiffness: 120, damping: 28, restDelta: 0.001 });
  const scrollYProgress = reduced ? rawProgress : smoothProgress;

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1025px)");
    const tablet = window.matchMedia("(min-width: 801px)");
    const update = () => {
      setMode(readMode());
      const sceneHeight = sceneRef.current?.getBoundingClientRect().height ?? window.innerHeight;
      setScrollSpan(Math.max(1, sceneHeight - window.innerHeight));
    };
    update();
    desktop.addEventListener("change", update);
    tablet.addEventListener("change", update);
    window.addEventListener("resize", update, { passive: true });
    return () => {
      desktop.removeEventListener("change", update);
      tablet.removeEventListener("change", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  const atmosphereOpacity = useTransform(scrollYProgress, [0.12, 0.55], [0, 1]);
  const atmosphereY = useTransform(scrollYProgress, [0.12, 0.58], [28, 0]);
  const eyebrowOpacity = useTransform(scrollYProgress, [0.48, 0.62], [0, 1]);
  const eyebrowY = useTransform(scrollYProgress, [0.48, 0.64], [18, 0]);
  const headingOpacity = useTransform(scrollYProgress, [0.54, 0.72], [0, 1]);
  const headingY = useTransform(scrollYProgress, [0.54, 0.74], [26, 0]);
  const bodyOpacity = useTransform(scrollYProgress, [0.64, 0.82], [0, 1]);
  const bodyY = useTransform(scrollYProgress, [0.64, 0.84], [22, 0]);
  const useScrollMotion = !reduced && mode !== "mobile";

  return (
    <section
      ref={sceneRef}
      className={styles.transition}
      aria-label="Opening product story"
    >
      <div className={styles.stage}>
        <motion.div
          className={styles.atmosphere}
          aria-hidden="true"
          style={
            useScrollMotion
              ? { opacity: atmosphereOpacity, y: atmosphereY }
              : { opacity: 1, y: 0 }
          }
        >
          {atmosphere}
        </motion.div>

        <HeroScene
          className={styles.hero}
          progress={scrollYProgress}
          mode={mode}
        />

        <section className={styles.actOne} id="see" aria-label="Act I: See">
          <div className={styles.actOneLead}>
            <motion.div
              className={styles.eyebrow}
              style={
                useScrollMotion
                  ? { opacity: eyebrowOpacity, y: eyebrowY }
                  : { opacity: 1, y: 0 }
              }
            >
              {eyebrow}
            </motion.div>
            <motion.div
              className={styles.heading}
              style={
                useScrollMotion
                  ? { opacity: headingOpacity, y: headingY }
                  : { opacity: 1, y: 0 }
              }
            >
              {heading}
            </motion.div>
          </div>
          <motion.div
            className={styles.body}
            style={
              useScrollMotion ? { opacity: bodyOpacity, y: bodyY } : { opacity: 1, y: 0 }
            }
          >
            {body}
          </motion.div>
        </section>
      </div>
    </section>
  );
}
