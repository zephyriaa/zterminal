'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
  Monitor,
  Cpu,
  Database,
  ArrowRight,
  ShieldAlert,
  Coins,
  Gauge,
  CheckCircle2,
  HardDrive,
  Hash,
} from 'lucide-react';
import { fadeInUp, staggerContainer, conduitDraw } from '../motion/springConfig';
import { LiquidGlassCard } from '../ui/LiquidGlassCard';
import { TelemetryBadge } from '../ui/TelemetryBadge';

export function SovereignPipeline() {
  const nodes = [
    {
      id: '01',
      title: 'Browser Workspace',
      badge: 'FRONTEND CANVAS',
      tone: 'cyan' as const,
      icon: Monitor,
      subtitle: 'Clean visual exploration and research IDE',
      specs: [
        { label: 'Rendering', value: 'High-FPS 2D Canvas + WebGL' },
        { label: 'Connection', value: 'Localhost WebSocket (IPC)' },
        { label: 'Egress', value: '0 bytes strategy telemetry' },
      ],
      footerNote: 'Runs in Chrome, Edge, or Arc locally',
    },
    {
      id: '02',
      title: 'Local Research Engine',
      badge: 'DAEMON RUNTIME',
      tone: 'purple' as const,
      icon: Cpu,
      subtitle: 'Native Python 3.12, VectorBT, and Polars compute',
      specs: [
        { label: 'Throughput', value: '4.2M events/sec (SIMD)' },
        { label: 'Toolchain', value: 'Polars + NumPy + VectorBT' },
        { label: 'Hardware', value: 'Multi-threaded CPU / CUDA' },
      ],
      footerNote: 'Runs on your physical silicon',
    },
    {
      id: '03',
      title: 'Immutable Evidence Ledger',
      badge: 'CRYPTOGRAPHIC AUDIT',
      tone: 'emerald' as const,
      icon: HardDrive,
      subtitle: 'Deterministic run archive with SHA-256 locks',
      specs: [
        { label: 'Storage', value: 'Local Parquet tick partitions' },
        { label: 'Verification', value: 'Deterministic seed validation' },
        { label: 'Lookahead', value: '0% leakage guaranteed' },
      ],
      footerNote: 'State locked to immutable local disk',
    },
  ];

  return (
    <section
      className="relative w-full py-28 md:py-36 px-6 md:px-12 bg-[#090A0F] overflow-hidden border-t border-white/[0.04]"
      id="pipeline"
      aria-label="Sovereign Architecture Pipeline"
    >
      {/* Ambient Caustics */}
      <div
        className="pointer-events-none absolute top-1/3 left-1/2 -translate-x-1/2 w-[850px] h-[450px] rounded-full [background:radial-gradient(ellipse_at_center,rgba(124,58,237,0.06)_0%,transparent_70%)]"
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
            <TelemetryBadge tone="cyan" pulse>
              THE SOVEREIGN PIPELINE · NATIVE LOCAL COMPUTE
            </TelemetryBadge>
          </motion.div>

          <motion.h2
            variants={fadeInUp}
            className="text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tight text-white leading-[1.12]"
          >
            A clear boundary for <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-300 to-white">
              local work.
            </span>
          </motion.h2>

          <motion.p
            variants={fadeInUp}
            className="text-zinc-400 text-base md:text-lg leading-relaxed max-w-2xl mx-auto"
          >
            Cloud platforms demand that you upload proprietary alpha, pay metered GPU fees, and trust remote tenants with your intellectual property. ZTerminal preserves an unbreachable boundary between visualization and local compute.
          </motion.p>
        </motion.div>

        {/* 3-Node Connected Pipeline with Animated Conduits */}
        <div className="relative">
          {/* Desktop SVG Connecting Conduit (Hidden on Mobile) */}
          <div className="hidden lg:block absolute top-[138px] left-[15%] right-[15%] h-12 pointer-events-none z-0">
            <svg className="w-full h-full" viewBox="0 0 800 48" fill="none" preserveAspectRatio="none">
              <defs>
                <linearGradient id="pipeGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.4" />
                  <stop offset="50%" stopColor="#a855f7" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#34d399" stopOpacity="0.4" />
                </linearGradient>
                <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Background conduit path */}
              <path
                d="M 0 24 L 800 24"
                stroke="rgba(255, 255, 255, 0.08)"
                strokeWidth="2"
                strokeDasharray="4 4"
              />

              {/* Glowing animated line */}
              <motion.path
                d="M 0 24 L 800 24"
                stroke="url(#pipeGrad)"
                strokeWidth="2.5"
                filter="url(#glow)"
                variants={conduitDraw}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
              />
            </svg>

            {/* Glowing animated data packet travelling along the conduit */}
            <motion.div
              className="absolute top-[21px] w-2 h-2 rounded-full bg-cyan-300 shadow-[0_0_12px_#22d3ee]"
              animate={{
                left: ['0%', '100%'],
                opacity: [0, 1, 1, 0],
              }}
              transition={{
                duration: 3.2,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
            <motion.div
              className="absolute top-[21px] w-2 h-2 rounded-full bg-purple-300 shadow-[0_0_12px_#a855f7]"
              animate={{
                left: ['0%', '100%'],
                opacity: [0, 1, 1, 0],
              }}
              transition={{
                duration: 3.2,
                delay: 1.6,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
          </div>

          {/* 3 Pipeline Cards */}
          <motion.div
            variants={staggerContainer(0.12)}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-8 relative z-10"
          >
            {nodes.map((node, i) => {
              const Icon = node.icon;
              return (
                <motion.div key={node.id} variants={fadeInUp} className="h-full">
                  <LiquidGlassCard
                    elevated={i === 1}
                    className={`h-full p-7 flex flex-col justify-between border-t-2 ${
                      node.tone === 'cyan'
                        ? 'border-t-cyan-500/50'
                        : node.tone === 'purple'
                        ? 'border-t-purple-500/60 shadow-[0_20px_50px_rgba(168,85,247,0.15)]'
                        : 'border-t-emerald-500/50'
                    }`}
                  >
                    <div>
                      {/* Node Header Pill */}
                      <div className="flex items-center justify-between mb-5">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-white/[0.06] border border-white/[0.1] flex items-center justify-center font-mono text-[10px] text-zinc-300 font-bold">
                            {node.id}
                          </span>
                          <span className="font-mono text-[10px] text-zinc-500 uppercase tracking-widest">
                            {node.badge}
                          </span>
                        </div>
                        <div
                          className={`p-2 rounded-xl bg-white/[0.04] border border-white/[0.08] ${
                            node.tone === 'cyan'
                              ? 'text-cyan-400'
                              : node.tone === 'purple'
                              ? 'text-purple-400'
                              : 'text-emerald-400'
                          }`}
                        >
                          <Icon size={18} />
                        </div>
                      </div>

                      {/* Title & Subtitle */}
                      <h3 className="text-2xl font-semibold text-white tracking-tight leading-snug">
                        {node.title}
                      </h3>
                      <p className="text-zinc-400 text-sm mt-2 leading-relaxed font-normal">
                        {node.subtitle}
                      </p>

                      {/* Technical Specs List */}
                      <div className="mt-6 space-y-2.5 pt-5 border-t border-white/[0.06]">
                        {node.specs.map((spec, sIdx) => (
                          <div
                            key={sIdx}
                            className="flex items-center justify-between text-xs font-mono p-2 rounded-lg bg-black/30 border border-white/[0.03]"
                          >
                            <span className="text-zinc-500">{spec.label}</span>
                            <span className="text-zinc-200 font-medium">{spec.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Bottom Indicator */}
                    <div className="mt-6 pt-4 border-t border-white/[0.05] flex items-center justify-between text-[11px] font-mono text-zinc-500">
                      <span>{node.footerNote}</span>
                      <CheckCircle2
                        size={14}
                        className={
                          node.tone === 'cyan'
                            ? 'text-cyan-400'
                            : node.tone === 'purple'
                            ? 'text-purple-400'
                            : 'text-emerald-400'
                        }
                      />
                    </div>
                  </LiquidGlassCard>
                </motion.div>
              );
            })}
          </motion.div>
        </div>

        {/* Marketing Proof Strip */}
        <motion.div
          variants={staggerContainer(0.08)}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
          className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-5"
        >
          {[
            {
              icon: ShieldAlert,
              title: 'No Cloud Front-Running',
              description:
                'Your signals and execution parameters never traverse third-party servers where order flow can be scrutinized or mined.',
              badge: 'AIR-GAPPED ALGORITHMS',
            },
            {
              icon: Coins,
              title: 'No Compute Paywalls',
              description:
                'Run multi-million event Monte Carlo simulations directly on your silicon. Zero hourly VM rental surcharges.',
              badge: 'ZERO RUNTIME FEES',
            },
            {
              icon: Gauge,
              title: 'Native Hardware Speed',
              description:
                'Polars and VectorBT harness full CPU cache lines and SIMD vector lanes, bypassing browser execution bottlenecks.',
              badge: 'BARE-METAL THROUGHPUT',
            },
          ].map((item, idx) => {
            const Icon = item.icon;
            return (
              <motion.div key={idx} variants={fadeInUp}>
                <div className="p-5 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.12] transition-colors h-full flex flex-col justify-between space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] text-purple-400 tracking-wider font-semibold uppercase">
                      {item.badge}
                    </span>
                    <Icon size={16} className="text-zinc-500" />
                  </div>
                  <div>
                    <h4 className="text-base font-semibold text-white tracking-tight">
                      {item.title}
                    </h4>
                    <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
export default SovereignPipeline;
