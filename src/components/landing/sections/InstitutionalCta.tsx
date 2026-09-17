'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { fadeInUp } from '../motion/springConfig';
import { LiquidGlassCard } from '../ui/LiquidGlassCard';
import { TelemetryBadge } from '../ui/TelemetryBadge';

export function InstitutionalCta() {
  return (
    <section className="relative w-full py-28 md:py-36 px-6 md:px-12 bg-black overflow-hidden" id="download">
      {/* Ambient Radial Caustic Glow */}
      <div
        className="pointer-events-none absolute top-1/3 left-1/2 -translate-x-1/2 w-[900px] h-[500px] rounded-full [background:radial-gradient(ellipse_at_center,rgba(16,185,129,0.04)_0%,transparent_70%)]"
        aria-hidden="true"
      />

      <div className="max-w-5xl mx-auto text-center relative z-10">
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
        >
          {/* Elevated Conversion Slate */}
          <LiquidGlassCard
            elevated
            className="p-10 md:p-16 flex flex-col items-center justify-center text-center shadow-2xl relative overflow-hidden"
          >
            {/* Ambient Inner Refraction Pill */}
            <div className="mb-6">
              <TelemetryBadge tone="emerald" pulse>
                LOCAL-FIRST MARKET WORKSPACE
              </TelemetryBadge>
            </div>

            {/* CTA Headline */}
            <h2 className="text-3xl md:text-5xl lg:text-6xl font-semibold tracking-tight text-white mb-6 max-w-3xl leading-[1.12]">
              Empirical market research on your local hardware.
            </h2>

            {/* CTA Subhead */}
            <p className="text-zinc-400 text-base md:text-lg max-w-2xl mb-10 leading-relaxed font-normal">
              Analyze live public market microstructure directly in your browser. Connect the optional Windows Companion helper for isolated Python strategy execution and private local storage.
            </p>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-4 mb-10 w-full sm:w-auto">
              {/* Primary Terminal Button */}
              <Link
                href="/terminal"
                className="group relative inline-flex items-center justify-center gap-3 px-8 py-4 rounded-xl bg-white text-black font-medium text-sm md:text-base tracking-tight transition-all duration-300 hover:bg-zinc-200 hover:shadow-[0_0_30px_rgba(255,255,255,0.25)] w-full sm:w-auto"
              >
                <span>Open Web Terminal</span>
                <span className="text-xs px-2 py-0.5 rounded-md bg-black/10 text-zinc-700 font-mono">
                  Browser
                </span>
                <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
              </Link>

              {/* Secondary Windows Availability Button */}
              <Link
                href="/download"
                className="inline-flex items-center justify-center gap-2 px-7 py-4 rounded-xl border border-white/[0.12] bg-white/[0.04] text-zinc-200 hover:text-white hover:bg-white/[0.08] hover:border-white/[0.2] transition-all text-sm md:text-base font-medium tracking-tight backdrop-blur-md w-full sm:w-auto"
              >
                <span>Check Windows Companion</span>
                <span className="text-xs text-zinc-400 font-mono">x64</span>
                <span aria-hidden="true">→</span>
              </Link>
            </div>

            {/* System Indicator */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-black/40 border border-white/[0.06] font-mono text-[11px] text-zinc-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>STATUS: BETA v0.2.1 // WEB: ONLINE // COMPANION: WINDOWS-X64 (PREVIEW)</span>
            </div>
          </LiquidGlassCard>
        </motion.div>

        {/* Minimalist Authentic Public Footer */}
        <footer className="mt-28 pt-16 border-t border-white/[0.08] text-left">
          {/* 4-Column Navigation Matrix */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-16">
            {/* Column 1: Workstation */}
            <div>
              <div className="text-xs font-mono uppercase text-zinc-300 tracking-wider mb-4">
                Workstation
              </div>
              <ul className="space-y-2.5 text-sm text-zinc-400">
                <li>
                  <Link href="/terminal" className="hover:text-white transition-colors">
                    Web Terminal
                  </Link>
                </li>
                <li>
                  <Link href="/download" className="hover:text-white transition-colors">
                    Windows Companion Status
                  </Link>
                </li>
                <li>
                  <Link href="/docs/windows/install" className="hover:text-white transition-colors">
                    Installation Guide
                  </Link>
                </li>
              </ul>
            </div>

            {/* Column 2: Research & Docs */}
            <div>
              <div className="text-xs font-mono uppercase text-zinc-300 tracking-wider mb-4">
                Research &amp; Docs
              </div>
              <ul className="space-y-2.5 text-sm text-zinc-400">
                <li>
                  <Link href="/docs" className="hover:text-white transition-colors">
                    Documentation Overview
                  </Link>
                </li>
                <li>
                  <Link href="/docs/python-research" className="hover:text-white transition-colors">
                    Python Research API
                  </Link>
                </li>
                <li>
                  <Link href="/docs/zscript" className="hover:text-white transition-colors">
                    ZScript Migration Guide
                  </Link>
                </li>
              </ul>
            </div>

            {/* Column 3: Data Feeds */}
            <div>
              <div className="text-xs font-mono uppercase text-zinc-300 tracking-wider mb-4">
                Market Feeds
              </div>
              <ul className="space-y-2.5 text-sm text-zinc-400">
                <li>
                  <span className="text-zinc-300">Gate.io Futures</span>
                  <span className="block text-[11px] text-zinc-500 font-mono">Live WebSocket adapter</span>
                </li>
                <li>
                  <span className="text-zinc-300">Binance Futures</span>
                  <span className="block text-[11px] text-zinc-500 font-mono">USDT-M perpetual stream</span>
                </li>
                <li>
                  <span className="text-zinc-300">Deterministic Order Flow</span>
                  <span className="block text-[11px] text-zinc-500 font-mono">Client-side delta &amp; VPOC</span>
                </li>
              </ul>
            </div>

            {/* Column 4: Project & Community */}
            <div>
              <div className="text-xs font-mono uppercase text-zinc-300 tracking-wider mb-4">
                Project &amp; Code
              </div>
              <ul className="space-y-2.5 text-sm text-zinc-400">
                <li>
                  <a
                    href="https://github.com/zephyriaa/zterminal"
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-white transition-colors inline-flex items-center gap-1"
                  >
                    <span>GitHub Repository</span>
                    <span aria-hidden="true">↗</span>
                  </a>
                </li>
                <li>
                  <span className="text-zinc-400">Local-First Storage</span>
                </li>
                <li>
                  <div className="flex items-center gap-2 mt-2 pt-2 border-t border-white/[0.06]">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="font-mono text-xs text-emerald-400 font-medium">
                      GATEWAY OPERATIONAL
                    </span>
                  </div>
                </li>
              </ul>
            </div>
          </div>

          {/* Sub-Footer Meta Bar */}
          <div className="pt-8 border-t border-white/[0.06] flex flex-col md:flex-row items-center justify-between gap-4 text-xs font-mono text-zinc-500">
            <div>
              © 2026 ZTerminal. Decision-support software for market research.
            </div>
            <div className="flex items-center gap-4">
              <span>CORE: LIGHTWEIGHT CHARTS CANVAS</span>
              <span>•</span>
              <span>VERSION: 0.2.1 BETA</span>
            </div>
          </div>
          <div className="pt-3 text-[11px] text-zinc-600 font-mono text-left">
            Market data can be delayed or incomplete; backtest and research outputs are hypothetical and for evaluation only.
          </div>
        </footer>
      </div>
    </section>
  );
}
