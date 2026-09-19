"use client";

import React, { useRef, useEffect, useState } from "react";
import Link from "next/link";
import {
  motion,
  useMotionValue,
  useSpring,
  useMotionTemplate,
  useInView,
  animate,
} from "framer-motion";
import {
  ArrowRight,
  Database,
  Braces,
  LockKeyhole,
  ShieldCheck,
  Fingerprint,
  Terminal,
  Cpu,
  BarChart3,
  Activity,
  BookOpen,
  Network
} from "lucide-react";
import { MicrostructureLens } from "./sections/MicrostructureLens";
import { SovereignPipeline } from "./sections/SovereignPipeline";
import { QuantBentoMatrix } from "./sections/QuantBentoMatrix";
import { InstitutionalCta } from "./sections/InstitutionalCta";

// ─────────────────────────────────────────────
//  LIQUID GLASS & MOTION TOKENS
// ─────────────────────────────────────────────
const THEME = {
  bg: "bg-[#090A0F]",
  liquidGlass: "bg-zinc-950/60 backdrop-blur-2xl border border-white/[0.08] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12),0_25px_50px_-12px_rgba(0,0,0,0.8)]",
  liquidGlassElevated: "bg-zinc-900/40 backdrop-blur-3xl border border-white/[0.12] shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.2),0_32px_64px_-20px_rgba(0,0,0,0.85)]",
};

const spring = {
  smooth: { type: "spring", stiffness: 120, damping: 24, mass: 0.8 } as const,
  snappy: { type: "spring", stiffness: 240, damping: 28, mass: 0.6 } as const,
  gentle: { type: "spring", stiffness: 80, damping: 20, mass: 1.0 } as const,
};

const fadeInUp = {
  hidden: { opacity: 0, y: 30, scale: 0.98 },
  visible: { opacity: 1, y: 0, scale: 1, transition: spring.smooth },
};

const stagger = (delay = 0.08) => ({
  hidden: {},
  visible: { transition: { staggerChildren: delay, delayChildren: 0.1 } },
});

// ─────────────────────────────────────────────
//  UI PRIMITIVES (Liquid Glass)
// ─────────────────────────────────────────────

function GlassCard({
  children,
  className = "",
  elevated = false,
  style,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & {
  elevated?: boolean;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const rawX = useMotionValue(200);
  const rawY = useMotionValue(200);
  const springX = useSpring(rawX, spring.snappy);
  const springY = useSpring(rawY, spring.snappy);
  const specular = useMotionTemplate`radial-gradient(500px circle at ${springX}px ${springY}px, rgba(255,255,255,0.15), transparent 75%)`;

  const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    rawX.set(e.clientX - r.left);
    rawY.set(e.clientY - r.top);
  };

  const base = elevated ? THEME.liquidGlassElevated : THEME.liquidGlass;

  return (
    <div
      ref={ref}
      onMouseMove={onMouseMove}
      className={`group relative rounded-2xl overflow-hidden transition-shadow duration-500 will-change-transform ${base} ${className}`}
      style={style}
      {...rest}
    >
      <motion.div
        className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-10"
        style={{ background: specular }}
      />
      <div 
        className="pointer-events-none absolute inset-0 opacity-[0.015] mix-blend-overlay z-0" 
        style={{ backgroundImage: "url('data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E')" }} 
      />
      <div className="relative z-10 h-full w-full">{children}</div>
    </div>
  );
}

function Badge({
  children,
  tone = "purple",
  pulse = true,
  className = "",
}: {
  children: React.ReactNode;
  tone?: "purple" | "cyan" | "emerald" | "amber" | "zinc" | "white";
  pulse?: boolean;
  className?: string;
}) {
  const tones: Record<string, string> = {
    purple: "border-purple-500/30 bg-purple-500/[0.08] text-purple-300",
    cyan: "border-cyan-500/30 bg-cyan-500/[0.08] text-cyan-300",
    emerald: "border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-300",
    amber: "border-amber-500/30 bg-amber-500/[0.08] text-amber-300",
    zinc: "border-white/[0.1] bg-white/[0.04] text-zinc-400",
    white: "border-white/25 bg-white/[0.08] text-white",
  };
  const dots: Record<string, string> = {
    purple: "bg-purple-400",
    cyan: "bg-cyan-400",
    emerald: "bg-emerald-400",
    amber: "bg-amber-400",
    zinc: "bg-zinc-400",
    white: "bg-white",
  };

  return (
    <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-[10px] font-mono uppercase tracking-[0.2em] backdrop-blur-md ${tones[tone]} ${className}`}>
      {pulse && (
        <span className="relative flex h-[6px] w-[6px] flex-shrink-0">
          <span className={`animate-ping absolute inset-0 rounded-full opacity-80 ${dots[tone]}`} />
          <span className={`relative rounded-full h-full w-full ${dots[tone]}`} />
        </span>
      )}
      {children}
    </span>
  );
}

// ─────────────────────────────────────────────
//  SECTION 1 — HERO (Absolute Preservation)
// ─────────────────────────────────────────────

function Nav() {
  return (
    <header className="absolute top-0 inset-x-0 z-50">
      <div className="max-w-7xl mx-auto flex items-center justify-between px-6 md:px-10 py-5">
        <Link href="/" className="flex items-center gap-2">
          <span className="font-bold tracking-[0.16em] text-sm text-white uppercase">ZTerminal</span>
          <span className="text-[9px] font-mono bg-purple-500/20 text-purple-300 border border-purple-500/20 px-1.5 py-0.5 rounded tracking-widest">BETA</span>
        </Link>
        <nav className="hidden md:flex items-center gap-7">
          <Link href="#overview" className="text-sm text-zinc-400 hover:text-white transition-colors font-medium tracking-tight">Overview</Link>
          <Link href="#quant-loop" className="text-sm text-zinc-400 hover:text-white transition-colors font-medium tracking-tight">Research loop</Link>
          <Link href="/download" className="text-sm text-zinc-400 hover:text-white transition-colors font-medium tracking-tight">Windows</Link>
          <Link href="/docs" className="text-sm text-zinc-400 hover:text-white transition-colors font-medium tracking-tight">Docs</Link>
          <Link href="/terminal" className="px-4 py-2 rounded-full border border-white/[0.12] bg-white/[0.04] text-sm text-white hover:bg-white/[0.08] transition-colors shadow-sm">Web terminal</Link>
        </nav>
      </div>
    </header>
  );
}

function HeroTerminal() {
  const bars = [38, 22, 55, 80, 48, 72, 95, 60, 40, 68, 100, 78, 52, 35, 65, 88, 44, 30, 75, 90];
  const vpocIdx = 10;
  return (
    <div className="relative w-full" style={{ transform: "perspective(1100px) rotateY(-10deg) rotateX(4deg) scale(1.04)", transformStyle: "preserve-3d" }}>
      <div className="rounded-2xl overflow-hidden border border-white/[0.10] bg-[#0c0d14] shadow-[0_60px_120px_-30px_rgba(0,0,0,0.9),0_0_0_1px_rgba(255,255,255,0.05)]">
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-white/[0.06] bg-[#12131c]">
          <div className="flex gap-1.5">
            <span className="w-3 h-3 rounded-full bg-zinc-700" />
            <span className="w-3 h-3 rounded-full bg-zinc-700" />
            <span className="w-3 h-3 rounded-full bg-zinc-700" />
          </div>
          <div className="mx-auto px-4 py-1 rounded-md bg-black/40 border border-white/[0.04] text-[11px] font-mono text-zinc-400 tracking-wide">ZT · BTC-USDT · 5M · GATE.IO</div>
        </div>
        <div className="grid grid-cols-[56px_1fr] h-[420px]">
          <div className="border-r border-white/[0.04] bg-[#0e0f18] p-3 flex flex-col gap-2">
            {[BarChart3, Activity, BookOpen, Braces, Database].map((Icon, i) => (
              <div key={i} className={`w-8 h-8 rounded-lg flex items-center justify-center ${i === 0 ? "bg-purple-500/20 text-purple-300" : "text-zinc-600 hover:text-zinc-400"}`}><Icon size={15} /></div>
            ))}
          </div>
          <div className="flex flex-col gap-0 bg-[#0a0b10]">
            <div className="flex-1 relative overflow-hidden" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.018) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.018) 1px, transparent 1px)", backgroundSize: "36px 36px" }}>
              <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 220" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="priceLine" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#7c3aed" /><stop offset="100%" stopColor="#d946ef" /></linearGradient>
                  <linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#9333ea" stopOpacity="0.25" /><stop offset="100%" stopColor="#9333ea" stopOpacity="0" /></linearGradient>
                </defs>
                <path d="M0,160 C40,140 60,110 100,90 S160,55 200,45 S280,22 340,18 L400,12 L400,220 L0,220 Z" fill="url(#priceFill)" />
                <path d="M0,160 C40,140 60,110 100,90 S160,55 200,45 S280,22 340,18 L400,12" fill="none" stroke="url(#priceLine)" strokeWidth="2" strokeLinecap="round" />
                {[0,1,2,3,4,5,6,7,8].map((i) => {
                  const x = 40 + i * 42;
                  const baseY = 160 - i * 16;
                  const green = i % 3 !== 1;
                  const h = 18 + (i % 4) * 6;
                  return (
                    <g key={i}>
                      <line x1={x} y1={baseY - h * 1.3} x2={x} y2={baseY + h * 0.5} stroke={green ? "#34d399" : "#f87171"} strokeWidth="1.2" />
                      <rect x={x - 5} y={baseY - h} width={10} height={h} fill={green ? "#34d399" : "#f87171"} rx="1" />
                    </g>
                  );
                })}
              </svg>
              <div className="absolute top-3 right-3 bg-purple-500/20 border border-purple-500/30 text-purple-200 text-[11px] font-mono px-2.5 py-1 rounded-lg backdrop-blur-md">67,284.50 ↑</div>
            </div>
            <div className="h-20 border-t border-white/[0.04] px-3 flex items-end gap-1 py-2">
              {bars.map((h, i) => (
                <div key={i} className={`flex-1 rounded-t-sm ${i === vpocIdx ? "bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.6)]" : "bg-white/10"}`} style={{ height: `${h}%` }} />
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[130%] h-[130%] bg-purple-600/25 blur-[90px] rounded-full -z-10 mix-blend-screen pointer-events-none" />
    </div>
  );
}

function HeroSection() {
  return (
    <section className="relative pt-28 pb-16 px-6 md:px-10 min-h-screen flex items-center overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute top-1/4 left-0 w-[600px] h-[600px] bg-purple-700/[0.12] blur-[140px] rounded-full" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-fuchsia-700/[0.07] blur-[120px] rounded-full" />
      </div>
      <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
        <motion.div variants={stagger(0.1)} initial="hidden" animate="visible" className="space-y-7 text-center lg:text-left">
          <motion.div variants={fadeInUp}>
            <span className="text-[11px] font-mono uppercase tracking-[0.22em] text-purple-400">MARKET RESEARCH WORKSPACE · BETA</span>
          </motion.div>
          <motion.h1 variants={fadeInUp} className="text-5xl md:text-6xl xl:text-7xl font-bold tracking-tight leading-[1.06]">
            <span className="text-white">See Further.</span><br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-violet-400 to-fuchsia-500">Guess Less.</span>
          </motion.h1>
          <motion.p variants={fadeInUp} className="text-zinc-400 text-base md:text-lg leading-relaxed max-w-xl mx-auto lg:mx-0">
            Charts, market context, Python research, and backtests—together, so every idea can be checked against evidence.
          </motion.p>
          <motion.div variants={fadeInUp} className="flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start">
            <Link href="/terminal" className="group w-full sm:w-auto flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-xl bg-[#7C3AED] hover:bg-[#6d28d9] text-white text-sm font-semibold tracking-tight transition-colors shadow-[0_0_32px_rgba(124,58,237,0.35)]">
              Open in browser
              <ArrowRight size={15} className="transition-transform duration-300 group-hover:translate-x-0.5" />
            </Link>
            <Link href="/download" className="group w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3.5 text-zinc-400 hover:text-white text-sm font-medium transition-colors">
              Windows availability
              <ArrowRight size={14} className="opacity-50 group-hover:opacity-100 transition-all duration-300 group-hover:translate-x-0.5" />
            </Link>
          </motion.div>
        </motion.div>
        <motion.div initial={{ opacity: 0, x: 40, rotateY: -8 }} animate={{ opacity: 1, x: 0, rotateY: 0 }} transition={{ ...spring.gentle, delay: 0.35 }} className="w-full">
          <HeroTerminal />
        </motion.div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────
//  ROOT EXPORT (Page 1 Locked + Modular Sections)
// ─────────────────────────────────────────────
export default function ZTerminalLandingStandalone() {
  return (
    <div className={`min-h-screen ${THEME.bg} text-zinc-100 font-sans antialiased overflow-x-hidden selection:bg-purple-500/25`}>
      {/* INVARIANT 1: PAGE 1 (HERO FOLD) - 100% UNTOUCHED & PIXEL-LOCKED */}
      <Nav />
      <main>
        <HeroSection />

        {/* SECTION 2: THE REVELATION — "STOP TRADING IN THE DARK" */}
        <MicrostructureLens />

        {/* SECTION 3: THE SOVEREIGN PIPELINE — "A CLEAR BOUNDARY FOR LOCAL WORK" */}
        <SovereignPipeline />

        {/* SECTION 4: THE QUANT LOOP — "FROM HYPOTHESIS TO ALPHA" */}
        <QuantBentoMatrix />

        {/* SECTION 5: INSTITUTIONAL CONVERSION FLOOR & LIQUID FOOTER */}
        <InstitutionalCta />
      </main>
    </div>
  );
}

