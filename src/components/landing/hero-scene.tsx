"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import styles from "./hero-scene.module.css";

const KEY_ROWS = [
  "esc 1 2 3 4 5 6 7 8 9 0 − = delete",
  "tab Q W E R T Y U I O P [ ] \\",
  "caps A S D F G H J K L ; ’ enter",
  "shift Z X C V B N M , . / shift",
  "fn ctrl opt cmd space cmd opt ◀ ▲ ▶",
];

export function HeroScene() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [scale, setScale] = useState<number>(1);
  const [heroHeight, setHeroHeight] = useState<number | null>(null);
  const [isDesktop, setIsDesktop] = useState<boolean>(true);

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

  // Render the exact particle horizon from index.html
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

  return (
    <div
      className={styles.viewport}
      style={heroHeight ? { height: `${heroHeight}px` } : undefined}
    >
      <div
        className={styles.scene}
        id="overview"
        style={isDesktop ? { transform: `scale(${scale})` } : undefined}
      >
        <div className={styles.glow} aria-hidden="true" />
        <canvas
          ref={canvasRef}
          className={styles.waves}
          width={1672}
          height={941}
          aria-hidden="true"
        />

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

        <section className={styles.heroCopy} id="workflow" aria-labelledby="hero-title">
          <p className={styles.eyebrow}>QUANTITATIVE MARKET RESEARCH</p>
          <h1 id="hero-title">
            <span className={styles.first}>See more.</span>
            <em>Guess less.</em>
          </h1>
          <p className={styles.description}>
            ZTerminal is a client-first quantitative market research workstation—engineered for
            evidence over intuition, robustness over optimization, and better-prepared decisions.
          </p>
          <div className={styles.actions}>
            <Link href="/download" className={styles.primary}>
              Explore for Windows <span className={styles.arrow}>↗</span>
            </Link>
            <Link href="/terminal" className={styles.secondary}>
              Launch web terminal <span className={styles.arrow}>↗</span>
            </Link>
          </div>
          <p className={styles.disclaimer}>
            Decision support for traders. No broker route. You retain control of execution.
          </p>
        </section>

        <div
          className={styles.computer}
          id="terminal"
          role="img"
          aria-label="Angled ZTerminal workstation showing the real market canvas"
        >
          <div className={styles.lid}>
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
              <div className={styles.screenGlare} aria-hidden="true" />
            </div>
          </div>

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
        </div>
      </div>
    </div>
  );
}
