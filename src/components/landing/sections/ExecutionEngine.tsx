'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Globe, Monitor, Archive, Hash, ShieldCheck, Database } from 'lucide-react';
import { fadeInUp, staggerContainer } from '../motion/springConfig';
import { LiquidGlassCard } from '../ui/LiquidGlassCard';
import { TelemetryBadge } from '../ui/TelemetryBadge';

const pipelineNodes = [
  {
    step: '01',
    icon: Globe,
    title: 'Browser Workspace',
    verb: 'Investigates',
    accent: 'text-cyan-400',
    accentBorder: 'border-cyan-500/20',
    accentBg: 'bg-cyan-500/[0.06]',
    copy: 'Live L2 order book, Volume Profile, Cumulative Delta, and trade tape render in hardware-accelerated canvas—derived locally, without a cloud intermediary. You read the market. Nothing reads you.',
    status: 'GATEWAY WEBSOCKET · SEQUENCE-VERIFIED',
    statusColor: 'text-cyan-400',
    dotColor: 'bg-cyan-400',
  },
  {
    step: '02',
    icon: Monitor,
    title: 'Windows Helper',
    verb: 'Executes',
    accent: 'text-purple-400',
    accentBorder: 'border-purple-500/20',
    accentBg: 'bg-purple-500/[0.06]',
    copy: 'Approved Python research runs in an isolated local process. The Companion receives a signed task from the browser, executes against your selected dataset, and returns verifiable output. Your strategies never leave the machine to run.',
    status: 'PROCESS: ISOLATED · APPROVED TASKS ONLY',
    statusColor: 'text-purple-400',
    dotColor: 'bg-purple-400',
  },
  {
    step: '03',
    icon: Archive,
    title: 'Local Evidence Ledger',
    verb: 'Archives',
    accent: 'text-emerald-400',
    accentBorder: 'border-emerald-500/20',
    accentBg: 'bg-emerald-500/[0.06]',
    copy: 'Every completed research run is stored with its dataset manifest, assumption set, and a SHA-256 content hash. Not a summary—a reproducible record. The hash is publishable. The test is repeatable. The edge is yours to defend.',
    status: 'STORE: SHA-256 PROVENANCE · ASSUMPTION-ATTACHED',
    statusColor: 'text-emerald-400',
    dotColor: 'bg-emerald-400',
  },
];

const trustBadges = [
  {
    icon: Database,
    label: 'DuckDB Columnar + Polars Engine',
    copy: 'Vectorized scan over years of tick data completes in seconds. No sampling. No pre-aggregation that masks the tail.',
    tone: 'cyan' as const,
  },
  {
    icon: ShieldCheck,
    label: 'Verified Organization Certificate',
    copy: 'The Windows installer is signed by an auditable organization certificate. You can verify the binary is the binary.',
    tone: 'purple' as const,
  },
  {
    icon: Hash,
    label: 'Cryptographic SHA-256 Published',
    copy: 'Every research run produces a content hash you can publish, share, or timestamp. Reproducibility is a commitment you can prove.',
    tone: 'emerald' as const,
  },
];

/** CSS-only connector arrow — rotates 90° on mobile via Tailwind */
function PipelineArrow() {
  return (
    <div className="hidden md:flex flex-shrink-0 items-center justify-center w-12 self-center">
      <svg
        viewBox="0 0 48 20"
        fill="none"
        className="w-12 text-white/[0.14]"
        aria-hidden="true"
      >
        <line x1="0" y1="10" x2="36" y2="10" stroke="currentColor" strokeWidth="1" strokeDasharray="4 3" />
        <polyline points="30,4 42,10 30,16" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

/** Vertical connector for mobile (flex-col layout) */
function PipelineArrowVertical() {
  return (
    <div className="flex md:hidden items-center justify-center h-10 self-center">
      <svg viewBox="0 0 20 40" fill="none" className="h-10 text-white/[0.14]" aria-hidden="true">
        <line x1="10" y1="0" x2="10" y2="28" stroke="currentColor" strokeWidth="1" strokeDasharray="4 3" />
        <polyline points="4,22 10,34 16,22" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

export function ExecutionEngine() {
  return (
    <section
      className="relative w-full py-28 md:py-36 px-6 md:px-12 bg-black overflow-hidden"
      id="execution-architecture"
    >
      {/* Ambient caustic glow — cyan */}
      <div
        className="pointer-events-none absolute top-1/4 left-1/2 -translate-x-1/2 w-[900px] h-[400px] rounded-full bg-cyan-500/[0.04] blur-[110px]"
        aria-hidden="true"
      />

      <div className="max-w-6xl mx-auto">
        {/* Section header */}
        <motion.div
          variants={staggerContainer(0.08)}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          className="text-center max-w-3xl mx-auto mb-20"
        >
          <motion.div variants={fadeInUp} className="mb-4">
            <TelemetryBadge tone="cyan" pulse>
              EXECUTION ARCHITECTURE · WORKFLOW BOUNDARY
            </TelemetryBadge>
          </motion.div>
          <motion.h2
            variants={fadeInUp}
            className="text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tight text-white mb-6 leading-[1.12]"
          >
            A Hard Boundary.{' '}
            <em className="not-italic bg-clip-text text-transparent bg-gradient-to-br from-purple-300 to-white">
              Not a Policy.
            </em>
          </motion.h2>
          <motion.p variants={fadeInUp} className="text-zinc-400 text-base md:text-lg leading-relaxed">
            The browser is where you investigate. The Windows Companion is where approved research
            runs and archives its proof. These are not modes of the same thing—they are separate
            execution environments with an explicit, inspectable channel between them.
          </motion.p>
        </motion.div>

        {/* 3-Node pipeline */}
        <motion.div
          variants={staggerContainer(0.1)}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
          className="flex flex-col md:flex-row items-stretch gap-0 mb-16"
        >
          {pipelineNodes.map((node, idx) => {
            const NodeIcon = node.icon;
            return (
              <React.Fragment key={node.step}>
                <motion.div variants={fadeInUp} className="flex-1 min-w-0">
                  <LiquidGlassCard className="h-full p-7 flex flex-col gap-5">
                    {/* Node header */}
                    <div className="flex items-start justify-between gap-3">
                      <div
                        className={`flex items-center justify-center w-10 h-10 rounded-xl border ${node.accentBorder} ${node.accentBg}`}
                      >
                        <NodeIcon size={18} className={node.accent} />
                      </div>
                      <span className="font-mono text-2xl font-semibold text-white/20 leading-none mt-1">
                        {node.step}
                      </span>
                    </div>

                    {/* Node copy */}
                    <div className="space-y-1.5">
                      <div className={`text-xs font-mono font-semibold uppercase tracking-widest ${node.accent}`}>
                        {node.verb}
                      </div>
                      <h3 className="text-lg font-semibold text-white tracking-tight">{node.title}</h3>
                      <p className="text-zinc-400 text-sm leading-relaxed">{node.copy}</p>
                    </div>

                    {/* Status tag */}
                    <div className="mt-auto pt-4 border-t border-white/[0.06]">
                      <div className="flex items-center gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${node.dotColor}`} />
                        <span className={`text-[10px] font-mono font-medium ${node.statusColor}`}>
                          {node.status}
                        </span>
                      </div>
                    </div>
                  </LiquidGlassCard>
                </motion.div>

                {idx < pipelineNodes.length - 1 && (
                  <>
                    <PipelineArrow />
                    <PipelineArrowVertical />
                  </>
                )}
              </React.Fragment>
            );
          })}
        </motion.div>

        {/* Trust micro-badges */}
        <motion.div
          variants={staggerContainer(0.08)}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
          className="grid grid-cols-1 md:grid-cols-3 gap-5"
        >
          {trustBadges.map(({ icon: BadgeIcon, label, copy, tone }) => (
            <motion.div key={label} variants={fadeInUp}>
              <LiquidGlassCard elevated className="p-6 flex flex-col gap-4 min-h-[180px]">
                <div>
                  <TelemetryBadge tone={tone} pulse={false} className="text-[10px]">
                    {label}
                  </TelemetryBadge>
                </div>
                <p className="text-zinc-400 text-xs leading-relaxed">{copy}</p>
                <div className="mt-auto pt-3 border-t border-white/[0.06]">
                  <BadgeIcon size={14} className="text-white/20" />
                </div>
              </LiquidGlassCard>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
