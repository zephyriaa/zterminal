"use client";

import { useEffect, useId, useRef } from "react";
import { preload } from "react-dom";
import { motion, useSpring, useTransform } from "framer-motion";
import styles from "./hero-laptop.module.css";

/**
 * Device-only crop of the supplied, undamaged 1672 × 941 reference.
 * Source pixels retain their original perspective, with no screen overlay.
 * Page typography, navigation and lighting are separate HTML/CSS components.
 */
export function HeroLaptop() {
  const clipId = useId();
  const stage = useRef<HTMLDivElement>(null);
  const x = useSpring(0, { stiffness: 70, damping: 28 });
  const y = useSpring(0, { stiffness: 70, damping: 28 });
  const rotateX = useTransform(y, [-2, 2], [0.25, -0.25]);
  const rotateY = useTransform(x, [-2, 2], [-0.3, 0.3]);
  preload("/landing/hero-laptop-source.png", { as: "image" });

  useEffect(() => {
    const hero = stage.current?.closest("section");
    if (!hero) return;
    const allowed = window.matchMedia("(pointer: fine) and (min-width: 1001px) and (prefers-reduced-motion: no-preference)");
    const readyAt = performance.now() + 1400;
    const reset = () => { x.jump(0); y.jump(0); };
    const settle = () => { x.set(0); y.set(0); };
    const move = (event: PointerEvent) => {
      if (!allowed.matches || performance.now() < readyAt) return;
      const rect = hero.getBoundingClientRect();
      x.set(((event.clientX - rect.left) / rect.width - 0.5) * 4);
      y.set(((event.clientY - rect.top) / rect.height - 0.5) * 4);
    };
    hero.addEventListener("pointermove", move, { passive: true });
    hero.addEventListener("pointerleave", settle);
    allowed.addEventListener("change", reset);
    return () => {
      hero.removeEventListener("pointermove", move);
      hero.removeEventListener("pointerleave", settle);
      allowed.removeEventListener("change", reset);
    };
  }, [x, y]);

  return (
    <div ref={stage} className={styles.laptopStage}>
      <div className={styles.atmosphericGlow} aria-hidden="true" />
      <div className={styles.groundReflection} aria-hidden="true" />
      <div className={styles.laptopEntrance}>
        <motion.div className={styles.laptopContainer} style={{ x, y, rotateX, rotateY }}>
          <svg
            className={styles.laptopImage}
            viewBox="500 190 1120 720"
            role="img"
            aria-label="ZTerminal research workspace on a laptop, showing a candlestick chart and volume history"
          >
            <defs>
              <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
                <path d="M 521 791 Q 524 788 534 785 L 838 726 L 881 276 Q 883 257 904 253 L 1574 204 Q 1605 201 1603 229 L 1570 759 Q 1569 782 1558 796 L 1343 887 Q 1325 895 1294 891 L 535 816 Q 520 814 520 807 Z" />
              </clipPath>
            </defs>
            <g className={styles.screenGroup}>
              <image
                href="/landing/hero-laptop-source.png"
                width="1672"
                height="941"
                clipPath={`url(#${clipId})`}
              />
            </g>
          </svg>
        </motion.div>
      </div>
    </div>
  );
}
