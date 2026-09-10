"use client";

import { useEffect, useState } from "react";
import { Clock, Globe } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { calculateMarketSessions, type MarketSessionsSnapshot } from "@/lib/market/market-sessions";
import { useWorkspace } from "@/stores/workspace";
import { cn } from "@/lib/utils";

interface MarketSessionsPopoverProps {
  children?: React.ReactNode;
}

export function MarketSessionsPopover({ children }: MarketSessionsPopoverProps) {
  const { symbol, timezone } = useWorkspace();
  const isCrypto = symbol.includes("USDT") || symbol.includes("BTC") || symbol.includes("ETH") || symbol.includes("SOL");
  
  const [now, setNow] = useState(() => Date.now());

  // Update session clock every 30 seconds
  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, 30_000);
    return () => window.clearInterval(interval);
  }, []);

  const snapshot = calculateMarketSessions(now, timezone, isCrypto);

  return (
    <Popover>
      <PopoverTrigger asChild>
        {children || (
          <button
            type="button"
            className="zt-status-bar-item hover:bg-hover hover:text-foreground text-muted-foreground transition-colors flex items-center gap-1.5 px-2 py-0.5"
            aria-label={`Market sessions: ${snapshot.nextEvent.compactLabel}`}
          >
            <Clock className="h-3 w-3 text-muted-foreground" />
            <span className="font-mono-num text-[10.5px]">{snapshot.nextEvent.compactLabel}</span>
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="top"
        sideOffset={6}
        className="w-[340px] p-3 zt-popover-terminal border border-border/80 bg-panel text-foreground shadow-2xl rounded-[6px]"
      >
        <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-border/60">
          <div className="flex items-center gap-1.5">
            <Globe className="h-3.5 w-3.5 text-mdata" />
            <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
              {isCrypto ? "GLOBAL SESSIONS" : "MARKET SESSIONS"}
            </span>
          </div>
          <span className="font-mono-num text-[11px] text-foreground font-medium">
            {snapshot.currentClock}
          </span>
        </div>

        {/* Sessions timeline list */}
        <div className="space-y-2.5">
          {snapshot.sessions.map((session) => {
            const isMarkerInSession = session.isOpen;

            return (
              <div key={session.id} className="space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        "w-1.5 h-1.5 rounded-full",
                        session.isOpen
                          ? "bg-pos animate-pulse"
                          : session.status === "pre"
                          ? "bg-warn"
                          : "bg-muted-foreground/40"
                      )}
                    />
                    <span className={cn("font-medium", session.isOpen ? "text-foreground" : "text-muted-foreground")}>
                      {session.name}
                    </span>
                    {session.status === "weekend" && (
                      <span className="text-[8.5px] text-muted-foreground/60 uppercase">w/e</span>
                    )}
                    {session.status === "maintenance" && (
                      <span className="text-[8.5px] text-warn uppercase">halt</span>
                    )}
                  </div>
                  <span className="font-mono-num text-[9.5px] text-muted-foreground">
                    {session.displayHours}
                  </span>
                </div>

                {/* 24-hour horizontal track */}
                <div className="relative h-1.5 w-full rounded-full bg-secondary/80 overflow-visible">
                  {/* Active session interval */}
                  {session.crossesMidnight ? (
                    <>
                      <div
                        className={cn(
                          "absolute top-0 bottom-0 rounded-l-full",
                          session.isOpen ? "bg-pos/40" : "bg-muted-foreground/20"
                        )}
                        style={{ left: 0, width: `${session.timelineEndPct}%` }}
                      />
                      <div
                        className={cn(
                          "absolute top-0 bottom-0 rounded-r-full",
                          session.isOpen ? "bg-pos/40" : "bg-muted-foreground/20"
                        )}
                        style={{
                          left: `${session.timelineStartPct}%`,
                          width: `${100 - session.timelineStartPct}%`,
                        }}
                      />
                    </>
                  ) : (
                    <div
                      className={cn(
                        "absolute top-0 bottom-0 rounded-full",
                        session.isOpen ? "bg-pos/40" : "bg-muted-foreground/20"
                      )}
                      style={{
                        left: `${session.timelineStartPct}%`,
                        width: `${Math.max(2, session.timelineEndPct - session.timelineStartPct)}%`,
                      }}
                    />
                  )}

                  {/* Current Time Needle crossing all bars */}
                  <div
                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10 flex items-center justify-center pointer-events-none"
                    style={{ left: `${snapshot.currentTimelinePct}%` }}
                  >
                    <div
                      className={cn(
                        "w-2 h-2 rounded-full border border-background shadow-xs",
                        isMarkerInSession ? "bg-pos" : "bg-foreground"
                      )}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Dynamic Next Event Banner */}
        <div className="mt-3 pt-2.5 border-t border-border/60 flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">
              NEXT EVENT
            </span>
            <p className="text-[11px] text-foreground font-mono-num font-medium">
              {snapshot.nextEvent.fullLabel}
            </p>
          </div>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary font-mono-num text-muted-foreground">
            {snapshot.nextEvent.compactLabel}
          </span>
        </div>

        {/* Semantic notice */}
        {isCrypto && (
          <p className="mt-2 text-[9px] text-muted-foreground/75 leading-tight">
            Digital asset markets trade 24/7. Timelines denote traditional equity & currency liquidity centers.
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
