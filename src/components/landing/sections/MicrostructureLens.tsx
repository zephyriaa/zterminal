'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  Layers,
  ShieldCheck,
  Zap,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  AlertTriangle,
  Flame,
} from 'lucide-react';
import { fadeInUp, staggerContainer, springPhysics } from '../motion/springConfig';
import { LiquidGlassCard } from '../ui/LiquidGlassCard';
import { TelemetryBadge } from '../ui/TelemetryBadge';

export function MicrostructureLens() {
  const [sliderPosition, setSliderPosition] = useState(54); // Percentage 0-100
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMove = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const clampedPct = Math.min(Math.max((x / rect.width) * 100, 8), 92);
    setSliderPosition(clampedPct);
  }, []);

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length > 0) {
      handleMove(e.touches[0].clientX);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      handleMove(e.clientX);
    }
  };

  useEffect(() => {
    const handleGlobalMouseUp = () => setIsDragging(false);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, []);

  return (
    <section
      className="relative w-full py-28 md:py-36 px-6 md:px-12 bg-[#07080C] overflow-hidden border-t border-white/[0.04]"
      id="overview"
      aria-label="Market Microstructure Reveal Lens"
    >
      {/* Ambient GPU Caustics */}
      <div
        className="pointer-events-none absolute -top-40 left-1/4 w-[700px] h-[500px] rounded-full [background:radial-gradient(ellipse_at_center,rgba(168,85,247,0.06)_0%,transparent_70%)]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute bottom-[-100px] right-10 w-[600px] h-[500px] rounded-full [background:radial-gradient(ellipse_at_center,rgba(6,182,212,0.05)_0%,transparent_70%)]"
        aria-hidden="true"
      />

      <div className="max-w-7xl mx-auto">
        <motion.div
          variants={staggerContainer(0.08)}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-14 items-center"
        >
          {/* Left: High-Conviction Narrative Framing */}
          <div className="lg:col-span-5 space-y-8 min-w-0">
            <motion.div variants={fadeInUp}>
              <TelemetryBadge tone="purple" pulse>
                THE REVELATION · ORDER FLOW TRUTH
              </TelemetryBadge>
            </motion.div>

            <motion.div variants={fadeInUp} className="space-y-4">
              <h2 className="text-4xl md:text-5xl font-semibold tracking-tight text-white leading-[1.12]">
                Stop trading <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-violet-300 to-cyan-300">
                  in the dark.
                </span>
              </h2>
              <p className="text-zinc-400 text-base md:text-lg leading-relaxed">
                Conventional charting platforms feed you lagging moving averages, synthetic queues, and smoothed-out price bars—masking aggressive institutional absorption, iceberg orders, and true delta imbalances.
              </p>
              <p className="text-zinc-500 text-sm leading-relaxed">
                ZTerminal reconstructs the order book directly from the raw socket wire to your local processor. Peel away the retail veneer and trade with firsthand market structure veracity.
              </p>
            </motion.div>

            {/* Proof Telemetry Badges */}
            <motion.div variants={fadeInUp} className="space-y-3 pt-2">
              {[
                {
                  badge: '0.00ms Cloud Lag',
                  tone: 'purple' as const,
                  label: 'Direct local daemon execution',
                  desc: 'Zero intermediary servers between wire ticks and your screen.',
                  icon: Zap,
                },
                {
                  badge: '100% Sequence-Aware',
                  tone: 'cyan' as const,
                  label: 'Zero dropped tick events',
                  desc: 'Strict event-sequence validation catches queue skips and gaps.',
                  icon: Activity,
                },
                {
                  badge: 'Zero Surveillance',
                  tone: 'emerald' as const,
                  label: 'Proprietary alpha stays local',
                  desc: 'Air-gapped strategies never harvest or transmit your models.',
                  icon: ShieldCheck,
                },
              ].map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3.5 p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.12] transition-colors"
                >
                  <div className="p-2 rounded-lg bg-zinc-900/90 border border-white/[0.08] text-white shrink-0 mt-0.5">
                    <item.icon size={16} className={item.tone === 'purple' ? 'text-purple-400' : item.tone === 'cyan' ? 'text-cyan-400' : 'text-emerald-400'} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-semibold text-white tracking-tight">
                        {item.badge}
                      </span>
                      <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
                        · {item.label}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 mt-0.5 leading-snug">{item.desc}</p>
                  </div>
                </div>
              ))}
            </motion.div>
          </div>

          {/* Right: The Interactive Microstructure Reveal Lens */}
          <motion.div variants={fadeInUp} className="lg:col-span-7 min-w-0 w-full">
            <LiquidGlassCard
              elevated
              className="p-1 sm:p-2 select-none shadow-[0_30px_90px_-20px_rgba(0,0,0,0.95)]"
            >
              {/* Header Telemetry Bar */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] bg-black/40 rounded-t-xl text-[11px] font-mono">
                <div className="flex items-center gap-2 text-zinc-400">
                  <SlidersHorizontal size={13} className="text-purple-400" />
                  <span className="text-zinc-200 font-semibold">REVEAL LENS</span>
                  <span className="text-zinc-600">|</span>
                  <span className="hidden sm:inline text-zinc-400">BTC-USDT · 100ms TICK RESOLUTION</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-zinc-500 text-[10px] hidden sm:inline">PEEL SLIDER:</span>
                  <span className="text-purple-300 font-bold bg-purple-950/60 px-2 py-0.5 rounded border border-purple-500/30">
                    {Math.round(sliderPosition)}% INSTITUTIONAL
                  </span>
                </div>
              </div>

              {/* Viewport Canvas (Split Slider) */}
              <div
                ref={containerRef}
                onMouseDown={() => setIsDragging(true)}
                onMouseMove={handleMouseMove}
                onTouchMove={handleTouchMove}
                className="relative h-[480px] sm:h-[520px] w-full overflow-hidden cursor-ew-resize rounded-b-xl bg-[#090A10]"
              >
                {/* ───────────────────────────────────────────────────────── */}
                {/* LAYER B (Full Width Base): INSTITUTIONAL MICROSTRUCTURE   */}
                {/* ───────────────────────────────────────────────────────── */}
                <div className="absolute inset-0 p-5 flex flex-col justify-between bg-[#080910] text-zinc-200">
                  {/* Watermark badge */}
                  <div className="flex items-center justify-between">
                    <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-purple-500/10 border border-purple-500/25 text-[10px] font-mono text-purple-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                      INSTITUTIONAL TAPE // 0.00ms TICK ENGINE
                    </div>
                    <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/40 border border-cyan-500/20 px-2 py-0.5 rounded">
                      DELTA FOOTPRINT ACTIVE
                    </span>
                  </div>

                  {/* Footprint Grid & Aggressor Bars */}
                  <div className="my-auto space-y-2 font-mono">
                    <div className="grid grid-cols-12 gap-2 text-[10px] text-zinc-500 pb-1 border-b border-white/[0.04]">
                      <span className="col-span-3">PRICE</span>
                      <span className="col-span-3 text-right">BID VOL</span>
                      <span className="col-span-3 text-right">ASK VOL</span>
                      <span className="col-span-3 text-right">DELTA (Σ)</span>
                    </div>

                    {[
                      { price: '67,480.00', bid: '18.4', ask: '4.2', delta: '+14.2', status: 'normal', poc: false },
                      { price: '67,460.50', bid: '84.6', ask: '19.8', delta: '+64.8', status: 'absorption', poc: false },
                      { price: '67,440.00', bid: '192.5', ask: '42.1', delta: '+150.4', status: 'iceberg', poc: true },
                      { price: '67,420.00', bid: '62.1', ask: '78.9', delta: '-16.8', status: 'normal', poc: false },
                      { price: '67,400.50', bid: '31.0', ask: '95.4', delta: '-64.4', status: 'seller-sweep', poc: false },
                      { price: '67,380.00', bid: '14.2', ask: '22.0', delta: '-7.8', status: 'normal', poc: false },
                    ].map((row, i) => (
                      <div
                        key={i}
                        className={`grid grid-cols-12 gap-2 text-xs py-1 px-2 rounded items-center ${
                          row.poc
                            ? 'bg-purple-950/40 border border-purple-500/40 text-purple-200'
                            : 'hover:bg-white/[0.02]'
                        }`}
                      >
                        <span className="col-span-3 font-semibold text-zinc-200 flex items-center gap-1">
                          {row.poc && <span className="text-[9px] bg-purple-500 text-black font-bold px-1 rounded">POC</span>}
                          {row.price}
                        </span>
                        <span className="col-span-3 text-right text-emerald-400 font-mono">
                          {row.bid} BTC
                        </span>
                        <span className="col-span-3 text-right text-rose-400 font-mono">
                          {row.ask} BTC
                        </span>
                        <span
                          className={`col-span-3 text-right font-bold font-mono ${
                            row.delta.startsWith('+') ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {row.delta}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Real-time Order Flow Tape Feed */}
                  <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between text-[11px] font-mono">
                    <div className="flex items-center gap-2">
                      <Flame size={13} className="text-amber-400 animate-pulse" />
                      <span className="text-zinc-400">AGGRESSIVE SWEEP:</span>
                      <span className="text-emerald-400 font-bold">+150.4 BTC ABSORPTION @ 67,440.00</span>
                    </div>
                    <span className="text-zinc-500 text-[10px]">HARDWARE CLOCK: LOCKED</span>
                  </div>
                </div>

                {/* ───────────────────────────────────────────────────────── */}
                {/* LAYER A (Clipped Overlay): RETAIL SURFACE (Lagging view)  */}
                {/* ───────────────────────────────────────────────────────── */}
                <div
                  className="absolute inset-y-0 left-0 overflow-hidden bg-[#10121a] border-r border-white/20 z-20 pointer-events-none"
                  style={{ width: `${sliderPosition}%` }}
                >
                  <div className="absolute inset-0 w-[640px] sm:w-[700px] p-5 flex flex-col justify-between text-zinc-400">
                    {/* Retail Warning Badge */}
                    <div className="flex items-center justify-between">
                      <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-amber-500/15 border border-amber-500/30 text-[10px] font-mono text-amber-300">
                        <AlertTriangle size={12} className="text-amber-400" />
                        RETAIL CHART FEED // CLOUD LATENCY: 142ms
                      </div>
                      <span className="text-[10px] font-mono text-zinc-500 bg-zinc-900 px-2 py-0.5 rounded border border-white/[0.05]">
                        SYNTHETIC QUEUE
                      </span>
                    </div>

                    {/* Naive generic chart */}
                    <div className="my-auto space-y-4">
                      <div className="flex items-center justify-between text-xs font-mono text-zinc-500 pb-2 border-b border-zinc-800">
                        <span>CANDLESTICK (5M)</span>
                        <span>INDICATORS: RSI(14) · SMA(200)</span>
                      </div>

                      {/* Mock naive candlesticks with heavy lag disclaimer */}
                      <div className="h-44 flex items-end justify-around gap-2 px-4 py-3 bg-zinc-950/60 rounded-xl border border-zinc-800/80 relative">
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-30">
                          <span className="font-mono text-xs text-zinc-400 tracking-widest uppercase text-center px-4">
                            VOLUME ABSORPTION HIDDEN
                            <br />
                            ICEBERGS INVISIBLE TO RETAIL BROWSER
                          </span>
                        </div>

                        {[52, 44, 60, 75, 58, 49, 70, 82].map((h, i) => (
                          <div key={i} className="flex flex-col items-center h-full justify-end w-7">
                            <div
                              className={`w-3 rounded-xs ${i % 2 === 0 ? 'bg-zinc-500' : 'bg-zinc-600'}`}
                              style={{ height: `${h}%` }}
                            />
                            <div className="w-[1px] h-3 bg-zinc-600" />
                          </div>
                        ))}
                      </div>

                      <div className="p-3 rounded-lg bg-zinc-900/90 border border-zinc-800 text-[11px] font-mono text-zinc-400 flex items-center justify-between">
                        <span>RSI (14): 54.2 (Neutral)</span>
                        <span className="text-amber-400/90">ORDER BOOK: TRUNCATED (TOP 5)</span>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-zinc-800 text-[11px] font-mono text-zinc-500 flex items-center gap-2">
                      <TrendingUp size={13} className="text-zinc-600" />
                      <span>Lagging indicators react after institutional capital has already rotated.</span>
                    </div>
                  </div>
                </div>

                {/* ───────────────────────────────────────────────────────── */}
                {/* DIVIDER HANDLE (Draggable & Scrubbable)                   */}
                {/* ───────────────────────────────────────────────────────── */}
                <div
                  className="absolute inset-y-0 w-0 z-30 pointer-events-none"
                  style={{ left: `${sliderPosition}%` }}
                >
                  {/* Glowing Vertical Line */}
                  <div className="absolute inset-y-0 -left-[1.5px] w-[3px] bg-gradient-to-b from-purple-400 via-white to-cyan-400 shadow-[0_0_16px_rgba(168,85,247,0.8)]" />

                  {/* Center Scrub Knob */}
                  <div className="absolute top-1/2 -translate-y-1/2 -left-6 w-12 h-12 rounded-full bg-zinc-950/90 border-2 border-white/80 shadow-[0_0_24px_rgba(168,85,247,0.6),0_8px_16px_rgba(0,0,0,0.8)] flex items-center justify-center text-white cursor-ew-resize backdrop-blur-md transition-transform duration-150 hover:scale-110 active:scale-95">
                    <div className="flex items-center gap-0.5">
                      <ChevronLeft size={14} className="text-purple-300" />
                      <ChevronRight size={14} className="text-cyan-300" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Instruction Bar */}
              <div className="p-3 bg-black/60 rounded-b-xl border-t border-white/[0.04] text-center">
                <span className="text-[11px] font-mono text-zinc-400 tracking-wide">
                  ⇄ Drag or tap anywhere on the lens to peel away retail latency and inspect the underlying tape
                </span>
              </div>
            </LiquidGlassCard>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
export default MicrostructureLens;
