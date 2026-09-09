"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, useScroll, useTransform, useSpring } from "framer-motion";
import { useIsReducedMotion, EASE_OUT_EXPO } from "./motion-primitives";
import { ParticleWave } from "./particle-wave";
import styles from "./hero-scene.module.css";

const KEY_ROWS = [
  "esc 1 2 3 4 5 6 7 8 9 0 − = delete",
  "tab Q W E R T Y U I O P [ ] \\",
  "caps A S D F G H J K L ; ’ enter",
  "shift Z X C V B N M , . / shift",
  "fn ctrl opt cmd space cmd opt ◀ ▲ ▶",
];

export function HeroScene() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);
  const [heroHeight, setHeroHeight] = useState<number | null>(null);
  const [isDesktop, setIsDesktop] = useState(true);
  const reduced = useIsReducedMotion();

  // Resize handler matching index.html desktop scaling
  useEffect(() => {
    function onResize() {
      const width = window.innerWidth;
      const height = window.innerHeight;
      if (width > 800) {
        setIsDesktop(true);
        const s = width / 1672;
        setScale(s);
        setHeroHeight(Math.max(941 * s, height));
      } else {
        setIsDesktop(false);
        setScale(1);
        setHeroHeight(null);
      }
    }

    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Smooth mouse physics for restrained 2-4px parallax
  const springX = useSpring(0, { stiffness: 45, damping: 25 });
  const springY = useSpring(0, { stiffness: 45, damping: 25 });
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (reduced || !isDesktop) return;

    function handleMouseMove(e: MouseEvent) {
      const nx = e.clientX / window.innerWidth - 0.5;
      const ny = e.clientY / window.innerHeight - 0.5;
      springX.set(nx);
      springY.set(ny);
      setMousePos({ x: nx, y: ny });
    }

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [reduced, isDesktop, springX, springY]);

  // Restrained laptop parallax (strictly 2-4px displacement, sub-degree tilt)
  const laptopParallaxX = useTransform(springX, [-0.5, 0.5], [-4, 4]);
  const laptopParallaxY = useTransform(springY, [-0.5, 0.5], [-3, 3]);
  const laptopRotateY = useTransform(springX, [-0.5, 0.5], [-0.7, 0.7]);
  const laptopRotateX = useTransform(springY, [-0.5, 0.5], [0.5, -0.5]);

  // Natural scroll depth transition
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"],
  });

  const copyScrollY = useTransform(scrollYProgress, [0, 0.7], [0, -45]);
  const copyScrollOpacity = useTransform(scrollYProgress, [0, 0.55], [1, 0.15]);
  const laptopScrollY = useTransform(scrollYProgress, [0, 0.7], [0, -25]);
  const particleScrollOpacity = useTransform(scrollYProgress, [0, 0.5], [1, 0.2]);

  return (
    <div
      ref={containerRef}
      className={styles.viewport}
      style={heroHeight ? { height: `${heroHeight}px` } : undefined}
    >
      <div
        className={styles.scene}
        id="overview"
        style={isDesktop ? { transform: `scale(${scale})` } : undefined}
      >
        {/* Violet ambient glow beneath laptop */}
        <div className={styles.glow} aria-hidden="true" />

        {/* Deterministic Canvas Particle Ridge */}
        <motion.div
          initial={reduced ? undefined : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.2, delay: 0.75, ease: EASE_OUT_EXPO }}
          style={{ opacity: particleScrollOpacity }}
        >
          <ParticleWave
            className={styles.waves}
            mouseNormalizedX={mousePos.x}
            mouseNormalizedY={mousePos.y}
          />
        </motion.div>

        {/* 80px Visual Height Public Header */}
        <header className={styles.header}>
          <Link href="/" className={styles.brand} aria-label="ZTerminal home">
            <i className={styles.mark} aria-hidden="true" />
            <span>ZTERMINAL</span>
          </Link>
          <nav aria-label="Main navigation" className={styles.nav}>
            <a href="#overview">Overview</a>
            <a href="#workflow">Workflow</a>
            <Link href="/download">Windows</Link>
            <Link href="/docs">Docs</Link>
            <Link href="/terminal">Web terminal</Link>
          </nav>
        </header>

        {/* Hero Editorial Copy */}
        <motion.section
          className={styles.heroCopy}
          aria-labelledby="hero-title"
          style={{ y: copyScrollY, opacity: copyScrollOpacity }}
        >
          {/* Eyebrow */}
          <motion.span
            className={styles.eyebrow}
            initial={reduced ? undefined : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15, ease: EASE_OUT_EXPO }}
          >
            QUANTITATIVE MARKET RESEARCH
          </motion.span>

          {/* Enormous Headline with Sans + Italic Serif accent & Line-Masked Reveals */}
          <h1 id="hero-title">
            <span className={styles.lineMask}>
              <motion.span
                className={styles.first}
                initial={reduced ? undefined : { y: "115%", opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.9, delay: 0.32, ease: [0.16, 1, 0.3, 1] }}
              >
                See more.
              </motion.span>
            </span>
            <span className={styles.lineMask}>
              <motion.em
                initial={reduced ? undefined : { y: "115%", opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.95, delay: 0.48, ease: [0.16, 1, 0.3, 1] }}
              >
                Guess less.
              </motion.em>
            </span>
          </h1>

          {/* Restrained Supporting Copy */}
          <motion.p
            className={styles.description}
            initial={reduced ? undefined : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.65, ease: EASE_OUT_EXPO }}
          >
            ZTerminal is a quantitative market research workstation for
            better-prepared, evidence-led decisions.
          </motion.p>

          {/* Actions */}
          <motion.div
            className={styles.actions}
            initial={reduced ? undefined : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.75, delay: 0.8, ease: EASE_OUT_EXPO }}
          >
            <Link href="/download" className={styles.primary}>
              Explore for Windows <span className={styles.arrow}>↗</span>
            </Link>
            <Link href="/terminal" className={styles.secondary}>
              Launch web terminal <span className={styles.arrow}>↗</span>
            </Link>
          </motion.div>

          {/* Disclaimer */}
          <motion.p
            className={styles.disclaimer}
            initial={reduced ? undefined : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.92 }}
          >
            Decision support for traders. No broker route. User retains control of execution.
          </motion.p>
        </motion.section>

        {/* Approved 3D Physical Laptop Composition with Real Product UI */}
        <div
          className={styles.computer}
          id="terminal"
          role="img"
          aria-label="ZTerminal quantitative market research workstation showing the real market canvas"
        >
          <motion.div
            className={styles.laptopMotionStage}
            initial={reduced ? undefined : { opacity: 0, y: 22, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 1.15, delay: 0.3, ease: EASE_OUT_EXPO }}
            style={
              !reduced && isDesktop
                ? {
                    x: laptopParallaxX,
                    y: laptopParallaxY,
                    rotateX: laptopRotateX,
                    rotateY: laptopRotateY,
                  }
                : undefined
            }
          >
            {/* Scroll depth delta */}
            <motion.div style={!reduced && isDesktop ? { y: laptopScrollY } : undefined}>
              {/* Laptop Screen Lid with Projective Homography */}
              <div className={styles.lid}>
                <motion.div
                  className={styles.terminal}
                  initial={reduced ? undefined : { opacity: 0.2, filter: "brightness(0.6) contrast(0.92)" }}
                  animate={{ opacity: 1, filter: "brightness(1) contrast(1)" }}
                  transition={{ duration: 1.0, delay: 0.45, ease: EASE_OUT_EXPO }}
                >
                  <Image
                    src="/landing/terminal-screenshot.webp"
                    alt="Current ZTerminal research workspace with real candlestick chart and indicators"
                    width={3200}
                    height={1800}
                    priority
                    className={styles.screenImage}
                    sizes="(max-width: 800px) 100vw, 1000px"
                  />
                  {/* Subtle Violet Screen Wake Glow */}
                  <motion.div
                    className={styles.screenPowerGlow}
                    aria-hidden="true"
                    initial={reduced ? undefined : { opacity: 0 }}
                    animate={{ opacity: [0, 0.65, 0.2] }}
                    transition={{ duration: 1.2, delay: 0.5, ease: "easeOut" }}
                  />
                  {/* Diagonal Specular Sheen Sweep */}
                  {!reduced && (
                    <motion.div
                      className={styles.screenSheen}
                      aria-hidden="true"
                      initial={{ x: "-120%", opacity: 0 }}
                      animate={{ x: "120%", opacity: [0, 1, 0.8, 0] }}
                      transition={{ duration: 1.25, delay: 0.75, ease: [0.16, 1, 0.3, 1] }}
                    />
                  )}
                  {/* Static Ambient Glass Glare */}
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

              {/* Trackpad */}
              <div className={styles.trackpad} aria-hidden="true" />
            </motion.div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
