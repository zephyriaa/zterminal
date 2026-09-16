"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, useScroll, useTransform, useSpring } from "framer-motion";
import { useIsReducedMotion, EASE_OUT_EXPO, EASE_HYPER_EXPO } from "./motion-primitives";
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
  const [isDesktop, setIsDesktop] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const reduced = useIsReducedMotion();

  // Keep the interface responsive in CSS; JS only gates input-specific effects.
  useEffect(() => {
    function onResize() {
      setIsDesktop(window.matchMedia("(min-width: 801px)").matches);
    }

    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    function onScroll() {
      setIsScrolled(window.scrollY > 18);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!navOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setNavOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navOpen]);

  // Smooth mouse physics for DeepCharts-style 3D depth and parallax
  const springX = useSpring(0, { stiffness: 50, damping: 25 });
  const springY = useSpring(0, { stiffness: 50, damping: 25 });

  useEffect(() => {
    if (reduced || !isDesktop) return;

    function handleMouseMove(e: MouseEvent) {
      const nx = e.clientX / window.innerWidth - 0.5;
      const ny = e.clientY / window.innerHeight - 0.5;
      springX.set(nx);
      springY.set(ny);
    }

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [reduced, isDesktop, springX, springY]);

  // Restrained laptop parallax (strictly 2-4px displacement, sub-degree tilt)
  const laptopParallaxX = useTransform(springX, [-0.5, 0.5], [-4, 4]);
  const laptopParallaxY = useTransform(springY, [-0.5, 0.5], [-3, 3]);
  const laptopRotateY = useTransform(springX, [-0.5, 0.5], [-0.8, 0.8]);
  const laptopRotateX = useTransform(springY, [-0.5, 0.5], [0.6, -0.6]);

  // Natural scroll depth transition - calibrated so hero never crashes into header or drops opacity abruptly
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"],
  });

  const copyScrollY = useTransform(scrollYProgress, [0, 0.85], [0, -16]);
  const copyScrollOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0.65]);
  const laptopScrollY = useTransform(scrollYProgress, [0, 0.85], [0, -12]);
  const laptopScale = useTransform(scrollYProgress, [0, 0.85], [1.015, 1.0]);

  return (
    <div ref={containerRef} className={styles.viewport} id="overview">
      <div className={styles.scene}>
        {/* Violet ambient glow beneath laptop */}
        <div className={styles.glow} aria-hidden="true" />

        {/* Apple-style floating liquid frosted-glass navigation */}
        <header className={`${styles.header} ${isScrolled ? styles.headerScrolled : ""}`}>
          <Link href="/" className={styles.brand} aria-label="ZTerminal home">
            <i className={styles.mark} aria-hidden="true" />
            <span className={styles.brandText}>
              ZTERMINAL
              <span className={styles.betaBadge} aria-label="Beta product">BETA</span>
            </span>
          </Link>
          <button
            className={styles.menuToggle}
            type="button"
            aria-expanded={navOpen}
            aria-controls="landing-navigation"
            aria-label={navOpen ? "Close navigation" : "Open navigation"}
            onClick={() => setNavOpen((open) => !open)}
          >
            <span className={styles.menuIcon} aria-hidden="true" />
            <span className={styles.menuLabel}>Menu</span>
          </button>
          <nav id="landing-navigation" aria-label="Main navigation" className={`${styles.navGlassPill} ${navOpen ? styles.navOpen : ""}`}>
            <a href="#overview" className={styles.navGlassLink} onClick={() => setNavOpen(false)}>Overview</a>
            <a href="#research-loop" className={styles.navGlassLink} onClick={() => setNavOpen(false)}>Research loop</a>
            <Link href="/download" className={styles.navGlassLink} onClick={() => setNavOpen(false)}>Windows</Link>
            <Link href="/docs" className={styles.navGlassLink} onClick={() => setNavOpen(false)}>Docs</Link>
            <Link href="/terminal" className={styles.navGlassLink} onClick={() => setNavOpen(false)}>Web terminal</Link>
          </nav>
        </header>

        {/* Hero Editorial Copy */}
        <section
          className={styles.heroCopy}
          aria-labelledby="hero-title"
        >
          <motion.div style={{ y: copyScrollY, opacity: copyScrollOpacity }}>
          {/* Eyebrow */}
          <motion.span
            className={styles.eyebrow}
            initial={reduced ? undefined : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.05, ease: EASE_HYPER_EXPO }}
          >
            MARKET RESEARCH WORKSPACE · BETA
          </motion.span>

          {/* Enormous Headline with Sans + Italic Serif accent & Line-Masked Reveals */}
          <h1 id="hero-title">
            <span className={styles.lineMask}>
              <motion.span
                className={styles.first}
                initial={reduced ? undefined : { y: 24, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.08, ease: EASE_HYPER_EXPO }}
              >
                See Further.
              </motion.span>
            </span>
            <span className={styles.lineMask}>
              <motion.em
                initial={reduced ? undefined : { y: 24, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.15, ease: EASE_HYPER_EXPO }}
              >
                Guess Less.
              </motion.em>
            </span>
          </h1>

          {/* Marketing-Driven Supporting Copy */}
          <motion.p
            className={styles.description}
            initial={reduced ? undefined : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2, ease: EASE_OUT_EXPO }}
          >
            ZTerminal connects market observation, chart workspaces, Python research, and backtest evidence in one focused environment.
          </motion.p>

          {/* Actions */}
          <motion.div
            className={styles.actions}
            initial={reduced ? undefined : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.25, ease: EASE_OUT_EXPO }}
          >
            <Link href="/download" className={styles.primary}>
              Download for Windows <span className={styles.arrow}>→</span>
            </Link>
            <Link href="/terminal" className={styles.secondary}>
              Open ZTerminal <span className={styles.arrow}>→</span>
            </Link>
          </motion.div>

          {/* Disclaimer */}
          <motion.p
            className={styles.disclaimer}
            initial={reduced ? undefined : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.32, ease: EASE_OUT_EXPO }}
          >
            Available now: web research workspace. Windows installer status is published on the download page.
          </motion.p>
          </motion.div>
        </section>

        {/* Approved 3D Physical Laptop Composition with Real Product UI */}
        <div
          className={styles.computer}
          id="terminal"
          role="img"
          aria-label="ZTerminal quantitative market research workstation showing the real market canvas"
        >
          <motion.div
            className={styles.laptopMotionStage}
            initial={reduced ? undefined : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.16, ease: EASE_OUT_EXPO }}
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
            {/* Scroll depth delta + subtle 1.015 -> 1.0 scale scrub */}
            <motion.div style={!reduced && isDesktop ? { y: laptopScrollY, scale: laptopScale } : undefined}>
              {/* Laptop Screen Lid with Projective Homography */}
              <div className={styles.lid}>
                <motion.div
                  className={styles.terminal}
                  initial={reduced ? undefined : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.7, delay: 0.3, ease: EASE_OUT_EXPO }}
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
