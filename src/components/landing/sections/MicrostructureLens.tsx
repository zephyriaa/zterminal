'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { fadeInUp, staggerContainer, springPhysics } from '../motion/springConfig';
import { LiquidGlassCard } from '../ui/LiquidGlassCard';
import { TelemetryBadge } from '../ui/TelemetryBadge';

export function MicrostructureLens() {
  const volumeProfileData = [
    { vol: 24, label: '64,150' },
    { vol: 38, label: '64,180' },
    { vol: 46, label: '64,210' },
    { vol: 62, label: '64,240' },
    { vol: 88, label: '64,270' },
    { vol: 100, label: '64,280', isVpoc: true },
    { vol: 78, label: '64,310' },
    { vol: 44, label: '64,340' },
    { vol: 92, label: '64,370' },
    { vol: 68, label: '64,400' },
    { vol: 32, label: '64,430' },
    { vol: 18, label: '64,460' },
  ];

  return (
    <section className="relative w-full py-28 md:py-36 px-6 md:px-12 bg-black overflow-hidden" id="microstructure">
      {/* Ambient Caustic Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-emerald-500/5 blur-[100px] rounded-full pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/3 w-[600px] h-[350px] bg-cyan-500/5 blur-[100px] rounded-full pointer-events-none" />

      <div className="max-w-7xl mx-auto">
        <motion.div
          variants={staggerContainer(0.08)}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          className="grid grid-cols-1 xl:grid-cols-12 gap-12 xl:gap-16 items-center"
        >
          {/* Narrative Column */}
          <div className="xl:col-span-5 space-y-6 min-w-0">
            <motion.div variants={fadeInUp}>
              <TelemetryBadge tone="emerald" pulse>
                TRANSPARENT MARKET STRUCTURE
              </TelemetryBadge>
            </motion.div>

            <motion.h2
              variants={fadeInUp}
              className="text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tight text-white leading-[1.1]"
            >
              Precision where liquidity concentrates.<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-b from-zinc-200 via-zinc-400 to-zinc-600">
                Clarity when volatility expands.
              </span>
            </motion.h2>

            <motion.p
              variants={fadeInUp}
              className="text-base md:text-lg text-zinc-400 leading-relaxed font-normal"
            >
              Most web terminals hide market microstructure behind delayed, aggregated bars. ZTerminal streams public Gate.io and Binance feeds directly through a local gateway—deriving sequence-aware order books, Volume Profiles, and Auction Market Theory metrics transparently in your browser.
            </motion.p>

            {/* Floating Depth Tags */}
            <motion.div variants={fadeInUp} className="flex flex-wrap gap-2 pt-2">
              <span className="px-3 py-1 rounded-lg text-xs font-mono bg-white/[0.04] border border-white/[0.08] text-zinc-300">
                Auction Market Theory
              </span>
              <span className="px-3 py-1 rounded-lg text-xs font-mono bg-white/[0.04] border border-white/[0.08] text-zinc-300">
                Client-Side VWAP
              </span>
              <span className="px-3 py-1 rounded-lg text-xs font-mono bg-white/[0.04] border border-white/[0.08] text-zinc-300">
                Cumulative Delta
              </span>
              <span className="px-3 py-1 rounded-lg text-xs font-mono bg-white/[0.04] border border-white/[0.08] text-zinc-300">
                Observed Trades
              </span>
            </motion.div>

            {/* Metrics Strip */}
            <motion.div
              variants={fadeInUp}
              className="grid grid-cols-3 gap-4 pt-6 border-t border-white/[0.08]"
            >
              <div>
                <div className="text-xl md:text-2xl font-mono font-medium text-white">Direct WS</div>
                <div className="text-xs text-zinc-400 uppercase font-mono mt-1">Exchange Stream</div>
              </div>
              <div>
                <div className="text-xl md:text-2xl font-mono font-medium text-white">Local L2</div>
                <div className="text-xs text-zinc-400 uppercase font-mono mt-1">Sequence Book</div>
              </div>
              <div>
                <div className="text-xl md:text-2xl font-mono font-medium text-white">Canvas</div>
                <div className="text-xs text-zinc-400 uppercase font-mono mt-1">Hardware Chart</div>
              </div>
            </motion.div>
          </div>

          {/* Interactive Liquid Glass Lens Visualizer */}
          <motion.div variants={fadeInUp} className="xl:col-span-7 min-w-0 w-full">
            <LiquidGlassCard
              elevated
              className="p-6 md:p-8 min-h-[420px] flex flex-col justify-between overflow-hidden shadow-2xl w-full"
            >
              {/* Header Telemetry Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400/80 animate-pulse" />
                  <span className="font-mono text-xs text-zinc-300">
                    FEED: BINANCE_FUTURES // BTCUSDT (PREVIEW)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-white/[0.06] font-mono text-[11px] text-zinc-300">
                    DELTA: +4,280 (DERIVED)
                  </span>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/[0.15] border border-emerald-500/30 font-mono text-[11px] text-emerald-300 font-medium">
                    VPOC: 64,280.50
                  </span>
                </div>
              </div>

              {/* Simulated Volume Profile / Auction Representation */}
              <div className="my-auto py-6 grid grid-cols-12 gap-2 items-end h-52 w-full opacity-95">
                {volumeProfileData.map((item, idx) => (
                  <div key={idx} className="flex flex-col items-center gap-1.5 h-full justify-end group/bar">
                    <motion.div
                      initial={{ height: 0 }}
                      whileInView={{ height: `${item.vol}%` }}
                      transition={{ ...springPhysics.smooth, delay: idx * 0.035 }}
                      className={`w-full rounded-t-sm transition-all duration-300 ${
                        item.isVpoc
                          ? 'bg-emerald-400/90 shadow-[0_0_20px_rgba(52,211,153,0.45)]'
                          : item.vol > 70
                            ? 'bg-white/45 group-hover/bar:bg-white/60'
                            : 'bg-white/15 group-hover/bar:bg-white/30'
                      }`}
                    />
                    <span className="font-mono text-[10px] text-zinc-400 select-none group-hover/bar:text-zinc-200 transition-colors">
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>

              {/* Real-time Order Aggregation Readout */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 py-3 px-4 rounded-xl bg-black/40 border border-white/[0.05] font-mono text-[11px]">
                <div>
                  <span className="text-zinc-500">INGRESS:</span>{' '}
                  <span className="text-zinc-200">GATEWAY WEBSOCKET</span>
                </div>
                <div>
                  <span className="text-zinc-500">BOOK STATE:</span>{' '}
                  <span className="text-emerald-400">SEQUENCE-AWARE L2</span>
                </div>
                <div className="hidden md:block">
                  <span className="text-zinc-500">ANALYTICS:</span>{' '}
                  <span className="text-cyan-400">LOCAL CVD &amp; VPOC</span>
                </div>
              </div>

              {/* Footer Status Line */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500 font-mono pt-4 border-t border-white/[0.06]">
                <span>PROVENANCE: ILLUSTRATIVE DEPTH RECONSTRUCTION</span>
                <span>ENGINE: LIGHTWEIGHT CHARTS CANVAS</span>
              </div>
            </LiquidGlassCard>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
