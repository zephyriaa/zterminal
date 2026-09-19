'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Fingerprint, LockKeyhole, Zap, Database, Braces, ShieldCheck } from 'lucide-react';
import { fadeInUp, staggerContainer } from '../motion/springConfig';
import { LiquidGlassCard } from '../ui/LiquidGlassCard';
import { TelemetryBadge } from '../ui/TelemetryBadge';

function SovereignOrbit() {
  return (
    <div
      className="relative flex items-center justify-center w-full min-h-[360px]"
      aria-label="Local research sovereignty diagram"
    >
      {/* Ambient orbit rings */}
      <div className="absolute w-64 h-64 rounded-full border border-purple-500/10 animate-[spin_28s_linear_infinite]" />
      <div className="absolute w-80 h-80 rounded-full border border-purple-500/[0.06] animate-[spin_42s_linear_infinite_reverse]" />

      {/* Core node */}
      <div className="relative z-10 flex flex-col items-center gap-2">
        <div className="relative flex items-center justify-center w-20 h-20 rounded-full border border-purple-500/30 bg-purple-950/60 backdrop-blur-sm shadow-[0_0_60px_rgba(124,58,237,0.25)]">
          <span className="absolute inset-0 rounded-full bg-purple-500/10 animate-ping [animation-duration:3s]" />
          <Fingerprint size={32} strokeWidth={1.2} className="text-purple-300" />
        </div>
        <b className="text-xs font-mono tracking-[0.2em] text-purple-200 uppercase">Your Machine</b>
        <small className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Trusted boundary</small>
      </div>

      {/* Orbit nodes */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-900/80 border border-white/[0.08] backdrop-blur-md">
          <Database size={11} className="text-purple-400" />
          <span className="text-[10px] font-mono text-zinc-300">Market data</span>
        </div>
      </div>
      <div className="absolute bottom-10 left-6 flex flex-col items-center gap-1">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-900/80 border border-white/[0.08] backdrop-blur-md">
          <Braces size={11} className="text-purple-400" />
          <span className="text-[10px] font-mono text-zinc-300">Strategies</span>
        </div>
      </div>
      <div className="absolute bottom-10 right-6 flex flex-col items-center gap-1">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-900/80 border border-white/[0.08] backdrop-blur-md">
          <LockKeyhole size={11} className="text-purple-400" />
          <span className="text-[10px] font-mono text-zinc-300">Keys</span>
        </div>
      </div>

      {/* Private stamp */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-950/60 border border-purple-500/20 backdrop-blur-sm">
        <ShieldCheck size={11} className="text-purple-400" />
        <span className="text-[10px] font-mono text-purple-300 tracking-widest uppercase">Private by Architecture</span>
      </div>
    </div>
  );
}

const pillars = [
  {
    icon: Zap,
    title: 'Zero Round-Trip Latency',
    copy: 'Cloud-routed execution adds a measurable delay between observation and analysis. Local compute removes the intermediary entirely. Your research cycle is bounded by your hardware—not a shared tenant\'s queue.',
  },
  {
    icon: LockKeyhole,
    title: 'No Data Egress. No Telemetry.',
    copy: 'Strategy parameters, exchange credentials, and dataset selections remain on storage you control. ZTerminal does not log what you test, what you discard, or what you choose to keep.',
  },
  {
    icon: Fingerprint,
    title: 'Deterministic by Construction',
    copy: 'A result you cannot reproduce is not a result—it\'s a coincidence. Local execution means the same dataset, the same runtime, and the same assumptions produce the same output. Every time.',
  },
];

export function MicrostructureLens() {
  return (
    <section
      className="relative w-full py-28 md:py-36 px-6 md:px-12 bg-black overflow-hidden"
      id="sovereignty"
    >
      {/* Ambient caustic glow — purple */}
      <div
        className="pointer-events-none absolute -top-32 left-0 w-[700px] h-[500px] rounded-full bg-purple-600/5 blur-[120px]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute bottom-0 right-0 w-[500px] h-[400px] rounded-full bg-violet-600/[0.04] blur-[100px]"
        aria-hidden="true"
      />

      <div className="max-w-7xl mx-auto">
        <motion.div
          variants={staggerContainer(0.08)}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          className="grid grid-cols-1 xl:grid-cols-12 gap-12 xl:gap-16 items-center"
        >
          {/* Narrative column */}
          <div className="xl:col-span-5 space-y-8 min-w-0">
            <motion.div variants={fadeInUp}>
              <TelemetryBadge tone="purple" pulse>
                03 · LOCAL BY DESIGN
              </TelemetryBadge>
            </motion.div>

            <motion.h2
              variants={fadeInUp}
              className="text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tight text-white leading-[1.1]"
            >
              Your Edge,{' '}
              <em className="not-italic bg-clip-text text-transparent bg-gradient-to-br from-purple-300 to-white">
                Sovereign.
              </em>
            </motion.h2>

            <motion.p
              variants={fadeInUp}
              className="text-base md:text-lg text-zinc-400 leading-relaxed font-normal"
            >
              Every cloud terminal is a wiretap with a color scheme. When your research runs inside
              someone else's infrastructure, your hypotheses, your assumptions, and your dataset
              selections are logged before they're yours. The milliseconds you wait for a cloud
              round trip are not a convenience tax—they are a front-running window.
            </motion.p>

            <motion.p variants={fadeInUp} className="text-sm text-zinc-500 leading-relaxed">
              ZTerminal's Windows Companion closes that window. Python research runs locally. Market
              data ingress is direct. Secrets stay in the storage you control.
            </motion.p>

            {/* Value pillars */}
            <motion.div variants={staggerContainer(0.1)} className="space-y-4 pt-2">
              {pillars.map(({ icon: Icon, title, copy }) => (
                <motion.article
                  key={title}
                  variants={fadeInUp}
                  className="flex gap-4 p-5 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-purple-500/20 hover:bg-purple-500/[0.03] transition-colors duration-300"
                >
                  <span className="mt-0.5 flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20">
                    <Icon size={15} className="text-purple-400" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-white mb-1 tracking-tight">{title}</h3>
                    <p className="text-xs text-zinc-400 leading-relaxed">{copy}</p>
                  </div>
                </motion.article>
              ))}
            </motion.div>
          </div>

          {/* Visual column */}
          <motion.div variants={fadeInUp} className="xl:col-span-7 min-w-0 w-full">
            <LiquidGlassCard
              elevated
              className="p-8 min-h-[460px] flex flex-col justify-center overflow-hidden shadow-2xl"
            >
              <SovereignOrbit />
            </LiquidGlassCard>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
