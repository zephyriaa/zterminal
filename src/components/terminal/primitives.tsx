"use client";

import { cn } from "@/lib/utils";

/** Compact panel with hairline border — the standard terminal container. */
export function Panel({
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "border hairline bg-panel rounded-[6px] overflow-hidden",
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

/** Panel header bar — title + actions, tight. */
export function PanelHeader({
  title,
  right,
  className,
  children,
}: {
  title?: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "h-8 shrink-0 flex items-center gap-2 px-2.5 border-b hairline bg-panel",
        className
      )}
    >
      {title && (
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {title}
        </span>
      )}
      {children}
      {right && <div className="ml-auto flex items-center gap-1">{right}</div>}
    </div>
  );
}

/** Section label — tiny uppercase. */
export function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground/70",
        className
      )}
    >
      {children}
    </span>
  );
}

/** Stat row — label / value, tabular aligned. */
export function StatRow({
  label,
  value,
  tone,
  hint,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  tone?: "pos" | "neg" | "warn" | "muted" | "default";
  hint?: string;
}) {
  const toneCls =
    tone === "pos"
      ? "text-pos"
      : tone === "neg"
      ? "text-neg"
      : tone === "warn"
      ? "text-warn"
      : tone === "muted"
      ? "text-muted-foreground"
      : "text-foreground";
  return (
    <div className="flex items-baseline justify-between py-1 gap-3" title={hint}>
      <span className="text-[11.5px] text-muted-foreground truncate">{label}</span>
      <span className={cn("text-[12px] tnum font-medium", toneCls)}>{value}</span>
    </div>
  );
}

/** SIMULATED badge — used wherever mock data is shown. */
export function SimulatedTag({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-1.5 h-4 rounded-[3px] border border-warn/40 bg-warn/10 text-warn text-[9.5px] font-semibold uppercase tracking-[0.12em]",
        className
      )}
    >
      <span className="w-1 h-1 rounded-full bg-warn" />
      Simulated
    </span>
  );
}

/** Pill — small status pill. */
export function Pill({
  children,
  tone = "default",
  className,
}: {
  children: React.ReactNode;
  tone?: "default" | "pos" | "neg" | "warn" | "mdata" | "research";
  className?: string;
}) {
  const map: Record<string, string> = {
    default: "border-border bg-surface text-muted-foreground",
    pos: "border-pos/30 bg-pos/10 text-pos",
    neg: "border-neg/30 bg-neg/10 text-neg",
    warn: "border-warn/30 bg-warn/10 text-warn",
    mdata: "border-mdata/30 bg-mdata/10 text-mdata",
    research: "border-research/30 bg-research/10 text-research",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-1.5 h-4 rounded-[3px] border text-[9.5px] font-semibold uppercase tracking-[0.12em]",
        map[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
