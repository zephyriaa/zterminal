"use client";

import React from "react";
import { motion } from "framer-motion";

export function LiquidGlassStream() {
  return (
    <div className="relative w-full pb-32 pt-24 flex flex-col gap-32 items-center overflow-hidden">
      {/* Background ambient light */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Act One: Microstructure Over Intuition */}
      <GlassCard 
        eyebrow="ACT ONE" 
        title="Microstructure Over Intuition."
        body="Level 2 depth, order flow footprints, and trade aggressor sequence tracking. Strip away market noise to reveal the deterministic mechanics of liquidity and absorption."
      >
        <MockOrderFlow />
      </GlassCard>

      {/* Act Two: The Deterministic Quant Loop */}
      <GlassCard 
        eyebrow="ACT TWO"
        title="The Deterministic Quant Loop."
        body="Vectorized hypothesis testing powered by vectorbt. Event-driven tick execution bridging research into reality. Tear-sheet risk auditing enforcing institutional capital preservation."
      >
        <MockCodeLoop />
      </GlassCard>

      {/* Architecture: Sovereign Execution */}
      <GlassCard 
        eyebrow="ARCHITECTURE"
        title="Local-First Sovereign Execution."
        body="Next.js 16 high-throughput shell backed by a secure Windows Local Helper vault. Complete browser isolation ensuring zero UI-thread freeze during extreme volatility events."
      >
        <MockArchitecture />
      </GlassCard>
    </div>
  );
}

function GlassCard({ eyebrow, title, body, children }: any) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ type: "spring", stiffness: 120, damping: 24, mass: 0.8 }}
      className="relative z-10 w-full max-w-[1040px] mx-auto flex flex-col md:flex-row gap-12 md:gap-16 items-center p-8 md:p-14 rounded-3xl backdrop-blur-2xl bg-zinc-950/60 border border-white/[0.08] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12)] shadow-2xl shadow-black/80 will-change-transform"
    >
      {/* Specular Radial Glow */}
      <div className="absolute inset-0 rounded-3xl pointer-events-none bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.06),transparent_60%)]" />

      <div className="flex-1 flex flex-col gap-5 text-left relative z-10">
        <span className="text-[11px] font-mono tracking-[0.2em] text-emerald-400 font-semibold">{eyebrow}</span>
        <h2 className="text-4xl md:text-5xl lg:text-6xl font-semibold text-white tracking-tight leading-[1.1]">{title}</h2>
        <p className="text-zinc-400 text-sm md:text-base leading-relaxed max-w-md mt-2">{body}</p>
      </div>

      <motion.div 
        whileHover={{ scale: 1.02, rotateY: -2, rotateX: 2 }}
        transition={{ type: "spring", stiffness: 120, damping: 24 }}
        className="flex-1 w-full relative z-10 pointer-events-none"
        style={{ perspective: 1000 }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

function MockOrderFlow() {
  return (
    <div className="w-full h-72 bg-zinc-900/50 border border-white/10 rounded-2xl overflow-hidden flex flex-col relative shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]">
      <div className="absolute inset-0 bg-[url('/noise.png')] opacity-[0.03] mix-blend-overlay" />
      <div className="h-10 border-b border-white/5 flex items-center px-5 bg-black/20">
        <span className="text-[10px] font-mono text-zinc-500 tracking-wider">GATE.IO // BTC-USDT // FOOTPRINT</span>
      </div>
      <div className="flex-1 flex px-6 items-center justify-center">
        <div className="flex gap-2 h-[60%] items-end w-full justify-between">
          {[40, 60, 30, 80, 50, 90, 45, 70, 35, 65, 85, 55].map((h, i) => (
            <div key={i} className="w-full max-w-[1.5rem] bg-emerald-500/10 border border-emerald-500/30 rounded-t flex flex-col justify-end" style={{ height: `${h}%` }}>
              <div className="w-full bg-emerald-400/60 rounded-t-[2px]" style={{ height: `${h * 0.3}%` }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MockCodeLoop() {
  return (
    <div className="w-full h-72 bg-[#08090a] border border-white/10 rounded-2xl overflow-hidden flex flex-col relative font-mono text-[11px] leading-[1.8] text-zinc-400 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]">
      <div className="h-10 border-b border-white/5 flex items-center px-5 bg-black/40">
        <span className="text-zinc-500 tracking-wider">quant_loop.py</span>
      </div>
      <div className="p-6 flex flex-col gap-1 text-emerald-400/80">
        <p><span className="text-purple-400">import</span> vectorbt <span className="text-purple-400">as</span> vbt</p>
        <p><span className="text-purple-400">import</span> polars <span className="text-purple-400">as</span> pl</p>
        <br/>
        <p><span className="text-purple-400">def</span> <span className="text-blue-400">evaluate_edge</span>(ticks: pl.DataFrame):</p>
        <p className="pl-6">flow = vbt.OrderFlow(ticks)</p>
        <p className="pl-6">imbalance = flow.calc_imbalance()</p>
        <p className="pl-6">volatility = flow.atr(window=<span className="text-orange-400">14</span>)</p>
        <p className="pl-6"><span className="text-purple-400">return</span> imbalance &gt; <span className="text-orange-400">0.65</span></p>
      </div>
    </div>
  );
}

function MockArchitecture() {
  return (
    <div className="w-full h-72 bg-zinc-900/40 border border-white/10 rounded-2xl flex items-center justify-center p-6 relative overflow-hidden shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(56,189,248,0.08),transparent_70%)]" />
      <div className="flex items-center gap-6 relative z-10">
        <div className="w-28 h-28 rounded-2xl bg-zinc-950 border border-white/10 flex flex-col items-center justify-center shadow-2xl shadow-cyan-500/10 gap-2">
          <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center border border-cyan-500/30">
            <div className="w-3 h-3 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.8)]" />
          </div>
          <span className="text-[10px] font-mono text-cyan-400 tracking-wider">NEXT.JS 16</span>
        </div>
        
        <div className="flex flex-col gap-1 items-center">
          <div className="h-px w-16 bg-gradient-to-r from-cyan-500/50 to-emerald-500/50 relative">
            <motion.div 
              animate={{ x: [0, 64] }}
              transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
              className="absolute top-1/2 -translate-y-1/2 left-0 w-2 h-2 bg-white rounded-full shadow-[0_0_8px_white]"
            />
          </div>
          <span className="text-[8px] font-mono text-zinc-500">WSS API</span>
        </div>

        <div className="w-28 h-28 rounded-2xl bg-zinc-950 border border-emerald-500/30 flex flex-col items-center justify-center shadow-2xl shadow-emerald-500/10 gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center border border-emerald-500/40">
             <div className="w-3 h-3 bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]" />
          </div>
          <span className="text-[10px] font-mono text-emerald-400 text-center tracking-wider">LOCAL<br/>HELPER</span>
        </div>
      </div>
    </div>
  );
}
