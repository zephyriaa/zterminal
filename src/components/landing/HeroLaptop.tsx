"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { motion, useSpring, useTransform } from "framer-motion";
import { useIsReducedMotion, useMotionReady, EASE_OUT_EXPO } from "./motion-primitives";
import styles from "./hero-laptop.module.css";

const KEY_ROWS = [
  "esc 1 2 3 4 5 6 7 8 9 0 − = delete",
  "tab Q W E R T Y U I O P [ ] \\",
  "caps A S D F G H J K L ; ’ enter",
  "shift Z X C V B N M , . / shift",
  "fn ctrl opt cmd space cmd opt ◀ ▲ ▶",
];

interface HeroLaptopProps {
  className?: string;
}

export function HeroLaptop({ className = "" }: HeroLaptopProps) {
  const reduced = useIsReducedMotion();
  const motionReady = useMotionReady();
  const [isFinePointer, setIsFinePointer] = useState(false);

  useEffect(() => {
    setIsFinePointer(window.matchMedia("(pointer: fine)").matches);
  }, []);

  // Smooth mouse physics for restrained 2-4px depth and sub-degree tilt
  const springX = useSpring(0, { stiffness: 45, damping: 25 });
  const springY = useSpring(0, { stiffness: 45, damping: 25 });

  useEffect(() => {
    if (reduced || !isFinePointer) return;

    function handleMouseMove(e: MouseEvent) {
      const nx = e.clientX / window.innerWidth - 0.5;
      const ny = e.clientY / window.innerHeight - 0.5;
      springX.set(nx);
      springY.set(ny);
    }

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [reduced, isFinePointer, springX, springY]);

  const laptopParallaxX = useTransform(springX, [-0.5, 0.5], [-4, 4]);
  const laptopParallaxY = useTransform(springY, [-0.5, 0.5], [-3, 3]);
  const laptopRotateY = useTransform(springX, [-0.5, 0.5], [-0.7, 0.7]);
  const laptopRotateX = useTransform(springY, [-0.5, 0.5], [0.5, -0.5]);

  return (
    <div className={`${styles.laptopStage} ${className}`}>
      {/* Ambient violet ground contact glow */}
      <div className={styles.contactGlow} aria-hidden="true" />

      {/* Recovered 3D Physical Laptop Workstation */}
      <div
        className={styles.computer}
        role="img"
        aria-label="ZTerminal quantitative research workstation showing authentic terminal interface"
      >
        <motion.div
          className={styles.laptopMotionStage}
          initial={motionReady ? { opacity: 0, y: 16, scale: 0.99 } : false}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.05, ease: EASE_OUT_EXPO }}
          style={
            !reduced && isFinePointer
              ? {
                  x: laptopParallaxX,
                  y: laptopParallaxY,
                  rotateX: laptopRotateX,
                  rotateY: laptopRotateY,
                }
              : undefined
          }
        >
          {/* Laptop Screen Lid with Canonical Projective Homography Matrix */}
          <div className={styles.lid}>
            <motion.div
              className={styles.terminal}
              initial={motionReady ? { opacity: 0.6, filter: "brightness(0.8)" } : false}
              animate={{ opacity: 1, filter: "brightness(1) contrast(1)" }}
              transition={{ duration: 0.7, delay: 0.15, ease: EASE_OUT_EXPO }}
            >
              <Image
                src="/landing/terminal-screenshot.png"
                alt="Authentic ZTerminal research workspace with real candlestick chart, indicators, and strategy tabs"
                width={3200}
                height={1800}
                priority
                className={styles.screenImage}
                sizes="(max-width: 800px) 100vw, 1000px"
              />

              {/* Violet Screen Power Wake Glow */}
              <motion.div
                className={styles.screenPowerGlow}
                aria-hidden="true"
                initial={reduced ? undefined : { opacity: 0 }}
                animate={motionReady ? { opacity: [0, 0.65, 0.2] } : { opacity: 0.2 }}
                transition={{ duration: 1.2, delay: 0.65, ease: "easeOut" }}
              />

              {/* Diagonal Specular Sheen Sweep */}
              {!reduced && (
                <motion.div
                  className={styles.screenSheen}
                  aria-hidden="true"
                  initial={{ x: "-120%", opacity: 0 }}
                  animate={motionReady ? { x: "120%", opacity: [0, 1, 0.8, 0] } : { opacity: 0 }}
                  transition={{ duration: 1.25, delay: 0.85, ease: [0.16, 1, 0.3, 1] }}
                />
              )}

              {/* Ambient Glass Glare */}
              <div className={styles.screenGlare} aria-hidden="true" />
            </motion.div>
          </div>

          {/* Metallic Laptop Chassis Base SVG */}
          <svg className={styles.base} viewBox="0 0 1672 941" aria-hidden="true">
            <defs>
              <linearGradient id="metal" x1="0" y1="0" x2=".7" y2="1">
                <stop stopColor="#67607e" />
                <stop offset=".2" stopColor="#30334f" />
                <stop offset=".48" stopColor="#15192c" />
                <stop offset=".8" stopColor="#22243c" />
                <stop offset="1" stopColor="#070b16" />
              </linearGradient>
              <linearGradient id="edge">
                <stop stopColor="#69617b" />
                <stop offset=".015" stopColor="#1b1c2e" />
                <stop offset=".4" stopColor="#0b0e1b" />
                <stop offset=".76" stopColor="#343149" />
                <stop offset="1" stopColor="#080c15" />
              </linearGradient>
              <linearGradient id="lip" x1="0" y1="0" x2="0" y2="1">
                <stop stopColor="#727083" />
                <stop offset=".45" stopColor="#3c394e" />
                <stop offset="1" stopColor="#191b2c" />
              </linearGradient>
              <filter id="shadow">
                <feGaussianBlur stdDeviation="8" />
              </filter>
            </defs>
            <ellipse
              cx="1091"
              cy="932"
              rx="594"
              ry="24"
              fill="#000"
              opacity=".8"
              filter="url(#shadow)"
            />
            <path
              d="M858 852 L1659 884 L1665 906 Q1659 925 1617 933 L1458 954 L497 909 Q478 906 480 886 Z"
              fill="url(#edge)"
              stroke="#212335"
              strokeWidth="1.5"
            />
            <path
              d="M858 852 L1658 884 L1438 933 L482 886 Q472 883 501 881Z"
              fill="url(#metal)"
              stroke="#666079"
              strokeOpacity=".38"
              strokeWidth="1.4"
            />
            <path
              d="M846 858L1587 886"
              fill="none"
              stroke="#8a769f"
              strokeOpacity=".32"
              strokeWidth="3"
            />
            <path
              d="M481 887L818 909 Q821 921 848 922L954 928Q972 929 975 917L1437 936"
              fill="none"
              stroke="#767087"
              strokeOpacity=".21"
              strokeWidth="3"
            />
            <path
              d="M816 908L975 916 Q972 926 954 927L840 920Q823 919 816 908"
              fill="url(#lip)"
              opacity=".65"
            />
            <path d="M1609 907l16-5v7l-16 5zM1635 900l10-3v8l-10 4z" fill="#01050a" />
          </svg>

          {/* Physical Keyboard Keycaps */}
          <div className={styles.keyboard} id="keyboard" aria-hidden="true">
            {KEY_ROWS.map((row, rIdx) => (
              <div key={rIdx} className={styles.keyRow}>
                {row.split(" ").map((token, kIdx) => {
                  const isSpace = token === "space";
                  const isWide = token.length > 2;
                  return (
                    <span
                      key={kIdx}
                      className={`${styles.key} ${isSpace ? styles.space : ""} ${
                        isWide ? styles.wide : ""
                      }`}
                    >
                      {isSpace ? "" : token}
                    </span>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Physical Trackpad */}
          <div className={styles.trackpad} aria-hidden="true" />
        </motion.div>
      </div>
    </div>
  );
}
