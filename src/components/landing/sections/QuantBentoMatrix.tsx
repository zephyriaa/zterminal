'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Terminal,
  Activity,
  BarChart3,
  ShieldCheck,
  Lock,
  ExternalLink,
  Layers,
  Sparkles,
  TrendingUp,
  Cpu,
  Monitor,
  Maximize2,
  Check,
} from 'lucide-react';
import { fadeInUp, staggerContainer, springPhysics } from '../motion/springConfig';
import { LiquidGlassCard } from '../ui/LiquidGlassCard';
import { TelemetryBadge } from '../ui/TelemetryBadge';
import { MetricCounter } from '../ui/MetricCounter';

export function QuantBentoMatrix() {
  // Tile 1: Terminal simulation state
  const [terminalStep, setTerminalStep] = useState(3);
  const [buyPressure, setBuyPressure] = useState(68);

  useEffect(() => {
    const interval = setInterval(() => {
      setBuyPressure((prev) => {
        const delta = Math.floor(Math.random() * 7) - 3;
        return Math.min(Math.max(prev + delta, 52), 82);
      });
    }, 2800);
    return () => clearInterval(interval);
  }, []);

  return (
    <section
      className="relative w-full py-28 md:py-36 px-6 md:px-12 bg-[#07080C] overflow-hidden border-t border-white/[0.04]"
      id="quant-loop"
      aria-label="The Quant Loop Bento Matrix"
    >
      {/* Ambient Caustics */}
      <div
        className="pointer-events-none absolute top-10 right-1/4 w-[700px] h-[500px] rounded-full [background:radial-gradient(ellipse_at_center,rgba(168,85,247,0.05)_0%,transparent_70%)]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute bottom-10 left-10 w-[600px] h-[450px] rounded-full [background:radial-gradient(ellipse_at_center,rgba(6,182,212,0.04)_0%,transparent_70%)]"
        aria-hidden="true"
      />

      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <motion.div
          variants={staggerContainer(0.08)}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          className="text-center max-w-3xl mx-auto mb-20 space-y-5"
        >
          <motion.div variants={fadeInUp}>
            <TelemetryBadge tone="purple" pulse>
              THE QUANT LOOP · DISCIPLINED RESEARCH MATRIX
            </TelemetryBadge>
          </motion.div>

          <motion.h2
            variants={fadeInUp}
            className="text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tight text-white leading-[1.12]"
          >
            From hypothesis <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-fuchsia-300 to-cyan-300">
              to alpha.
            </span>
          </motion.h2>

          <motion.p
            variants={fadeInUp}
            className="text-zinc-400 text-base md:text-lg leading-relaxed max-w-2xl mx-auto"
          >
            Replace guesswork with quantitative verification. Explore tick-level market structures, formulate statistical strategies, and backtest across years of data with zero lookahead bias.
          </motion.p>
        </motion.div>

        {/* 12-Column Bento Matrix */}
        <motion.div
          variants={staggerContainer(0.06)}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
          className="grid grid-cols-1 lg:grid-cols-12 gap-6"
        >
          {/* ───────────────────────────────────────────────────────── */}
          {/* TILE 1 (Span 8 Cols): Deterministic Execution Engine      */}
          {/* ───────────────────────────────────────────────────────── */}
          <motion.div variants={fadeInUp} className="lg:col-span-8">
            <LiquidGlassCard elevated className="p-7 sm:p-8 flex flex-col justify-between h-full min-h-[440px]">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <TelemetryBadge tone="purple" pulse>
                    DETERMINISTIC EXECUTION ENGINE
                  </TelemetryBadge>
                  <span className="text-[10px] font-mono text-zinc-500 bg-white/[0.04] px-2.5 py-1 rounded-md border border-white/[0.06]">
                    PARQUET · 4.2M TICK EVENTS
                  </span>
                </div>

                <h3 className="text-2xl sm:text-3xl font-semibold text-white tracking-tight leading-snug">
                  Automated backtests springing into positive expectancy.
                </h3>
                <p className="text-zinc-400 text-sm mt-2 max-w-2xl leading-relaxed">
                  Vectorized execution running against sequence-verified tick databases. Every trade decision is deterministically logged with cryptographically sealed seeds to prevent curve-fitting and lookahead contamination.
                </p>

                {/* Animated Interactive Terminal Pane */}
                <div className="mt-6 rounded-xl bg-[#090A10] border border-white/[0.08] p-4 font-mono text-xs overflow-hidden shadow-inner">
                  <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/[0.06] text-[11px] text-zinc-500">
                    <div className="flex items-center gap-2">
                      <Terminal size={13} className="text-purple-400" />
                      <span className="text-zinc-300 font-semibold">zt backtest-runner</span>
                      <span className="text-zinc-600">--dataset L2_BINANCE_BTCUSDT</span>
                    </div>
                    <span className="text-emerald-400 text-[10px] bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-500/20">
                      STATUS: RUNNING
                    </span>
                  </div>

                  <div className="space-y-1.5 leading-relaxed">
                    <div className="text-zinc-400">
                      <span className="text-purple-400 font-bold">[14:02:18.002]</span> Initializing Polars memory-mapped parquet buffer (4,200,000 ticks)...
                    </div>
                    <div className="text-zinc-400">
                      <span className="text-purple-400 font-bold">[14:02:18.140]</span> Running 64-thread parameter grid search (AbsorptionThreshold: 80–220 BTC)...
                    </div>
                    <div className="text-emerald-400 flex items-center gap-1.5">
                      <Check size={12} className="text-emerald-400 shrink-0" />
                      <span>Zero lookahead leakage detected across 84,200 simulated order events.</span>
                    </div>
                    <div className="text-cyan-300 font-semibold pt-1">
                      <span className="text-zinc-500">[OPTIMAL FIT]</span> Sharpe: 2.84 | Sortino: 3.41 | Max DD: -6.2% | Win Rate: 68.4%
                    </div>
                  </div>
                </div>
              </div>

              {/* Performance Telemetry Strip */}
              <div className="mt-6 pt-5 border-t border-white/[0.06] grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                  <MetricCounter value={2.84} decimals={2} label="Sharpe Ratio" className="text-lg sm:text-xl font-bold text-purple-300" />
                </div>
                <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                  <MetricCounter value={3.41} decimals={2} label="Sortino Ratio" className="text-lg sm:text-xl font-bold text-cyan-300" />
                </div>
                <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                  <div className="flex flex-col">
                    <span className="font-mono text-rose-400 font-bold text-lg sm:text-xl">-6.2%</span>
                    <span className="text-xs text-zinc-500 uppercase font-mono mt-1 tracking-wider">Max Drawdown</span>
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                  <MetricCounter value={68.4} decimals={1} suffix="%" label="Win Rate" className="text-lg sm:text-xl font-bold text-emerald-300" />
                </div>
              </div>
            </LiquidGlassCard>
          </motion.div>

          {/* ───────────────────────────────────────────────────────── */}
          {/* TILE 2 (Span 4 Cols): Institutional Liquidity Profiles    */}
          {/* ───────────────────────────────────────────────────────── */}
          <motion.div variants={fadeInUp} className="lg:col-span-4">
            <LiquidGlassCard className="p-7 sm:p-8 flex flex-col justify-between h-full min-h-[440px]">
              <div>
                <TelemetryBadge tone="cyan" pulse={false} className="mb-4">
                  SESSION VOLUME PROFILES
                </TelemetryBadge>

                <h3 className="text-xl sm:text-2xl font-semibold text-white tracking-tight leading-snug">
                  Point of Control & Value Areas
                </h3>
                <p className="text-zinc-400 text-sm mt-2 leading-relaxed">
                  Visualize where auction value formed. Track POC migrations, High Volume Nodes (HVN), and thin rejection zones in real-time.
                </p>

                {/* Dynamic SVG Volume Profile Diagram */}
                <div className="mt-6 p-4 rounded-xl bg-black/40 border border-white/[0.06] space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400 pb-1 border-b border-white/[0.04]">
                    <span>VAH: 67,490.00</span>
                    <span className="text-cyan-300 font-bold">POC: 67,440.00</span>
                    <span>VAL: 67,380.00</span>
                  </div>

                  <div className="space-y-1.5 pt-2">
                    {[
                      { price: '67,520', w: '25%', poc: false },
                      { price: '67,490', w: '48%', poc: false, label: 'VAH' },
                      { price: '67,460', w: '74%', poc: false },
                      { price: '67,440', w: '100%', poc: true, label: 'VPOC' },
                      { price: '67,420', w: '65%', poc: false },
                      { price: '67,380', w: '42%', poc: false, label: 'VAL' },
                      { price: '67,350', w: '20%', poc: false },
                    ].map((bar, i) => (
                      <div key={i} className="flex items-center gap-2 text-[10px] font-mono">
                        <span className="w-11 text-zinc-500 shrink-0">{bar.price}</span>
                        <div className="flex-1 h-3.5 bg-white/[0.03] rounded-xs overflow-hidden flex items-center">
                          <div
                            className={`h-full rounded-xs transition-all duration-500 ${
                              bar.poc
                                ? 'bg-gradient-to-r from-cyan-500 to-purple-500 shadow-[0_0_12px_rgba(6,182,212,0.6)]'
                                : 'bg-white/[0.12]'
                            }`}
                            style={{ width: bar.w }}
                          />
                        </div>
                        <span className="w-8 text-right text-zinc-400 font-semibold shrink-0">
                          {bar.label || ''}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-5 text-[11px] font-mono text-zinc-500 flex items-center justify-between">
                <span>Value Area: 70% Volume</span>
                <span className="text-cyan-400 font-medium">AUCTION BALANCED</span>
              </div>
            </LiquidGlassCard>
          </motion.div>

          {/* ───────────────────────────────────────────────────────── */}
          {/* TILE 3 (Span 4 Cols): Sovereign Air-Gapped Isolation      */}
          {/* ───────────────────────────────────────────────────────── */}
          <motion.div variants={fadeInUp} className="lg:col-span-4">
            <LiquidGlassCard className="p-7 sm:p-8 flex flex-col justify-between h-full min-h-[340px]">
              <div>
                <TelemetryBadge tone="emerald" pulse={false} className="mb-4">
                  AIR-GAPPED ISOLATION
                </TelemetryBadge>

                <h3 className="text-xl sm:text-2xl font-semibold text-white tracking-tight leading-snug">
                  Hardware-locked strategy keys.
                </h3>
                <p className="text-zinc-400 text-sm mt-2 leading-relaxed">
                  No cloud credential sync. Your exchange API keys, private Python research models, and trading state are kept strictly on your physical machine.
                </p>

                {/* Cryptographic Badge Visual */}
                <div className="mt-6 p-4 rounded-xl bg-black/40 border border-white/[0.06] flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-emerald-950/60 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 shadow-[0_0_24px_rgba(16,185,129,0.2)]">
                    <ShieldCheck size={24} />
                  </div>
                  <div className="min-w-0 font-mono text-xs">
                    <div className="text-emerald-300 font-semibold">ZERO REMOTE LOGGING</div>
                    <div className="text-[10px] text-zinc-500 truncate mt-0.5">
                      HASH: sha256_ed25519_local_only
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between text-[10px] font-mono text-zinc-500">
                <span>TELEMETRY: BLOCKED</span>
                <span className="text-emerald-400">100% PRIVATE</span>
              </div>
            </LiquidGlassCard>
          </motion.div>

          {/* ───────────────────────────────────────────────────────── */}
          {/* TILE 4 (Span 4 Cols): Multi-Display Canvas Matrix         */}
          {/* ───────────────────────────────────────────────────────── */}
          <motion.div variants={fadeInUp} className="lg:col-span-4">
            <LiquidGlassCard className="p-7 sm:p-8 flex flex-col justify-between h-full min-h-[340px]">
              <div>
                <TelemetryBadge tone="purple" pulse={false} className="mb-4">
                  MULTI-DISPLAY CANVAS MATRIX
                </TelemetryBadge>

                <h3 className="text-xl sm:text-2xl font-semibold text-white tracking-tight leading-snug">
                  Multi-monitor battle stations.
                </h3>
                <p className="text-zinc-400 text-sm mt-2 leading-relaxed">
                  Detach charts, volume profiles, and terminal execution panes into sovereign native windows across dual and triple displays without frame drops.
                </p>

                {/* Multi-Window Preview Visual */}
                <div className="mt-6 p-4 rounded-xl bg-black/40 border border-white/[0.06] space-y-2">
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: 'DISP 1', content: 'L2 Footprint', active: true },
                      { label: 'DISP 2', content: 'Tape & Depth', active: false },
                      { label: 'DISP 3', content: 'Python REPL', active: false },
                    ].map((disp, i) => (
                      <div
                        key={i}
                        className={`p-2.5 rounded-lg border text-center font-mono ${
                          disp.active
                            ? 'bg-purple-950/40 border-purple-500/40 text-purple-200'
                            : 'bg-white/[0.02] border-white/[0.06] text-zinc-400'
                        }`}
                      >
                        <div className="text-[9px] text-zinc-500 uppercase">{disp.label}</div>
                        <div className="text-[10px] font-semibold mt-0.5 truncate">{disp.content}</div>
                      </div>
                    ))}
                  </div>
                  <div className="text-center pt-2 text-[10px] font-mono text-zinc-500">
                    ⌘+SHIFT+D · DETACHABLE NATIVE CLIENT WINDOWS
                  </div>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between text-[10px] font-mono text-zinc-500">
                <span>LAYOUT: PERSISTENT</span>
                <span className="text-purple-300">MULTI-HEAD READY</span>
              </div>
            </LiquidGlassCard>
          </motion.div>

          {/* ───────────────────────────────────────────────────────── */}
          {/* TILE 5 (Span 4 Cols): Vectorized Data Pipeline            */}
          {/* ───────────────────────────────────────────────────────── */}
          <motion.div variants={fadeInUp} className="lg:col-span-4">
            <LiquidGlassCard className="p-7 sm:p-8 flex flex-col justify-between h-full min-h-[340px]">
              <div>
                <TelemetryBadge tone="cyan" pulse className="mb-4">
                  VECTORIZED DATA PIPELINE
                </TelemetryBadge>

                <h3 className="text-xl sm:text-2xl font-semibold text-white tracking-tight leading-snug">
                  Real-time buy/sell delta imbalances.
                </h3>
                <p className="text-zinc-400 text-sm mt-2 leading-relaxed">
                  Track aggressive market taker volume vs passive resting limit liquidity. Spot institutional absorption before the breakout occurs.
                </p>

                {/* Dynamic Delta Pressure Bar */}
                <div className="mt-6 p-4 rounded-xl bg-black/40 border border-white/[0.06] space-y-3 font-mono">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      BUY AGGRESSORS: {buyPressure}%
                    </span>
                    <span className="text-rose-400 font-bold">
                      SELL: {100 - buyPressure}%
                    </span>
                  </div>

                  {/* Dual Bar */}
                  <div className="h-3 w-full bg-white/[0.04] rounded-full overflow-hidden flex p-0.5">
                    <motion.div
                      className="h-full bg-emerald-400 rounded-l-full shadow-[0_0_8px_rgba(52,211,153,0.5)]"
                      animate={{ width: `${buyPressure}%` }}
                      transition={{ type: 'spring', stiffness: 120, damping: 20 }}
                    />
                    <motion.div
                      className="h-full bg-rose-500 rounded-r-full shadow-[0_0_8px_rgba(244,63,94,0.5)]"
                      animate={{ width: `${100 - buyPressure}%` }}
                      transition={{ type: 'spring', stiffness: 120, damping: 20 }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-zinc-500 pt-1">
                    <span>NET DELTA: +{(buyPressure * 4.2).toFixed(1)} BTC</span>
                    <span className="text-emerald-400 font-medium">BULLISH ABSORPTION</span>
                  </div>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between text-[10px] font-mono text-zinc-500">
                <span>ORDER BOOK L2: DEPTH 100</span>
                <span className="text-cyan-400">STREAMING ACTIVE</span>
              </div>
            </LiquidGlassCard>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
export default QuantBentoMatrix;
