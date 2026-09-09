"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, useScroll, useTransform, useSpring } from "framer-motion";
import { useIsReducedMotion, EASE_OUT_EXPO } from "./motion-primitives";
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
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [scale, setScale] = useState<number>(1);
  const [heroHeight, setHeroHeight] = useState<number | null>(null);
  const [isDesktop, setIsDesktop] = useState<boolean>(true);
  const reduced = useIsReducedMotion();

  // Resize handling
  useEffect(() => {
    function onResize() {
      const width = window.innerWidth;
      const height = window.innerHeight;
      if (width > 800) {
        setIsDesktop(true);
        const scaleX = width / 1672;
        const scaleY = height / 941;
        const s = Math.min(scaleX, Math.max(0.68, scaleY));
        setScale(s);
        setHeroHeight(height);
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

  // Canvas particle horizon
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, 1672, 941);

    let seed = 731;
    function rand() {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    }

    for (let band = 0; band < 2; band++) {
      for (let row = 0; row < 47; row++) {
        for (let col = 0; col < 218; col++) {
          const x = col * 8 + (rand() - 0.5) * 5;
          const ridge =
            band === 0
              ? 794 + x * 0.26 + 20 * Math.sin(x / 220)
              : 878 - 235 * Math.exp(-Math.pow((x - 1150) / 480, 2));
          const y = ridge + row * (2.1 + row * 0.047) + (rand() - 0.5) * 5;
          const alpha =
            (0.16 + rand() * 0.62) * Math.exp(-row / 19) * (band === 0 ? 1 : 0.35);
          const r = (0.25 + rand() * 0.95) * (row < 7 ? 1.2 : 0.7);
          ctx.fillStyle = `rgba(${75 + Math.floor(rand() * 45)},${48 + Math.floor(rand() * 35)},${155 + Math.floor(rand() * 90)},${alpha})`;
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }, []);

  // Mouse perspective physics (fine pointer desktop only)
  const mouseRawX = useSpring(0, { stiffness: 70, damping: 22 });
  const mouseRawY = useSpring(0, { stiffness: 70, damping: 22 });

  useEffect(() => {
    if (!isDesktop || reduced) return;
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    if (!mq.matches) return;

    function handleMouseMove(e: MouseEvent) {
      const nx = e.clientX / window.innerWidth - 0.5;
      const ny = e.clientY / window.innerHeight - 0.5;
      mouseRawX.set(nx);
      mouseRawY.set(ny);
    }

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [isDesktop, reduced, mouseRawX, mouseRawY]);

  // Terminal perspective & parallax transforms
  const rotateX = useTransform(mouseRawY, [-0.5, 0.5], [1.6, -1.6]);
  const rotateY = useTransform(mouseRawX, [-0.5, 0.5], [-2.2, 2.2]);
  const compShiftX = useTransform(mouseRawX, [-0.5, 0.5], [-6, 6]);
  const compShiftY = useTransform(mouseRawY, [-0.5, 0.5], [-4, 4]);

  // Internal layer parallax
  const lidParallaxX = useTransform(mouseRawX, [-0.5, 0.5], [-5, 5]);
  const lidParallaxY = useTransform(mouseRawY, [-0.5, 0.5], [-4, 4]);
  const baseParallaxX = useTransform(mouseRawX, [-0.5, 0.5], [3, -3]);
  const baseParallaxY = useTransform(mouseRawY, [-0.5, 0.5], [2, -2]);
  const glareOpacity = useTransform(mouseRawX, [-0.5, 0.5], [0.11, 0.22]);

  // Scroll-driven hero transition
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"],
  });

  const heroCopyOpacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);
  const heroCopyY = useTransform(scrollYProgress, [0, 0.5], [0, -45]);
  const terminalScrollScale = useTransform(scrollYProgress, [0, 0.65], [1, 1.04]);
  const terminalScrollY = useTransform(scrollYProgress, [0, 0.65], [0, -35]);
  const wavesOpacity = useTransform(scrollYProgress, [0, 0.55], [1, 0.35]);

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
        <motion.canvas
          ref={canvasRef}
          className={styles.waves}
          width={1672}
          height={941}
          aria-hidden="true"
          style={!reduced ? { opacity: wavesOpacity } : undefined}
        />

        {/* 1. HEADER ENTRANCE */}
        <motion.header
          className={styles.header}
          initial={reduced ? false : { y: -12, opacity: 0 }}
          animate={reduced ? false : { y: 0, opacity: 1 }}
          transition={{ duration: 0.7, ease: EASE_OUT_EXPO, delay: 0.05 }}
        >
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
        </motion.header>

        {/* 2-5. HERO COPY ENTRANCE & SCROLL PARALLAX */}
        <motion.section
          className={styles.heroCopy}
          id="workflow"
          aria-labelledby="hero-title"
          style={!reduced ? { opacity: heroCopyOpacity, y: heroCopyY } : undefined}
        >
          {/* Eyebrow */}
          <motion.p
            className={styles.eyebrow}
            initial={reduced ? false : { y: 14, opacity: 0 }}
            animate={reduced ? false : { y: 0, opacity: 1 }}
            transition={{ duration: 0.75, ease: EASE_OUT_EXPO, delay: 0.18 }}
          >
            QUANTITATIVE MARKET RESEARCH
          </motion.p>

          {/* Masked Headline Lines */}
          <h1 id="hero-title">
            <span className={styles.headlineMask}>
              <motion.span
                className={styles.first}
                initial={reduced ? false : { y: "115%", opacity: 0 }}
                animate={reduced ? false : { y: "0%", opacity: 1 }}
                transition={{ duration: 0.9, ease: EASE_OUT_EXPO, delay: 0.3 }}
              >
                See more.
              </motion.span>
            </span>
            <span className={styles.headlineMask}>
              <motion.em
                initial={reduced ? false : { y: "115%", opacity: 0 }}
                animate={reduced ? false : { y: "0%", opacity: 1 }}
                transition={{ duration: 0.9, ease: EASE_OUT_EXPO, delay: 0.44 }}
              >
                Guess less.
              </motion.em>
            </span>
          </h1>

          {/* Description */}
          <motion.p
            className={styles.description}
            initial={reduced ? false : { y: 20, opacity: 0 }}
            animate={reduced ? false : { y: 0, opacity: 1 }}
            transition={{ duration: 0.8, ease: EASE_OUT_EXPO, delay: 0.58 }}
          >
            ZTerminal is a client-first quantitative market research workstation, engineered for
            evidence over intuition, robustness over optimization, and better-prepared decisions.
          </motion.p>

          {/* Actions */}
          <motion.div
            className={styles.actions}
            initial={reduced ? false : { y: 16, opacity: 0 }}
            animate={reduced ? false : { y: 0, opacity: 1 }}
            transition={{ duration: 0.75, ease: EASE_OUT_EXPO, delay: 0.72 }}
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
            initial={reduced ? false : { opacity: 0 }}
            animate={reduced ? false : { opacity: 1 }}
            transition={{ duration: 0.7, ease: EASE_OUT_EXPO, delay: 0.82 }}
          >
            Decision support for traders. No broker route. You retain control of execution.
          </motion.p>
        </motion.section>

        {/* 6. CENTERPIECE COMPUTER / TERMINAL VISUAL */}
        <motion.div
          className={styles.computer}
          id="terminal"
          role="img"
          aria-label="Angled ZTerminal workstation showing the real market canvas"
          initial={reduced ? false : { scale: 0.94, y: 32, opacity: 0 }}
          animate={reduced ? false : { scale: 1, y: 0, opacity: 1 }}
          transition={{ duration: 1.05, ease: EASE_OUT_EXPO, delay: 0.88 }}
          style={
            !reduced && isDesktop
              ? {
                  rotateX,
                  rotateY,
                  x: compShiftX,
                  y: compShiftY,
                  scale: terminalScrollScale,
                }
              : undefined
          }
        >
          {/* Calm breathing micro-float layer */}
          <motion.div
            style={{ width: "100%", height: "100%" }}
            {...(!reduced && isDesktop
              ? {
                  animate: { y: [-2.5, 2.5, -2.5] },
                  transition: {
                    duration: 7,
                    repeat: Infinity,
                    ease: "easeInOut",
                  },
                }
              : {})}
          >
            <div className={styles.glow} aria-hidden="true" />

            {/* Laptop Screen Lid with Parallax */}
            <motion.div
              className={styles.lid}
              style={
                !reduced && isDesktop
                  ? {
                      x: lidParallaxX,
                      y: lidParallaxY,
                    }
                  : undefined
              }
            >
              <div className={styles.terminal}>
                <Image
                  src="/landing/terminal-screenshot.png"
                  alt="Current ZTerminal research workspace with real candlestick chart and indicators"
                  width={3200}
                  height={1800}
                  priority
                  className={styles.screenImage}
                  sizes="(max-width: 800px) 100vw, 1000px"
                />
                <motion.div
                  className={styles.screenGlare}
                  aria-hidden="true"
                  style={!reduced && isDesktop ? { opacity: glareOpacity } : undefined}
                />
              </div>
            </motion.div>

            {/* Laptop Base with Parallax */}
            <motion.svg
              className={styles.base}
              viewBox="0 0 1672 941"
              aria-hidden="true"
              style={
                !reduced && isDesktop
                  ? {
                      x: baseParallaxX,
                      y: baseParallaxY,
                    }
                  : undefined
              }
            >
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
            </motion.svg>

            {/* Keyboard */}
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

            <div className={styles.trackpad} aria-hidden="true" />
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
