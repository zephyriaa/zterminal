'use client';

import React from 'react';
import { LiquidGlassCard } from './LiquidGlassCard';

interface BentoTileProps {
  children?: React.ReactNode;
  badge?: React.ReactNode;
  title?: string;
  description?: string;
  footer?: React.ReactNode;
  className?: string;
  colSpan?: 4 | 6 | 8 | 12;
  minHeight?: string;
  elevated?: boolean;
}

const colSpanClasses: Record<number, string> = {
  4: 'md:col-span-4',
  6: 'md:col-span-6',
  8: 'md:col-span-8',
  12: 'md:col-span-12',
};

export function BentoTile({
  children,
  badge,
  title,
  description,
  footer,
  className = '',
  colSpan = 4,
  minHeight = 'min-h-[360px]',
  elevated = false,
}: BentoTileProps) {
  const spanClass = colSpanClasses[colSpan] || 'md:col-span-4';

  return (
    <LiquidGlassCard
      elevated={elevated}
      className={`col-span-1 ${spanClass} ${minHeight} p-8 flex flex-col justify-between overflow-hidden ${className}`}
    >
      <div className="space-y-3">
        {badge && <div className="mb-2">{badge}</div>}
        {title && (
          <h3 className="text-xl md:text-2xl font-semibold text-white tracking-tight leading-snug">
            {title}
          </h3>
        )}
        {description && (
          <p className="text-zinc-400 text-sm md:text-base leading-relaxed">
            {description}
          </p>
        )}
      </div>

      {children && <div className="my-auto w-full py-4">{children}</div>}

      {footer && <div className="pt-4 border-t border-white/[0.06]">{footer}</div>}
    </LiquidGlassCard>
  );
}
