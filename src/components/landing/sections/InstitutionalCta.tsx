'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { fadeInUp, staggerContainer } from '../motion/springConfig';
import { LiquidGlassCard } from '../ui/LiquidGlassCard';
import { TelemetryBadge } from '../ui/TelemetryBadge';

type FooterItem = { label: string; href: string; external?: boolean };

const footerColumns: { heading: string; items: FooterItem[]; extra?: React.ReactNode }[] = [
  {
    heading: 'PRODUCT',
    items: [
      { label: 'Web Terminal', href: '/terminal' },
      { label: 'Windows Companion Status', href: '/download' },
      { label: 'Installation Guide', href: '/docs/windows/install' },
    ],
  },
  {
    heading: 'ARCHITECTURE',
    items: [
      { label: 'Documentation Overview', href: '/docs' },
      { label: 'Python Research API', href: '/docs/python-research' },
      { label: 'ZScript Migration Guide', href: '/docs/zscript' },
    ],
  },
  {
    heading: 'SECURITY',
    items: [
      { label: 'Organization Certificate', href: '/docs/security/certificate' },
      { label: 'Binary Hash Registry', href: '/docs/security/hashes' },
      { label: 'Local Key Isolation', href: '/docs/security/keys' },
    ],
  },
  {
    heading: 'LEDGER',
    items: [
      { label: 'GitHub Repository ↗', href: 'https://github.com/zephyriaa/zterminal', external: true },
      { label: 'Provenance Standard', href: '/docs/provenance' },
    ],
    extra: (
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/[0.06]">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
        <span className="font-mono text-xs text-emerald-400 font-medium tracking-wide">
          GATEWAY OPERATIONAL
        </span>
      </div>
    ),
  },
];

export function InstitutionalCta() {
  return (
    <section
      className="relative w-full py-28 md:py-36 px-6 md:px-12 bg-black overflow-hidden"
      id="download"
    >
      {/* Ambient radial glow — amber/white institutional tone */}
      <div
        className="pointer-events-none absolute top-1/3 left-1/2 -translate-x-1/2 w-[900px] h-[500px] rounded-full bg-amber-500/[0.03] blur-[120px]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute top-0 left-1/4 w-[600px] h-[300px] rounded-full bg-purple-600/[0.04] blur-[100px]"
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
            className="p-10 md:p-16 flex flex-col items-center justify-center text-center relative overflow-hidden"
          >
            {/* Inner grid texture */}
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.025]"
              style={{
                backgroundImage:
                  'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)',
                backgroundSize: '48px 48px',
              }}
              aria-hidden="true"
            />

            {/* Verification status pill */}
            <div className="mb-8 relative z-10">
              <TelemetryBadge tone="amber" pulse>
                STATUS: PRE-RELEASE VERIFICATION IN PROGRESS
              </TelemetryBadge>
            </div>

            {/* Headline */}
            <h2 className="text-3xl md:text-5xl lg:text-6xl font-semibold tracking-tight text-white mb-6 max-w-3xl leading-[1.12] relative z-10">
              The Signed Installer{' '}
              <br className="hidden sm:block" />
              <em className="not-italic bg-clip-text text-transparent bg-gradient-to-br from-purple-300 to-white">
                Is Being Prepared.
              </em>
            </h2>

            {/* Explanatory copy */}
            <div className="max-w-2xl mb-10 space-y-4 text-left relative z-10">
              <p className="text-zinc-400 text-base md:text-lg leading-relaxed font-normal text-center">
                Institutional-grade software does not distribute unverified binaries.
              </p>
              <p className="text-zinc-500 text-sm leading-relaxed">
                ZTerminal does not publish a development artifact and call it a release. The Windows
                Companion installer will be signed with a verified organization certificate before it
                is distributed. The hash of every published binary will be disclosed alongside the
                release.
              </p>
              <p className="text-zinc-500 text-sm leading-relaxed text-center">
                This is not a delay. It is the standard that separates software you can audit from
                software you have to trust.
              </p>
              <p className="text-white/80 text-sm font-medium text-center">
                The web terminal is available now. No installation required.
              </p>
            </div>

            {/* Dual CTAs */}
            <div className="flex flex-col sm:flex-row items-center gap-4 mb-10 w-full sm:w-auto relative z-10">
              {/* Primary */}
              <Link
                href="/terminal"
                className="group relative inline-flex items-center justify-center gap-3 px-8 py-4 rounded-xl bg-white text-black font-medium text-sm md:text-base tracking-tight transition-all duration-300 hover:bg-zinc-100 hover:shadow-[0_0_32px_rgba(255,255,255,0.22)] w-full sm:w-auto"
              >
                <span>Open Web Terminal</span>
                <span className="text-xs px-2 py-0.5 rounded-md bg-black/10 text-zinc-600 font-mono">
                  Browser
                </span>
                <ArrowRight size={15} className="transition-transform duration-300 group-hover:translate-x-1" />
              </Link>

              {/* Secondary */}
              <Link
                href="/download"
                className="inline-flex items-center justify-center gap-2 px-7 py-4 rounded-xl border border-white/[0.12] bg-white/[0.04] text-zinc-200 hover:text-white hover:bg-white/[0.08] hover:border-white/[0.2] transition-all text-sm md:text-base font-medium tracking-tight backdrop-blur-md w-full sm:w-auto"
              >
                <span>Check Windows Companion Status</span>
                <span className="text-xs text-zinc-400 font-mono">x64</span>
                <ArrowRight size={14} />
              </Link>
            </div>

            {/* System status indicator */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-black/40 border border-white/[0.06] font-mono text-[11px] text-zinc-400 relative z-10">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse flex-shrink-0" />
              <span>
                STATUS: BETA v0.2.1 // WEB: ONLINE // COMPANION: WINDOWS-X64 (SIGNING IN PROGRESS)
              </span>
            </div>
          </LiquidGlassCard>
        </motion.div>

        {/* 4-column footer matrix */}
        <footer className="mt-28 pt-16 border-t border-white/[0.08] text-left">
          <motion.div
            variants={staggerContainer(0.07)}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-16"
          >
            {footerColumns.map(({ heading, items, extra }) => (
              <motion.div key={heading} variants={fadeInUp}>
                <div className="text-xs font-mono uppercase text-zinc-300 tracking-widest mb-4">
                  {heading}
                </div>
                <ul className="space-y-2.5 text-sm text-zinc-400">
                  {items.map(({ label, href, external }) => (
                    <li key={label}>
                      {external ? (
                        <a
                          href={href}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:text-white transition-colors inline-flex items-center gap-1"
                        >
                          {label}
                        </a>
                      ) : (
                        <Link href={href} className="hover:text-white transition-colors">
                          {label}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
                {extra}
              </motion.div>
            ))}
          </motion.div>

          {/* Sub-footer meta bar */}
          <div className="pt-8 border-t border-white/[0.06] flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs font-mono text-zinc-500">
            <div>© 2026 ZTerminal. Decision-support software for market research.</div>
            <div className="flex items-center gap-4">
              <span>CORE: LIGHTWEIGHT CHARTS CANVAS</span>
              <span className="text-zinc-700">•</span>
              <span>VERSION: 0.2.1 BETA</span>
            </div>
          </div>
          <div className="pt-3 text-[11px] text-zinc-600 font-mono">
            Market data can be delayed or incomplete; backtest and research outputs are hypothetical
            and for evaluation only.
          </div>
        </footer>
      </div>
    </section>
  );
}
