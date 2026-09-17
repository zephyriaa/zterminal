'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { fadeInUp, staggerContainer } from '../motion/springConfig';
import { LiquidGlassCard } from '../ui/LiquidGlassCard';
import { TelemetryBadge } from '../ui/TelemetryBadge';
import { MetricCounter } from '../ui/MetricCounter';

export function ExecutionEngine() {
  const pipelineSteps = [
    {
      step: '01',
      phase: 'INGRESS',
      title: 'Exchange Telemetry',
      subtitle: 'Gateway WebSocket Stream',
      detail: 'Direct WebSocket streaming from Gate.io and Binance with exponential backoff and sequence verification.',
      badge: 'GATEWAY WS',
      accent: 'text-cyan-400',
    },
    {
      step: '02',
      phase: 'ANALYTICS',
      title: 'Deterministic Order Flow',
      subtitle: 'Local CVD & Volume Profile',
      detail: 'Real-time trade classification, aggressive delta bucketing, and Volume Profile computation in browser memory.',
      badge: 'LOCAL DELTA',
      accent: 'text-emerald-400',
    },
    {
      step: '03',
      phase: 'RENDERING',
      title: 'Hardware Canvas',
      subtitle: 'Lightweight Charts Engine',
      detail: 'GPU-accelerated HTML5 Canvas rendering for responsive zooming, panning, and multi-pane crosshair alignment.',
      badge: 'HTML5 CANVAS',
      accent: 'text-purple-400',
    },
  ];

  const architecturalComparison = [
    {
      capability: 'Order Flow Calculations',
      zterminal: 'Local Deterministic (In-Browser)',
      conventional: 'Pre-Smoothed Cloud Summary',
      advantage: 'Verifiable Math',
    },
    {
      capability: 'Market Depth Model',
      zterminal: 'Sequence-Aware L2 Snapshot + Deltas',
      conventional: 'Delayed Sampled Snapshots',
      advantage: 'Sequence Guard',
    },
    {
      capability: 'Data Sovereignty & Secrets',
      zterminal: 'Client Storage Only (Zero Egress)',
      conventional: 'Centralized Server Logging',
      advantage: 'Private Keys',
    },
    {
      capability: 'Strategy & Backtesting',
      zterminal: 'Standard Python via Local Companion',
      conventional: 'Vendor-Locked Proprietary Scripting',
      advantage: 'Open Ecosystem',
    },
    {
      capability: 'Canvas Rendering Stack',
      zterminal: 'Lightweight Charts (Canvas 2D)',
      conventional: 'Heavy DOM / SVG Hierarchy',
      advantage: 'Low CPU Load',
    },
  ];

  return (
    <section className="relative w-full py-28 md:py-36 px-6 md:px-12 bg-black" id="execution-architecture">
      <div className="max-w-6xl mx-auto">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-20">
          <div className="mb-4">
            <TelemetryBadge tone="cyan" pulse>
              EXECUTION ARCHITECTURE
            </TelemetryBadge>
          </div>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tight text-white mb-6 leading-[1.15]">
            Transparent execution without cloud intermediaries.
          </h2>
          <p className="text-zinc-400 text-base md:text-lg leading-relaxed">
            Engineered to stream real public market data and calculate order-flow metrics directly on your machine.
          </p>
        </div>

        {/* 3 Technical Capability Cards */}
        <motion.div
          variants={staggerContainer(0.08)}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16"
        >
          {/* Card 1: Canvas Rendering */}
          <LiquidGlassCard elevated className="p-8 flex flex-col justify-between min-h-[220px]">
            <div>
              <span className="font-mono text-xs text-zinc-500 uppercase tracking-widest">
                RENDERING PIPELINE
              </span>
              <div className="text-2xl md:text-3xl font-mono font-semibold text-white mt-3">
                HTML5 Canvas
              </div>
            </div>
            <p className="text-xs md:text-sm text-zinc-400 pt-4 border-t border-white/[0.06]">
              Lightweight Charts GPU-accelerated canvas prevents DOM thrashing during high-volume market events.
            </p>
          </LiquidGlassCard>

          {/* Card 2: Local Processing */}
          <LiquidGlassCard elevated className="p-8 flex flex-col justify-between min-h-[220px]">
            <div>
              <span className="font-mono text-xs text-zinc-500 uppercase tracking-widest">
                BOOK MANAGEMENT
              </span>
              <div className="text-2xl md:text-3xl font-mono font-semibold text-white mt-3">
                Sequence L2
              </div>
            </div>
            <p className="text-xs md:text-sm text-zinc-400 pt-4 border-t border-white/[0.06]">
              In-memory order book applies incremental exchange deltas with explicit sequence gap detection.
            </p>
          </LiquidGlassCard>

          {/* Card 3: Local First */}
          <LiquidGlassCard elevated className="p-8 flex flex-col justify-between min-h-[220px]">
            <div>
              <span className="font-mono text-xs text-zinc-500 uppercase tracking-widest">
                DATA PRIVACY
              </span>
              <div className="text-2xl md:text-3xl font-mono font-semibold text-white mt-3">
                Local-First
              </div>
            </div>
            <p className="text-xs md:text-sm text-zinc-400 pt-4 border-t border-white/[0.06]">
              Strategy parameters and private exchange credentials stay in browser storage with zero telemetry egress.
            </p>
          </LiquidGlassCard>
        </motion.div>

        {/* Three-Column Hardware Pipeline Diagram */}
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
          className="mb-16"
        >
          <div className="text-xs font-mono uppercase text-zinc-500 tracking-widest mb-6 px-1">
            {`// PIPELINE & INGESTION ARCHITECTURE`}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
            {pipelineSteps.map((step, idx) => (
              <LiquidGlassCard key={idx} className="p-8 flex flex-col justify-between min-h-[280px]">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-2xl font-mono font-semibold text-white/40">
                      {step.step}
                    </span>
                    <span className={`text-xs font-mono font-medium ${step.accent}`}>
                      {step.phase}
                    </span>
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-1">
                    {step.title}
                  </h3>
                  <div className="text-xs font-mono text-zinc-400 mb-3">
                    {step.subtitle}
                  </div>
                  <p className="text-zinc-400 text-sm leading-relaxed">
                    {step.detail}
                  </p>
                </div>
                <div className="pt-4 border-t border-white/[0.06] flex items-center justify-between">
                  <span className="text-xs font-mono text-zinc-500">SPECIFICATION</span>
                  <span className="text-xs font-mono text-zinc-300 font-medium">{step.badge}</span>
                </div>
              </LiquidGlassCard>
            ))}
          </div>
        </motion.div>

        {/* Architectural Audit Comparison */}
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
        >
          <LiquidGlassCard elevated className="p-8 md:p-10">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
              <div>
                <h3 className="text-xl md:text-2xl font-semibold text-white">
                  Architectural Contract &amp; Design Boundary
                </h3>
                <p className="text-zinc-400 text-sm mt-1">
                  How ZTerminal’s local-first pipeline compares against conventional centralized cloud chart portals.
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs font-mono">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-sm bg-emerald-400" />
                  <span className="text-zinc-300">ZTerminal</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-sm bg-zinc-700" />
                  <span className="text-zinc-500">Cloud Web Portals</span>
                </div>
              </div>
            </div>

            {/* Comparison Rows */}
            <div className="space-y-4">
              {architecturalComparison.map((row, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] flex flex-col md:flex-row md:items-center justify-between gap-3"
                >
                  <div className="md:w-1/3">
                    <span className="text-sm font-medium text-white">{row.capability}</span>
                    <span className="block text-[11px] font-mono text-emerald-400 mt-0.5">
                      {row.advantage}
                    </span>
                  </div>
                  <div className="md:w-1/3 text-xs font-mono text-emerald-300 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                    <span>{row.zterminal}</span>
                  </div>
                  <div className="md:w-1/3 text-xs font-mono text-zinc-500 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-700 shrink-0" />
                    <span>{row.conventional}</span>
                  </div>
                </div>
              ))}
            </div>
          </LiquidGlassCard>
        </motion.div>
      </div>
    </section>
  );
}
