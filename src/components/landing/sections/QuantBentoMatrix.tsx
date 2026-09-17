'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { fadeInUp, staggerContainer } from '../motion/springConfig';
import { LiquidGlassCard } from '../ui/LiquidGlassCard';
import { TelemetryBadge } from '../ui/TelemetryBadge';

export function QuantBentoMatrix() {
  return (
    <section className="relative w-full py-28 md:py-36 px-6 md:px-12 bg-black" id="quant-matrix">
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-20">
          <div className="mb-4">
            <TelemetryBadge tone="zinc" pulse={false}>
              RESEARCH WORKSTATION ARCHITECTURE
            </TelemetryBadge>
          </div>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tight text-white mb-6 leading-[1.15]">
            Built for researchers who demand empirical evidence.
          </h2>
          <p className="text-zinc-400 text-base md:text-lg leading-relaxed">
            A modular environment for discretionary tape readers, systematic researchers, and market structure practitioners.
          </p>
        </div>

        {/* Asymmetric 12-Column Bento Grid */}
        <motion.div
          variants={staggerContainer(0.06)}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          className="grid grid-cols-1 md:grid-cols-12 gap-6"
        >
          {/* Tile 1: Span 8 Cols - Architecture */}
          <LiquidGlassCard className="md:col-span-8 p-8 md:p-10 flex flex-col justify-between min-h-[420px]">
            <div>
              <div className="mb-3">
                <TelemetryBadge tone="cyan" pulse>
                  HYBRID ARCHITECTURE
                </TelemetryBadge>
              </div>
              <h3 className="text-2xl md:text-3xl font-semibold text-white mt-2 mb-3 tracking-tight">
                Browser Terminal + Local Companion
              </h3>
              <p className="text-zinc-400 text-sm md:text-base leading-relaxed max-w-2xl">
                Run interactive charts and live order-book analytics immediately in any modern browser. When your research requires custom Python strategies, local datasets, or private secrets, pair the terminal with the local Windows Companion helper.
              </p>
            </div>

            {/* Architecture Node Dataflow Visualizer */}
            <div className="mt-8 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-[11px] text-zinc-400 font-medium">BROWSER UI</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  </div>
                  <div className="font-mono text-xs text-zinc-200 font-semibold">Lightweight Charts</div>
                  <span className="font-mono text-[10px] text-zinc-500 mt-1">2D Canvas + WebSockets</span>
                </div>

                <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-[11px] text-zinc-400 font-medium">MARKET GATEWAY</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                  </div>
                  <div className="font-mono text-xs text-zinc-200 font-semibold">Gate.io &amp; Binance</div>
                  <span className="font-mono text-[10px] text-zinc-500 mt-1">L2 Book &amp; Trade Stream</span>
                </div>

                <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-[11px] text-zinc-400 font-medium">LOCAL HELPER</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                  </div>
                  <div className="font-mono text-xs text-zinc-200 font-semibold">Windows Companion</div>
                  <span className="font-mono text-[10px] text-zinc-500 mt-1">Isolated Python Runner</span>
                </div>
              </div>

              {/* Console Telemetry Output */}
              <div className="p-4 rounded-xl bg-black/50 border border-white/[0.06] font-mono text-xs text-zinc-400 space-y-1">
                <div className="text-zinc-500">{`// Loopback Transport & Channel Status`}</div>
                <div className="text-emerald-400">gateway connection: socket.io connected (OK)</div>
                <div className="text-zinc-300">
                  transport: <span className="text-white font-medium">direct websocket</span> {`// book state: `}
                  <span className="text-cyan-300 font-medium">sequence-verified</span>
                </div>
              </div>
            </div>
          </LiquidGlassCard>

          {/* Tile 2: Span 4 Cols - Volume Profile */}
          <LiquidGlassCard className="md:col-span-4 p-8 flex flex-col justify-between min-h-[420px]">
            <div>
              <div className="mb-3">
                <TelemetryBadge tone="emerald" pulse>
                  VOLUME PROFILE &amp; AUCTION DYNAMICS
                </TelemetryBadge>
              </div>
              <h3 className="text-2xl font-semibold text-white mt-2 mb-3 tracking-tight">
                Deterministic Profile Analysis
              </h3>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Construct Session, Composite, and Developing Volume Profiles directly from observed trades. Identify Value Area rotations, POC levels, and volume nodes without third-party black-box indicators.
              </p>
            </div>

            {/* Auction Market Profile Visualizer */}
            <div className="mt-6 space-y-3">
              <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400 px-1">
                <span>VAH: 64,360.00</span>
                <span className="text-emerald-400 font-semibold">POC: 64,280.50</span>
                <span>VAL: 64,190.00</span>
              </div>
              <div className="h-32 w-full flex items-end gap-1.5 pt-4 border-t border-white/[0.06]">
                {[28, 48, 65, 82, 100, 74, 52, 38, 22].map((h, i) => (
                  <div
                    key={i}
                    style={{ height: `${h}%` }}
                    className={`flex-1 rounded-t-sm transition-all ${
                      h === 100
                        ? 'bg-emerald-400/90 shadow-[0_0_12px_rgba(52,211,153,0.4)]'
                        : h > 60
                          ? 'bg-white/40'
                          : 'bg-white/15'
                    }`}
                  />
                ))}
              </div>
              <div className="text-center">
                <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
                  SESSION VALUE AREA // 70% DISTRIBUTION
                </span>
              </div>
            </div>
          </LiquidGlassCard>

          {/* Tile 3: Span 4 Cols - Python Research */}
          <LiquidGlassCard className="md:col-span-4 p-8 flex flex-col justify-between min-h-[360px]">
            <div>
              <div className="mb-3">
                <TelemetryBadge tone="purple" pulse={false}>
                  STRATEGY PROTOCOL
                </TelemetryBadge>
              </div>
              <h3 className="text-xl md:text-2xl font-semibold text-white mt-2 mb-3 tracking-tight">
                Python Research API
              </h3>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Develop testable hypotheses in standard Python. Run reproducible backtests against saved dataset manifests with next-bar execution policy.
              </p>
            </div>

            {/* Python Strategy Snippet */}
            <div className="p-3.5 rounded-xl bg-black/40 border border-white/[0.06] font-mono text-[11px] text-zinc-300 space-y-1 my-3">
              <div>
                <span className="text-purple-400">def</span> evaluate_signal(context, bar):
              </div>
              <div className="text-zinc-400">&nbsp;&nbsp;delta = calculate_cvd(bar)</div>
              <div className="text-zinc-400">&nbsp;&nbsp;<span className="text-purple-400">return</span> delta &gt; context.threshold</div>
              <div className="text-emerald-400">{`# Next-bar fill simulation`}</div>
            </div>

            <span className="text-xs font-mono text-zinc-500">RUNTIME: PYTHON 3.11+ COMPANION</span>
          </LiquidGlassCard>

          {/* Tile 4: Span 4 Cols - Privacy */}
          <LiquidGlassCard className="md:col-span-4 p-8 flex flex-col justify-between min-h-[360px]">
            <div>
              <div className="mb-3">
                <TelemetryBadge tone="amber" pulse={false}>
                  LOCAL-FIRST
                </TelemetryBadge>
              </div>
              <h3 className="text-xl md:text-2xl font-semibold text-white mt-2 mb-3 tracking-tight">
                Client-Side Key Isolation
              </h3>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Exchange API keys, custom indicators, and research strategies remain stored in your local machine. No tracking analytics. No remote parameter harvesting.
              </p>
            </div>

            {/* Local Security Badge */}
            <div className="p-3.5 rounded-xl bg-amber-500/[0.03] border border-amber-500/20 font-mono text-[11px] text-amber-300/90 flex items-center justify-between my-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <span>LOCAL KEY STORAGE</span>
              </div>
              <span className="text-zinc-400 text-[10px]">ANALYTICS: ZERO</span>
            </div>

            <span className="text-xs font-mono text-zinc-500">NON-CUSTODIAL // NO CLOUD DEPENDENCY</span>
          </LiquidGlassCard>

          {/* Tile 5: Span 4 Cols - Display Dock */}
          <LiquidGlassCard className="md:col-span-4 p-8 flex flex-col justify-between min-h-[360px]">
            <div>
              <div className="mb-3">
                <TelemetryBadge tone="cyan" pulse={false}>
                  WORKSPACE DOCK
                </TelemetryBadge>
              </div>
              <h3 className="text-xl md:text-2xl font-semibold text-white mt-2 mb-3 tracking-tight">
                Synchronized Multi-Pane Layout
              </h3>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Arrange candlestick charts, order-book depth, trade tape, and research summaries in a flexible grid with unified crosshairs.
              </p>
            </div>

            {/* Layout Wireframe */}
            <div className="grid grid-cols-2 gap-2 my-3">
              <div className="p-3 rounded-lg bg-black/40 border border-white/[0.08] flex flex-col items-center justify-center gap-1 h-20">
                <div className="w-12 h-1 bg-cyan-400/60 rounded" />
                <span className="font-mono text-[10px] text-zinc-400">PANE 1 // CANDLES</span>
              </div>
              <div className="p-3 rounded-lg bg-black/40 border border-white/[0.08] flex flex-col items-center justify-center gap-1 h-20">
                <div className="w-12 h-1 bg-cyan-400/60 rounded" />
                <span className="font-mono text-[10px] text-zinc-400">PANE 2 // DEPTH &amp; TAPE</span>
              </div>
            </div>

            <span className="text-xs font-mono text-zinc-500">ENGINE: DOCKVIEW // UNIFIED CROSSHAIR</span>
          </LiquidGlassCard>
        </motion.div>
      </div>
    </section>
  );
}
