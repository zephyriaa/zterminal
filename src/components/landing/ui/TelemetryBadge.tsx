'use client';

import React from 'react';

type BadgeTone = 'emerald' | 'cyan' | 'purple' | 'amber' | 'zinc' | 'white';

interface TelemetryBadgeProps {
  children: React.ReactNode;
  tone?: BadgeTone;
  pulse?: boolean;
  className?: string;
}

const toneStyles: Record<BadgeTone, { border: string; bg: string; text: string; dot: string }> = {
  emerald: {
    border: 'border-emerald-500/20',
    bg: 'bg-emerald-500/[0.06]',
    text: 'text-emerald-400',
    dot: 'bg-emerald-400',
  },
  cyan: {
    border: 'border-cyan-500/20',
    bg: 'bg-cyan-500/[0.06]',
    text: 'text-cyan-400',
    dot: 'bg-cyan-400',
  },
  purple: {
    border: 'border-purple-500/20',
    bg: 'bg-purple-500/[0.06]',
    text: 'text-purple-400',
    dot: 'bg-purple-400',
  },
  amber: {
    border: 'border-amber-500/20',
    bg: 'bg-amber-500/[0.06]',
    text: 'text-amber-400',
    dot: 'bg-amber-400',
  },
  zinc: {
    border: 'border-white/[0.08]',
    bg: 'bg-white/[0.03]',
    text: 'text-zinc-300',
    dot: 'bg-zinc-400',
  },
  white: {
    border: 'border-white/20',
    bg: 'bg-white/[0.08]',
    text: 'text-white',
    dot: 'bg-white',
  },
};

export function TelemetryBadge({
  children,
  tone = 'emerald',
  pulse = true,
  className = '',
}: TelemetryBadgeProps) {
  const t = toneStyles[tone];

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border ${t.border} ${t.bg} ${t.text} text-xs font-mono uppercase tracking-widest backdrop-blur-md transition-colors ${className}`}
    >
      {pulse && (
        <span className="relative flex h-1.5 w-1.5">
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full ${t.dot} opacity-75`}
          />
          <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${t.dot}`} />
        </span>
      )}
      <span>{children}</span>
    </div>
  );
}
