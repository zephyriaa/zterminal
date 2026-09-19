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
//  SECTION 2 — THE REAL USE CASE
// ─────────────────────────────────────────────

function SovereignOrbit() {
  return (
    <div className="relative flex items-center justify-center w-full min-h-[400px]">
      <div className="absolute w-56 h-56 rounded-full border border-purple-500/[0.12] animate-[spin_28s_linear_infinite]" />
      <div className="absolute w-72 h-72 rounded-full border border-purple-500/[0.07] animate-[spin_42s_linear_infinite_reverse]" />
      <div className="absolute w-[340px] h-[340px] rounded-full border border-purple-500/[0.04] animate-[spin_60s_linear_infinite]" />

      <div className="relative z-10 flex flex-col items-center gap-2.5">
        <div className="relative flex items-center justify-center w-[76px] h-[76px] rounded-full border border-purple-500/35 bg-purple-950/70 backdrop-blur-md shadow-[0_0_70px_rgba(124,58,237,0.3)]">
          <span className="absolute inset-0 rounded-full bg-purple-500/15 animate-ping [animation-duration:3.5s]" />
          <Fingerprint size={30} strokeWidth={1.2} className="text-purple-300" />
        </div>
        <b className="text-[11px] font-mono tracking-[0.22em] text-purple-200 uppercase">Your Hardware</b>
        <small className="text-[10px] font-mono text-zinc-500 tracking-widest uppercase">Trusted local execution</small>
      </div>

      {[
        { label: "Proprietary Data", icon: Database, pos: "top-8 left-1/2 -translate-x-1/2" },
        { label: "Python Models",  icon: Braces,   pos: "bottom-14 left-4" },
        { label: "Persistent Secrets",        icon: LockKeyhole, pos: "bottom-14 right-4" },
      ].map(({ label, icon: Icon, pos }) => (
        <div key={label} className={`absolute ${pos} flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900/80 border border-white/[0.08] backdrop-blur-md`}>
          <Icon size={11} className="text-purple-400" />
          <span className="text-[10px] font-mono text-zinc-300">{label}</span>
        </div>
      ))}
    </div>
  );
}

function SectionSovereign() {
  return (
    <section id="overview" className="relative w-full py-28 md:py-36 px-6 md:px-12 overflow-hidden border-t border-white/[0.04]">
      <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-[#090A0F] to-transparent pointer-events-none z-20" />
      <div className="pointer-events-none absolute -top-40 left-0 w-[700px] h-[600px] bg-purple-700/[0.08] blur-[130px] rounded-full" />
      
      <div className="max-w-7xl mx-auto">
        <motion.div variants={stagger(0.08)} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} className="grid grid-cols-1 xl:grid-cols-12 gap-12 xl:gap-16 items-center">
          
          <div className="xl:col-span-5 space-y-8 min-w-0">
            <motion.div variants={fadeInUp}>
              <Badge tone="purple" pulse>THE SOVEREIGN MACHINE</Badge>
            </motion.div>
            <motion.h2 variants={fadeInUp} className="text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tight text-white leading-[1.1]">
              Your edge. <br/>
              <em className="not-italic bg-clip-text text-transparent bg-gradient-to-br from-purple-300 to-white">On your hardware.</em>
            </motion.h2>
            <motion.p variants={fadeInUp} className="text-base md:text-lg text-zinc-400 leading-relaxed font-normal">
              Stop trading in the dark and surrendering your strategies to the cloud. ZTerminal runs locally, ensuring your proprietary datasets, custom Python models, and persistent secrets never leave your physical control.
            </motion.p>
            <motion.p variants={fadeInUp} className="text-sm text-zinc-500 leading-relaxed">
              Retail web tools abstract market reality under sluggish browser frames. ZTerminal brings institutional-grade execution speed to your own local hardware, without the latency of cloud routing.
            </motion.p>
          </div>

          <motion.div variants={fadeInUp} className="xl:col-span-7 min-w-0 w-full">
            <GlassCard elevated className="p-8 min-h-[460px] flex flex-col justify-center overflow-hidden">
               <SovereignOrbit />
            </GlassCard>
          </motion.div>

        </motion.div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────
//  SECTION 3 — THE QUANT LOOP BENTO
// ─────────────────────────────────────────────

function PressureBar({ buyPct = 62 }: { buyPct?: number }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  return (
    <div ref={ref} className="space-y-2.5 w-full">
      <div className="h-2.5 w-full bg-white/[0.04] rounded-full overflow-hidden flex">
        <motion.div
          className="h-full bg-emerald-500/80 rounded-l-full"
          initial={{ width: 0 }}
          animate={inView ? { width: `${buyPct}%` } : {}}
          transition={{ ...spring.smooth, delay: 0.3 }}
        />
        <motion.div
          className="h-full bg-rose-500/80 rounded-r-full"
          initial={{ width: 0 }}
          animate={inView ? { width: `${100 - buyPct}%` } : {}}
          transition={{ ...spring.smooth, delay: 0.3 }}
        />
      </div>
      <div className="flex justify-between text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
        <span className="text-emerald-500">Buy Aggressors {buyPct}%</span>
        <span className="text-rose-500">Sell Aggressors {100 - buyPct}%</span>
      </div>
    </div>
  );
}

function TermOutput() {
  const lines = [
    { text: "$ zt risk-audit --dataset L2_BINANCE_BTCUSDT", color: "text-zinc-300" },
    { text: "✔ Parsed 4,200,000 tick-level events", color: "text-emerald-400" },
    { text: "✔ Backtest executed against hard evidence", color: "text-emerald-400" },
    { text: "✔ SHA-256 state locked. Zero lookahead leakage.", color: "text-purple-400" },
  ];
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });

  return (
    <div ref={ref} className="p-4 rounded-xl bg-black/50 border border-white/[0.05] font-mono text-[11px] space-y-1.5 w-full">
      {lines.map((l, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: -6 }}
          animate={inView ? { opacity: 1, x: 0 } : {}}
          transition={{ ...spring.smooth, delay: 0.15 + i * 0.18 }}
          className={l.color}
        >
          {l.text}
        </motion.div>
      ))}
    </div>
  );
}

function SectionQuantLoop() {
  return (
    <section id="quant-loop" className="relative w-full py-28 md:py-36 px-6 md:px-12 overflow-hidden">
      <div className="max-w-7xl mx-auto">
        <motion.div variants={stagger(0.08)} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }} className="text-center max-w-3xl mx-auto mb-20">
          <motion.div variants={fadeInUp} className="mb-4">
            <Badge tone="cyan" pulse={false}>THE QUANT LOOP</Badge>
          </motion.div>
          <motion.h2 variants={fadeInUp} className="text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tight text-white mb-6 leading-[1.15]">
            From Hypothesis <br/>
            <em className="not-italic bg-clip-text text-transparent bg-gradient-to-br from-cyan-300 to-white">To Evidence.</em>
          </motion.h2>
          <motion.p variants={fadeInUp} className="text-zinc-400 text-base md:text-lg leading-relaxed">
            Eliminate cognitive bias and backtest overfitting. Anchor your decisions strictly to deterministic reality.
          </motion.p>
        </motion.div>

        <motion.div variants={stagger(0.06)} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }} className="grid grid-cols-1 md:grid-cols-12 gap-5">
          
          {/* Tile 1: Institutional Liquidity Mapping */}
          <motion.div variants={fadeInUp} className="md:col-span-8">
            <GlassCard className="h-full p-8 flex flex-col gap-6 min-h-[380px]">
              <div className="space-y-3">
                <Badge tone="cyan" pulse>INSTITUTIONAL LIQUIDITY MAPPING</Badge>
                <h3 className="text-xl md:text-2xl font-semibold text-white tracking-tight leading-snug">
                  See the truth, not the indicator.
                </h3>
                <p className="text-zinc-400 text-sm leading-relaxed max-w-xl">
                  Sub-millisecond Order Book Tape and multi-session Volume Profiles built directly from the wire. Stop relying on lagging retail indicators and start reading structural market absorption.
                </p>
              </div>
              <div className="mt-auto flex flex-col gap-6">
                 <PressureBar buyPct={68} />
                 <div className="flex items-end gap-1.5 h-16">
                   {[30, 45, 60, 85, 100, 75, 55, 40, 25, 40, 65, 80, 50, 30].map((h, i) => (
                     <div key={i} style={{ height: `${h}%` }} className={`flex-1 rounded-t-sm ${i === 4 ? "bg-cyan-400/90 shadow-[0_0_12px_rgba(34,211,238,0.5)]" : "bg-white/[0.12]"}`} />
                   ))}
                 </div>
              </div>
            </GlassCard>
          </motion.div>

          {/* Tile 2: Deterministic Execution */}
          <motion.div variants={fadeInUp} className="md:col-span-4">
            <GlassCard className="h-full p-8 flex flex-col justify-between min-h-[380px]">
              <div className="space-y-3">
                <Badge tone="emerald" pulse>DETERMINISTIC EXECUTION</Badge>
                <h3 className="text-xl font-semibold text-white tracking-tight leading-snug">
                  Zero lookahead leakage.
                </h3>
                <p className="text-zinc-400 text-sm leading-relaxed">
                  Backtest your algorithms against hard tick-level evidence. Every simulation is perfectly reproducible.
                </p>
              </div>
              <TermOutput />
            </GlassCard>
          </motion.div>

          {/* Tile 3: Sovereign Isolation */}
          <motion.div variants={fadeInUp} className="md:col-span-12">
            <GlassCard elevated className="p-8 flex flex-col md:flex-row items-center gap-8 min-h-[160px]">
               <div className="flex-1 space-y-3">
                  <Badge tone="amber" pulse={false}>SOVEREIGN ISOLATION</Badge>
                  <h3 className="text-xl font-semibold text-white tracking-tight leading-snug">
                    Your alpha is yours alone.
                  </h3>
                  <p className="text-zinc-400 text-sm leading-relaxed max-w-2xl">
                    Air-gapped key management and zero telemetry surveillance. No analytics middleware. No remote parameter harvesting. What you discover stays on your drive.
                  </p>
               </div>
               <div className="flex items-center gap-3 px-5 py-3.5 rounded-xl bg-amber-500/[0.05] border border-amber-500/20 font-mono text-xs text-amber-300 tracking-widest shrink-0">
                  <ShieldCheck size={16} />
                  TELEMETRY: OFFLINE
               </div>
            </GlassCard>
          </motion.div>

        </motion.div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────
//  SECTION 4 — INSTITUTIONAL CONVERSION FLOOR
// ─────────────────────────────────────────────

function SectionInstitutional() {
  return (
    <section className="relative py-28 md:py-36 px-6 md:px-10 overflow-hidden">
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[600px] bg-purple-600/[0.06] blur-[130px] rounded-full mix-blend-screen" />
      <div className="pointer-events-none absolute top-0 left-1/4 w-[600px] h-[300px] bg-fuchsia-600/[0.05] blur-[110px] rounded-full" />

      <div className="max-w-4xl mx-auto text-center relative z-10">
        <motion.div variants={fadeInUp} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-60px" }}>
          <GlassCard elevated className="p-10 md:p-16 flex flex-col items-center text-center relative overflow-hidden">
            <div className="pointer-events-none absolute inset-0 opacity-[0.022]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)", backgroundSize: "48px 48px" }} />
            
            <div className="mb-8 relative z-10">
              <Badge tone="purple" pulse>STATUS / PRE-RELEASE VERIFICATION</Badge>
            </div>
            
            <h2 className="text-3xl md:text-5xl lg:text-[3.25rem] font-semibold tracking-tight text-white mb-7 max-w-2xl leading-[1.12] relative z-10">
              Deploy your sovereign <br className="hidden sm:block" />
              <em className="not-italic bg-clip-text text-transparent bg-gradient-to-br from-purple-200 to-white">workstation.</em>
            </h2>
            
            <p className="text-zinc-400 text-base md:text-lg max-w-xl mb-10 leading-relaxed relative z-10">
              Launch the web workspace or download the desktop client for direct market access. ZTerminal does not distribute unverified binaries. Cryptographic signing and release documentation are verified before public distribution.
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-4 mb-10 w-full sm:w-auto relative z-10">
              <Link href="/terminal" className="group w-full sm:w-auto flex items-center justify-center gap-2.5 px-7 py-4 rounded-xl bg-white text-black text-sm font-semibold tracking-tight transition hover:bg-zinc-100 hover:shadow-[0_0_32px_rgba(255,255,255,0.2)]">
                Open Web Terminal
                <ArrowRight size={14} className="transition-transform duration-300 group-hover:translate-x-0.5" />
              </Link>
              <Link href="/download" className="group w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-4 rounded-xl border border-white/[0.12] bg-white/[0.04] text-zinc-200 hover:text-white hover:bg-white/[0.08] text-sm font-medium transition">
                Download Desktop Client
              </Link>
            </div>

            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-black/40 border border-white/[0.06] font-mono text-[11px] text-zinc-400 relative z-10">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse flex-shrink-0" />
              STATUS: PRE-RELEASE // CRYPTOGRAPHIC SIGNING VERIFIED
            </div>
          </GlassCard>
        </motion.div>
        
        <footer className="mt-24 pt-14 border-t border-white/[0.08] flex flex-col md:flex-row justify-between gap-3 text-[11px] font-mono text-zinc-600">
          <span>© 2026 ZTerminal. Infrastructure for Sovereign Traders.</span>
          <span>VERSION: 0.2.1 BETA</span>
        </footer>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────
//  ROOT EXPORT
// ─────────────────────────────────────────────
export default function ZTerminalLandingStandalone() {
  return (
    <div className={`min-h-screen ${THEME.bg} text-zinc-100 font-sans antialiased overflow-x-hidden selection:bg-purple-500/25`}>
      <Nav />
      <main>
        <HeroSection />
        <SectionSovereign />
        <SectionQuantLoop />
        <SectionInstitutional />
      </main>
    </div>
  );
}
