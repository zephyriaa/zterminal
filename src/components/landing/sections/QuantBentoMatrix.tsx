'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { fadeInUp, staggerContainer } from '../motion/springConfig';
import { LiquidGlassCard } from '../ui/LiquidGlassCard';
import { TelemetryBadge } from '../ui/TelemetryBadge';

/** Static volume profile bars — VPOC at index 5 highlighted emerald */
function VolumeProfileVisual() {
  const bars = [28, 48, 65, 82, 100, 74, 52, 38, 22];
  const vpocIdx = 4; // 100 height = VPOC
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400 px-1">
        <span>VAH: 64,360.00</span>
        <span className="text-emerald-400 font-semibold">POC: 64,280.50</span>
        <span>VAL: 64,190.00</span>
      </div>
      <div className="flex items-end gap-1.5 h-24 w-full pt-2 border-t border-white/[0.06]">
        {bars.map((h, i) => (
          <div
            key={i}
            style={{ height: `${h}%` }}
            className={`flex-1 rounded-t-sm transition-all duration-300 ${
              i === vpocIdx
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
          Session Value Area // 70% Distribution
        </span>
      </div>
    </div>
  );
}

/** Static Python research code block */
function PythonCodeBlock() {
  return (
    <div className="space-y-3">
      <div className="p-4 rounded-xl bg-black/50 border border-white/[0.06] font-mono text-[11px] space-y-1 leading-relaxed">
        <div className="text-zinc-500">{`# momentum_retest.py`}</div>
        <div>
          <span className="text-purple-400">hypothesis</span>
          {' = market.retest('}
        </div>
        <div className="pl-4">
          <span className="text-zinc-300">level=</span>
          <span className="text-cyan-400">session.vpoc</span>,
        </div>
        <div className="pl-4">
          <span className="text-zinc-300">confirmation=</span>
          <span className="text-cyan-400">delta.absorption</span>
        </div>
        <div>{')'}</div>
        <div className="mt-1">
          <span className="text-purple-400">test</span>
          {'(hypothesis, regime='}
          <span className="text-emerald-400">{'"trend"'}</span>
          {')'}
        </div>
      </div>
      <div className="flex items-center gap-2 text-[11px] text-emerald-400 font-mono">
        <Check size={12} />
        <span>Rules are explicit. The test is repeatable.</span>
      </div>
    </div>
  );
}

/** Static 3-node architecture dataflow for the wide tile */
function ArchitectureDataflow() {
  return (
    <div className="space-y-4 mt-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: 'BROWSER UI', value: 'Lightweight Charts', detail: '2D Canvas + WebSockets', dot: 'bg-emerald-400' },
          { label: 'MARKET GATEWAY', value: 'Gate.io & Binance', detail: 'L2 Book & Trade Stream', dot: 'bg-cyan-400' },
          { label: 'LOCAL HELPER', value: 'Windows Companion', detail: 'Isolated Python Runner', dot: 'bg-purple-400' },
        ].map(({ label, value, detail, dot }) => (
          <div key={label} className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] text-zinc-400 font-medium uppercase tracking-wider">{label}</span>
              <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
            </div>
            <div className="font-mono text-xs text-zinc-200 font-semibold">{value}</div>
            <span className="font-mono text-[10px] text-zinc-500">{detail}</span>
          </div>
        ))}
      </div>
      {/* Console block */}
      <div className="p-4 rounded-xl bg-black/50 border border-white/[0.06] font-mono text-xs space-y-1">
        <div className="text-zinc-500">{`// Loopback Transport & Channel Status`}</div>
        <div className="text-emerald-400">gateway connection: socket.io connected (OK)</div>
        <div className="text-zinc-300">
          transport: <span className="text-white font-medium">direct websocket</span>
          {' // book state: '}
          <span className="text-cyan-300 font-medium">sequence-verified</span>
        </div>
      </div>
    </div>
  );
}

/** Static local storage trust badge for tile 4 */
function SovereignStorageVisual() {
  return (
    <div className="space-y-3">
      <div className="p-4 rounded-xl bg-amber-500/[0.04] border border-amber-500/20 font-mono text-[11px] text-amber-300/90 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-400" />
          <span>LOCAL KEY STORAGE</span>
        </div>
        <span className="text-zinc-400 text-[10px]">ANALYTICS: ZERO</span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-zinc-500">
        <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.05]">
          <div className="text-zinc-300 font-medium mb-0.5">Exchange keys</div>
          Local storage only
        </div>
        <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.05]">
          <div className="text-zinc-300 font-medium mb-0.5">Strategies</div>
          On your machine
        </div>
        <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.05]">
          <div className="text-zinc-300 font-medium mb-0.5">Datasets</div>
          Selected by you
        </div>
        <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.05]">
          <div className="text-zinc-300 font-medium mb-0.5">Results</div>
          Archived locally
        </div>
      </div>
    </div>
  );
}

export function QuantBentoMatrix() {
  return (
    <section
      className="relative w-full py-28 md:py-36 px-6 md:px-12 bg-black"
      id="quant-matrix"
    >
      <div className="max-w-7xl mx-auto">
        {/* Section header */}
        <motion.div
          variants={staggerContainer(0.08)}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          className="text-center max-w-3xl mx-auto mb-20"
        >
          <motion.div variants={fadeInUp} className="mb-4">
            <TelemetryBadge tone="zinc" pulse={false}>
              RESEARCH WORKSTATION ARCHITECTURE
            </TelemetryBadge>
          </motion.div>
          <motion.h2
            variants={fadeInUp}
            className="text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tight text-white mb-6 leading-[1.15]"
          >
            From Gut Feeling{' '}
            <br className="hidden sm:block" />
            <em className="not-italic bg-clip-text text-transparent bg-gradient-to-br from-purple-300 to-white">
              to a Number You Can Defend.
            </em>
          </motion.h2>
          <motion.p variants={fadeInUp} className="text-zinc-400 text-base md:text-lg leading-relaxed">
            Cognitive bias doesn't announce itself. It lives in the gap between "this looks like it
            works" and "here is what the data says." The Quant Loop closes that gap. Every
            observation becomes an explicit hypothesis. Every hypothesis gets a test. Every test
            produces an archived result with its assumptions attached.
          </motion.p>
        </motion.div>

        {/* 12-column bento grid */}
        <motion.div
          variants={staggerContainer(0.06)}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          className="grid grid-cols-1 md:grid-cols-12 gap-6"
        >
          {/* Tile 1 — Sub-millisecond Order Book Tape (col-span-8) */}
          <motion.div variants={fadeInUp} className="md:col-span-8">
            <LiquidGlassCard className="h-full p-8 flex flex-col justify-between min-h-[420px]">
              <div className="space-y-3">
                <TelemetryBadge tone="cyan" pulse>HYBRID ARCHITECTURE</TelemetryBadge>
                <h3 className="text-xl md:text-2xl font-semibold text-white tracking-tight leading-snug mt-2">
                  The tape doesn't lie—if you can read it fast enough.
                </h3>
                <p className="text-zinc-400 text-sm leading-relaxed">
                  ZTerminal streams directly from Gate.io and Binance via WebSocket, applying
                  incremental L2 deltas with sequence-gap detection in the browser. The order book
                  you see is derived from every observed message in order—not a sampled snapshot
                  from a CDN cache. Aggression, absorption, and initiative are readable before a
                  candle closes.
                </p>
              </div>
              <div className="mt-auto w-full pt-4">
                <ArchitectureDataflow />
              </div>
            </LiquidGlassCard>
          </motion.div>

          {/* Tile 2 — Deterministic Backtest Engine (col-span-4) */}
          <motion.div variants={fadeInUp} className="md:col-span-4">
            <LiquidGlassCard className="h-full p-8 flex flex-col justify-between min-h-[420px]">
              <div className="space-y-3">
                <TelemetryBadge tone="emerald" pulse>
                  VOLUME PROFILE & AUCTION DYNAMICS
                </TelemetryBadge>
                <h3 className="text-xl md:text-2xl font-semibold text-white tracking-tight leading-snug mt-2">
                  Construct the profile.{' '}
                  <em className="not-italic text-emerald-400">Don't accept one.</em>
                </h3>
                <p className="text-zinc-400 text-sm leading-relaxed">
                  Session, Composite, and Developing Volume Profiles are constructed from observed
                  trades in your local dataset—not sourced from a third-party indicator with
                  undisclosed methodology. No black box. No trust required.
                </p>
              </div>
              <div className="mt-6">
                <VolumeProfileVisual />
              </div>
            </LiquidGlassCard>
          </motion.div>

          {/* Tile 3 — Python Vectorized Research (col-span-4) */}
          <motion.div variants={fadeInUp} className="md:col-span-4">
            <LiquidGlassCard className="h-full p-8 flex flex-col justify-between min-h-[360px]">
              <div className="space-y-3">
                <TelemetryBadge tone="purple" pulse={false}>
                  STRATEGY PROTOCOL
                </TelemetryBadge>
                <h3 className="text-xl md:text-2xl font-semibold text-white tracking-tight leading-snug mt-2">
                  Make the discretion explicit.
                </h3>
                <p className="text-zinc-400 text-sm leading-relaxed">
                  Discretionary observations are valuable. Uncodified discretion is not testable.
                  Write your thesis in standard Python—no vendor scripting language, no proprietary
                  sandbox. Rules you can inspect are rules you can challenge.
                </p>
              </div>
              <div className="mt-6">
                <PythonCodeBlock />
              </div>
              <span className="mt-4 text-[10px] font-mono text-zinc-600 uppercase tracking-wider">
                Runtime: Python 3.11+ Companion
              </span>
            </LiquidGlassCard>
          </motion.div>

          {/* Tile 4 — Sovereign Air-Gapped Storage (col-span-4) */}
          <motion.div variants={fadeInUp} className="md:col-span-4">
            <LiquidGlassCard className="h-full p-8 flex flex-col justify-between min-h-[360px]">
              <div className="space-y-3">
                <TelemetryBadge tone="amber" pulse={false}>
                  LOCAL-FIRST
                </TelemetryBadge>
                <h3 className="text-xl md:text-2xl font-semibold text-white tracking-tight leading-snug mt-2">
                  What you discover is not shared infrastructure.
                </h3>
                <p className="text-zinc-400 text-sm leading-relaxed">
                  Exchange API keys, strategy parameters, and research manifests are stored in your
                  local machine. Non-custodial by architecture. There is no remote parameter endpoint.
                </p>
              </div>
              <div className="mt-6">
                <SovereignStorageVisual />
              </div>
              <span className="mt-4 text-[10px] font-mono text-zinc-600 uppercase tracking-wider">
                Non-Custodial // No Cloud Dependency
              </span>
            </LiquidGlassCard>
          </motion.div>

          {/* Tile 5 — Decision Gate (col-span-4) */}
          <motion.div variants={fadeInUp} className="md:col-span-4">
            <LiquidGlassCard elevated className="h-full p-8 flex flex-col justify-between min-h-[360px]">
              <div className="space-y-3">
                <TelemetryBadge tone="white" pulse={false}>
                  THE DECISION GATE
                </TelemetryBadge>
                <h3 className="text-xl md:text-2xl font-semibold text-white tracking-tight leading-snug mt-2">
                  Keep. Refine. Reject.
                </h3>
                <p className="text-zinc-400 text-sm leading-relaxed">
                  A weak thesis should fail quickly. A durable one earns the next test. The loop
                  doesn't end at a backtest—it ends when the evidence survives enough windows to
                  warrant conviction.
                </p>
              </div>
              <div className="mt-6 space-y-2">
                {['Hypothesis defined', 'Test window passed', 'Evidence archived'].map((step, i) => (
                  <div key={step} className="flex items-center gap-3">
                    <span
                      className={`flex-shrink-0 flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-mono font-bold ${
                        i < 2
                          ? 'bg-white/10 text-white/40'
                          : 'bg-purple-500/20 border border-purple-500/40 text-purple-300'
                      }`}
                    >
                      {i < 2 ? <Check size={10} className="opacity-40" /> : <Check size={10} />}
                    </span>
                    <span
                      className={`text-xs font-mono ${i < 2 ? 'text-zinc-500' : 'text-purple-300'}`}
                    >
                      {step}
                    </span>
                  </div>
                ))}
              </div>
            </LiquidGlassCard>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
