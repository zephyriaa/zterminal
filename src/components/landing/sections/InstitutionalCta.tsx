'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, Download, Monitor, ShieldCheck, Terminal, Cpu } from 'lucide-react';
import { fadeInUp, staggerContainer } from '../motion/springConfig';
import { LiquidGlassCard } from '../ui/LiquidGlassCard';
import { TelemetryBadge } from '../ui/TelemetryBadge';

export function InstitutionalCta() {
  const [detectedOs, setDetectedOs] = useState<string>('macOS / Windows / Linux');

  useEffect(() => {
    if (typeof window !== 'undefined' && navigator.userAgent) {
      const ua = navigator.userAgent;
      if (ua.includes('Win')) {
        setDetectedOs('Windows x64');
      } else if (ua.includes('Mac')) {
        setDetectedOs('macOS (Apple Silicon / Intel)');
      } else if (ua.includes('Linux')) {
        setDetectedOs('Linux x64');
      }
    }
  }, []);

  const footerColumns = [
    {
      heading: 'PLATFORM',
      items: [
        { label: 'Web Terminal Workspace', href: '/terminal' },
        { label: 'Windows Native Client', href: '/download' },
        { label: 'macOS DMG & Binary', href: '/download' },
        { label: 'Linux Daemon / Docker', href: '/download' },
        { label: 'Release Notes v0.2.1', href: '/docs' },
      ],
    },
    {
      heading: 'ARCHITECTURE',
      items: [
        { label: 'Local-First Compute Daemon', href: '/docs' },
        { label: 'Python 3.12 Polars Engine', href: '/docs' },
        { label: 'VectorBT Execution Loop', href: '/docs' },
        { label: 'IPC WebSocket Spec', href: '/docs' },
        { label: 'Zero-Telemetry Telemetry Spec', href: '/docs' },
      ],
    },
    {
      heading: 'RESEARCH VERACITY',
      items: [
        { label: 'Tick-Level Determinism', href: '/docs' },
        { label: 'Volume Profile Science', href: '/docs' },
        { label: 'Order Book Delta Metrics', href: '/docs' },
        { label: 'Anti-Lookahead Verification', href: '/docs' },
        { label: 'Community Research Guides', href: '/docs' },
      ],
    },
    {
      heading: 'CRYPTOGRAPHIC LEDGER',
      items: [
        { label: 'SHA-256 State Signatures', href: '/docs' },
        { label: 'Ed25519 Release Registry', href: '/download' },
        { label: 'Local Parquet Schema', href: '/docs' },
        { label: 'Hardware Key Vault', href: '/docs' },
        { label: 'Source Verification (GitHub) ↗', href: 'https://github.com/zephyriaa/zterminal', external: true },
      ],
    },
  ];

  return (
    <section
      className="relative w-full py-28 md:py-36 px-6 md:px-12 bg-[#06070A] overflow-hidden border-t border-white/[0.04]"
      id="conversion"
      aria-label="Institutional Workstation Conversion Floor"
    >
      {/* Ambient Caustics — Purple & Violet */}
      <div
        className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[600px] rounded-full [background:radial-gradient(ellipse_at_center,rgba(147,51,234,0.08)_0%,transparent_70%)]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute top-0 right-1/4 w-[600px] h-[400px] rounded-full [background:radial-gradient(ellipse_at_center,rgba(6,182,212,0.04)_0%,transparent_70%)]"
        aria-hidden="true"
      />

      <div className="max-w-5xl mx-auto text-center relative z-10">
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
        >
          <LiquidGlassCard
            elevated
            className="p-10 md:p-16 flex flex-col items-center justify-center text-center relative overflow-hidden shadow-[0_30px_100px_-20px_rgba(124,58,237,0.25)]"
          >
            {/* Fine grid background */}
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.02]"
              style={{
                backgroundImage:
                  'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)',
                backgroundSize: '40px 40px',
              }}
              aria-hidden="true"
            />

            {/* Status Pill */}
            <div className="mb-7 relative z-10">
              <TelemetryBadge tone="purple" pulse>
                SYSTEM STATUS: READY FOR WORKSTATION INITIALIZATION
              </TelemetryBadge>
            </div>

            {/* Headline */}
            <h2 className="text-3xl sm:text-5xl lg:text-6xl font-semibold tracking-tight text-white mb-6 max-w-3xl leading-[1.12] relative z-10">
              Deploy sovereign intelligence <br className="hidden sm:block" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-fuchsia-300 to-white">
                on your desk.
              </span>
            </h2>

            {/* Subhead */}
            <p className="text-zinc-400 text-base md:text-lg max-w-2xl mb-10 leading-relaxed relative z-10">
              Join thousands of discretionary tape readers and quantitative researchers who refuse to trade blind. Launch the local workspace now and take control of your execution.
            </p>

            {/* Dual Actionable CTAs */}
            <div className="flex flex-col sm:flex-row items-center gap-4 mb-10 w-full sm:w-auto relative z-10">
              {/* Primary CTA */}
              <Link
                href="/terminal"
                className="group relative inline-flex items-center justify-center gap-3 px-8 py-4 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-semibold text-sm md:text-base tracking-tight transition-all duration-300 shadow-[0_0_40px_rgba(124,58,237,0.45)] hover:shadow-[0_0_50px_rgba(124,58,237,0.65)] w-full sm:w-auto"
              >
                <span>Launch Web Terminal</span>
                <ArrowRight size={16} className="transition-transform duration-300 group-hover:translate-x-1" />
              </Link>

              {/* Secondary CTA */}
              <Link
                href="/download"
                className="group inline-flex items-center justify-center gap-2.5 px-7 py-4 rounded-xl border border-white/[0.14] bg-white/[0.04] text-zinc-200 hover:text-white hover:bg-white/[0.08] hover:border-white/[0.24] transition-all text-sm md:text-base font-medium tracking-tight backdrop-blur-md w-full sm:w-auto"
              >
                <Download size={16} className="text-purple-400" />
                <span>Download Desktop Client</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/[0.06] border border-white/[0.08] text-purple-300">
                  {detectedOs}
                </span>
              </Link>
            </div>

            {/* Cryptographic Signing Stamp */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-black/50 border border-white/[0.06] font-mono text-[11px] text-zinc-400 relative z-10">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
              <span>
                INTEGRITY VERIFIED // SHA-256 BINARY AUDIT TRAIL // AIR-GAPPED BY DESIGN
              </span>
            </div>
          </LiquidGlassCard>
        </motion.div>

        {/* 4-Column Professional Institutional Footer */}
        <footer className="mt-28 pt-16 border-t border-white/[0.08] text-left">
          <motion.div
            variants={staggerContainer(0.07)}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-16"
          >
            {footerColumns.map(({ heading, items }) => (
              <motion.div key={heading} variants={fadeInUp}>
                <div className="text-xs font-mono uppercase text-zinc-300 tracking-widest mb-4">
                  {heading}
                </div>
                <ul className="space-y-2.5 text-sm text-zinc-400">
                  {items.map((item) => (
                    <li key={item.label}>
                      {item.external ? (
                        <a
                          href={item.href}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:text-white transition-colors inline-flex items-center gap-1"
                        >
                          {item.label}
                        </a>
                      ) : (
                        <Link href={item.href} className="hover:text-white transition-colors">
                          {item.label}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </motion.div>

          {/* Sub-Footer Meta Bar */}
          <div className="pt-8 border-t border-white/[0.06] flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs font-mono text-zinc-500">
            <div>© 2026 ZTerminal. Infrastructure for Sovereign Market Researchers.</div>
            <div className="flex items-center gap-4">
              <span>SYSTEM CLOCK: NTP LOCKED</span>
              <span className="text-zinc-700">•</span>
              <span>VERSION: 0.2.1 BETA</span>
            </div>
          </div>
          <div className="pt-3 text-[11px] text-zinc-600 font-mono">
            Direct market access and quantitative simulation software. All backtests execute locally without broker intermediation.
          </div>
        </footer>
      </div>
    </section>
  );
}
export default InstitutionalCta;
