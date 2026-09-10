"use client";

import { useState } from "react";
import {
  Activity,
  Check,
  CheckCircle2,
  Database,
  ExternalLink,
  Plus,
  RefreshCw,
  Server,
  ShieldCheck,
  Wifi,
  WifiOff,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { AddConnectionDialog } from "./add-connection-dialog";
import { BUILTIN_CONNECTORS, type ConnectorInfo } from "@/lib/market/connectors";
import { useMarketStream } from "@/hooks/use-market-stream";
import { useWorkspace } from "@/stores/workspace";
import { cn } from "@/lib/utils";

interface DataConnectionsPopoverProps {
  children?: React.ReactNode;
}

export function DataConnectionsPopover({ children }: DataConnectionsPopoverProps) {
  const { symbol, connection } = useWorkspace();
  const { provider, dataStatus, health, reason, lastTrade } = useMarketStream(symbol, { trades: 1, depth: false });
  const [addOpen, setAddOpen] = useState(false);

  const activeProvider = provider || connection.provider || "gateio";
  const providerLabel = activeProvider.toUpperCase();
  const isLive = dataStatus === "LIVE";
  const isConnecting = connection.state === "connecting";
  const isReconnecting = connection.state === "reconnecting";

  const latency = health?.latencyMs;
  const lastUpdate = health?.lastMessageAt
    ? new Date(health.lastMessageAt).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : lastTrade?.timestamp
    ? new Date(lastTrade.timestamp).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : undefined;

  const activeConnector = BUILTIN_CONNECTORS.find((c) => c.id === activeProvider) || BUILTIN_CONNECTORS[0];

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          {children || (
            <button
              type="button"
              className="zt-status-bar-item hover:bg-hover hover:text-foreground text-muted-foreground transition-colors flex items-center gap-1.5 px-2 py-0.5"
              aria-label={`Data Feed: ${providerLabel}, ${dataStatus}. Click to inspect.`}
            >
              <span
                className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  isLive
                    ? "bg-pos"
                    : isConnecting || isReconnecting
                    ? "bg-mdata animate-pulse"
                    : "bg-muted-foreground/40"
                )}
              />
              <span className="font-mono-num text-[10.5px] font-semibold text-foreground/90">
                {providerLabel}
                {latency != null && Number.isFinite(latency) && ` · ${Math.round(latency)}ms`}
              </span>
            </button>
          )}
        </PopoverTrigger>
        <PopoverContent
          align="start"
          side="top"
          sideOffset={6}
          className="w-[320px] p-3 zt-popover-terminal border border-border/80 bg-panel text-foreground shadow-2xl rounded-[6px]"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-border/60">
            <div className="flex items-center gap-1.5">
              <Database className="h-3.5 w-3.5 text-mdata" />
              <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                DATA CONNECTIONS
              </span>
            </div>
            <span
              className={cn(
                "font-mono-num text-[10px] px-1.5 py-0.5 rounded font-medium flex items-center gap-1",
                isLive
                  ? "bg-pos/15 text-pos"
                  : isConnecting || isReconnecting
                  ? "bg-mdata/15 text-mdata"
                  : "bg-secondary text-muted-foreground"
              )}
            >
              {isLive ? <Wifi className="h-2.5 w-2.5" /> : <WifiOff className="h-2.5 w-2.5" />}
              {dataStatus}
            </span>
          </div>

          {/* Active Feed Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                ACTIVE FEED
              </span>
              <span className="text-[9.5px] text-pos font-semibold flex items-center gap-1">
                <ShieldCheck className="h-3 w-3" /> READ ONLY
              </span>
            </div>

            <div className="p-2.5 rounded-[5px] border border-border/60 bg-base/50 space-y-1.5">
              <div className="flex items-center justify-between">
                <b className="text-[11.5px] font-semibold text-foreground">{activeConnector.name}</b>
                <span className="text-[10px] font-mono-num text-muted-foreground">{activeConnector.transport}</span>
              </div>

              {/* Feed Diagnostics Table */}
              <div className="grid grid-cols-2 gap-x-2 gap-y-1 pt-1 border-t border-border/40 font-mono-num text-[10px]">
                <div>
                  <span className="text-muted-foreground text-[9px] block">INSTRUMENT</span>
                  <b className="text-foreground">{symbol} (Perp)</b>
                </div>
                <div>
                  <span className="text-muted-foreground text-[9px] block">LATENCY</span>
                  <b>{latency != null && Number.isFinite(latency) ? `${Math.round(latency)} ms` : "Unavailable"}</b>
                </div>
                <div>
                  <span className="text-muted-foreground text-[9px] block">LAST UPDATE</span>
                  <span className="text-foreground/90">{lastUpdate || "—"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground text-[9px] block">TRANSPORT</span>
                  <span className="text-foreground/90">{activeConnector.transport}</span>
                </div>
              </div>

              {reason && (
                <p className="text-[9.5px] text-warn pt-1 border-t border-border/40">
                  {reason}
                </p>
              )}
            </div>

            {/* Provider Capabilities */}
            <div className="pt-1.5 space-y-1">
              <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground block">
                CAPABILITIES
              </span>
              <div className="grid grid-cols-2 gap-1 text-[10px]">
                {[
                  { label: "Live trades", supported: true },
                  { label: "OHLCV", supported: true },
                  { label: "Funding rate", supported: activeProvider === "gateio" || activeProvider === "binance" },
                  { label: "Open interest", supported: activeProvider === "gateio" || activeProvider === "binance" },
                  { label: "Level 2 depth", supported: false },
                  { label: "Historical tick", supported: false },
                ].map((cap) => (
                  <div key={cap.label} className="flex items-center gap-1.5">
                    <span className={cap.supported ? "text-pos font-semibold" : "text-muted-foreground/50"}>
                      {cap.supported ? "✓" : "—"}
                    </span>
                    <span className={cap.supported ? "text-foreground/90" : "text-muted-foreground/60"}>
                      {cap.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Add Connection Action */}
          <div className="mt-3 pt-2 border-t border-border/60">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setAddOpen(true)}
              className="w-full h-7 text-xs flex items-center justify-center gap-1.5 bg-secondary/40 hover:bg-secondary border-border/80"
            >
              <Plus className="h-3 w-3" />
              <span>Add data connection</span>
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <AddConnectionDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onOpenLocalDatasets={() => window.dispatchEvent(new Event("zterminal:open-quote-manager"))}
      />
    </>
  );
}
