"use client";

import { useMemo, useState } from "react";
import {
  Activity,
  Calculator,
  ChevronRight,
  Clock,
  Globe,
  Palette,
  RotateCcw,
  Settings2,
  ShieldAlert,
  SlidersHorizontal,
} from "lucide-react";
import {
  useLayout,
  type RightTabId,
  type TerminalAppearance,
  APPEARANCE_PRESETS,
  DEFAULT_APPEARANCE,
} from "@/stores/layout";
import { useWorkspace, type ChartTimezone } from "@/stores/workspace";
import { getContract } from "@/lib/market/contracts";
import { useMarketStream } from "@/hooks/use-market-stream";
import { calculateFixedRiskSizing } from "@/domain/risk/sizing";
import { cn } from "@/lib/utils";

const TIMEZONE_OPTIONS: { value: ChartTimezone; label: string }[] = [
  { value: "America/New_York", label: "New York (ET)" },
  { value: "UTC", label: "UTC" },
  { value: "Europe/London", label: "London (GMT)" },
  { value: "Asia/Dubai", label: "Dubai (GST)" },
];

export function RightPanel() {
  const { rightTab, setRightTab, toggleRightPanel, appearance, updateAppearance, resetLayout } =
    useLayout();
  const { symbol, timezone, setTimezone } = useWorkspace();
  const contract = getContract(symbol);
  const { quote, lastTrade, derivatives, dataStatus, provider, health, reason } = useMarketStream(
    symbol,
    { trades: 100, depth: false }
  );

  // Risk Calculator State
  const [accountEquity, setAccountEquity] = useState(100_000);
  const [riskPercent, setRiskPercent] = useState(1.0);
  const [stopDistance, setStopDistance] = useState(150);

  const sizingResult = useMemo(() => {
    return calculateFixedRiskSizing({
      accountEquity,
      riskPercent,
      stopDistance,
      tickSize: contract.tickSize,
      multiplier: contract.multiplier,
    });
  }, [accountEquity, riskPercent, stopDistance, contract.tickSize, contract.multiplier]);

  const livePrice = lastTrade?.price ?? derivatives?.markPrice ?? null;

  return (
    <div className="flex h-full flex-col bg-panel border-l hairline select-none overflow-hidden">
      {/* Panel Header */}
      <div className="flex h-9 shrink-0 items-center justify-between border-b hairline px-2 bg-panel/80 backdrop-blur-sm">
        <div className="flex items-center gap-1">
          <TabButton
            active={rightTab === "context"}
            onClick={() => setRightTab("context")}
            title="Market Context & Feed"
          >
            <Activity className="h-3.5 w-3.5" />
            <span>Market Context</span>
          </TabButton>
          <TabButton
            active={rightTab === "risk"}
            onClick={() => setRightTab("risk")}
            title="Risk Planning & Sizing"
          >
            <ShieldAlert className="h-3.5 w-3.5" />
            <span>Risk</span>
          </TabButton>
          <TabButton
            active={rightTab === "settings"}
            onClick={() => setRightTab("settings")}
            title="Workspace Preferences"
          >
            <Settings2 className="h-3.5 w-3.5" />
            <span>Settings</span>
          </TabButton>
        </div>

        <button
          type="button"
          onClick={toggleRightPanel}
          className="flex h-6 w-6 items-center justify-center rounded hover:bg-surface text-muted-foreground hover:text-foreground transition-colors"
          title="Collapse Right Panel"
          aria-label="Collapse Right Panel"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 min-h-0 overflow-y-auto scroll-thin p-3">
        {rightTab === "context" && (
          <div className="space-y-4">
            {/* Header info */}
            <div className="rounded border hairline bg-surface/30 p-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-mono text-xs font-bold text-foreground">{symbol}</h4>
                  <div className="text-[10px] text-muted-foreground">{contract.description}</div>
                </div>
                <span
                  className={cn(
                    "text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider",
                    dataStatus === "LIVE"
                      ? "bg-pos/15 text-pos border border-pos/30"
                      : "bg-surface text-muted-foreground border hairline"
                  )}
                >
                  {dataStatus}
                </span>
              </div>
            </div>

            {/* Price & Spread Stats */}
            <div className="space-y-1.5">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Market Telemetry
              </div>
              <div className="divide-y hairline divide-border/30 rounded border hairline bg-surface/20 text-[11px]">
                <ContextRow
                  label="Last Price"
                  value={
                    livePrice ? `$${livePrice.toLocaleString()}` : "—"
                  }
                  highlight
                />
                <ContextRow
                  label="Best Bid"
                  value={quote?.bid ? `$${quote.bid.toLocaleString()}` : "—"}
                />
                <ContextRow
                  label="Best Ask"
                  value={quote?.ask ? `$${quote.ask.toLocaleString()}` : "—"}
                />
                <ContextRow
                  label="Spread"
                  value={
                    quote ? `$${(quote.ask - quote.bid).toFixed(2)}` : "Awaiting quote"
                  }
                />
                <ContextRow
                  label="Mark Price"
                  value={
                    derivatives?.markPrice
                      ? `$${derivatives.markPrice.toLocaleString()}`
                      : "—"
                  }
                />
                <ContextRow
                  label="Funding Rate"
                  value={
                    derivatives?.fundingRate !== undefined
                      ? `${(derivatives.fundingRate * 100).toFixed(4)}%`
                      : "Unavailable"
                  }
                />
                <ContextRow label="Provider" value={provider?.toUpperCase() ?? "BINANCE"} />
              </div>
            </div>

            {/* Contract Specifications */}
            <div className="space-y-1.5">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Contract Specifications
              </div>
              <div className="divide-y hairline divide-border/30 rounded border hairline bg-surface/20 text-[11px]">
                <ContextRow label="Product Type" value={contract.product.toUpperCase()} />
                <ContextRow label="Exchange" value={contract.exchange} />
                <ContextRow label="Tick Size" value={contract.tickSize.toString()} />
                <ContextRow label="Tick Value" value={`$${contract.tickValue}`} />
                <ContextRow label="Multiplier" value={contract.multiplier.toString()} />
                <ContextRow label="Currency" value={contract.currency} />
              </div>
            </div>

            {/* Provenance note */}
            <div className="rounded border hairline bg-surface/20 p-2 text-[9.5px] text-muted-foreground leading-relaxed">
              ZTerminal enforces strict data integrity: order-flow metrics are only rendered from
              verified continuous streams. Synthetic or padded candles are rejected.
            </div>
          </div>
        )}

        {rightTab === "risk" && (
          <div className="space-y-4">
            <div>
              <h4 className="text-[11px] font-semibold tracking-wide uppercase text-foreground">
                Fixed-Risk Sizing Calculator
              </h4>
              <p className="text-[9.5px] text-muted-foreground mt-0.5">
                Deterministic position sizing based on strict risk capital budget
              </p>
            </div>

            {/* Inputs */}
            <div className="space-y-3 rounded border hairline bg-surface/30 p-3">
              <label className="block text-[10.5px]">
                <div className="flex justify-between text-muted-foreground mb-1">
                  <span>Account Equity</span>
                  <span className="font-mono text-foreground">${accountEquity.toLocaleString()}</span>
                </div>
                <input
                  type="number"
                  step="1000"
                  value={accountEquity}
                  onChange={(e) => setAccountEquity(Number(e.target.value))}
                  className="w-full rounded bg-surface border hairline px-2 py-1 font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </label>

              <label className="block text-[10.5px]">
                <div className="flex justify-between text-muted-foreground mb-1">
                  <span>Risk Per Trade (%)</span>
                  <span className="font-mono text-foreground">{riskPercent}%</span>
                </div>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="10"
                  value={riskPercent}
                  onChange={(e) => setRiskPercent(Number(e.target.value))}
                  className="w-full rounded bg-surface border hairline px-2 py-1 font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </label>

              <label className="block text-[10.5px]">
                <div className="flex justify-between text-muted-foreground mb-1">
                  <span>Stop Loss Distance (Points)</span>
                  <span className="font-mono text-foreground">{stopDistance} pts</span>
                </div>
                <input
                  type="number"
                  step="1"
                  min="1"
                  value={stopDistance}
                  onChange={(e) => setStopDistance(Number(e.target.value))}
                  className="w-full rounded bg-surface border hairline px-2 py-1 font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </label>
            </div>

            {/* Sizing Output Cards */}
            <div className="space-y-2">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Sizing Recommendations
              </div>

              <div className="rounded border hairline bg-accent/10 border-accent/30 p-3">
                <div className="text-[9.5px] uppercase tracking-wider text-accent font-medium">
                  Max Allowable Position Size
                </div>
                <div className="font-mono text-xl font-bold text-foreground mt-1">
                  {sizingResult.maxQuantity}{" "}
                  <span className="text-xs font-normal text-muted-foreground">Contracts / Units</span>
                </div>
                <div className="text-[10px] text-muted-foreground mt-1">
                  Bounded by ${sizingResult.riskAmount.toLocaleString()} max risk limit
                </div>
              </div>

              <div className="divide-y hairline divide-border/30 rounded border hairline bg-surface/20 text-[11px]">
                <ContextRow
                  label="Capital at Risk"
                  value={`$${sizingResult.riskAmount.toLocaleString()}`}
                  highlight
                />
                <ContextRow
                  label="Risk Per Contract"
                  value={`$${sizingResult.perUnitRisk.toLocaleString()}`}
                />
                <ContextRow
                  label="Stop Distance (Ticks)"
                  value={`${sizingResult.stopTicks.toFixed(0)} ticks`}
                />
              </div>
            </div>
          </div>
        )}

        {rightTab === "settings" && (
          <div className="space-y-4">
            <div>
              <h4 className="text-[11px] font-semibold tracking-wide uppercase text-foreground">
                Terminal Preferences
              </h4>
              <p className="text-[9.5px] text-muted-foreground mt-0.5">
                Saved locally in browser storage
              </p>
            </div>

            {/* Presets */}
            <div className="space-y-1.5">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Color Presets
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {Object.keys(APPEARANCE_PRESETS).map((name) => {
                  const p = APPEARANCE_PRESETS[name];
                  const isSelected = appearance.preset === name;
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => updateAppearance({ preset: name, ...p })}
                      className={cn(
                        "flex items-center gap-1.5 p-2 rounded border text-[11px] font-medium transition-all text-left",
                        isSelected
                          ? "border-accent bg-accent/10 text-foreground"
                          : "border-border/60 hover:border-border hover:bg-surface/50 text-muted-foreground"
                      )}
                    >
                      <span
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: p.accent }}
                      />
                      <span>{name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Timezone */}
            <div className="space-y-1.5">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Chart Timezone
              </div>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value as ChartTimezone)}
                className="w-full rounded bg-surface border hairline px-2 py-1.5 text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
              >
                {TIMEZONE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Density */}
            <div className="space-y-1.5">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Layout Density
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => updateAppearance({ density: "compact" })}
                  className={cn(
                    "p-2 rounded border text-[11px] font-medium transition-all text-center",
                    appearance.density === "compact"
                      ? "border-accent bg-accent/10 text-foreground"
                      : "border-border/60 text-muted-foreground"
                  )}
                >
                  Compact
                </button>
                <button
                  type="button"
                  onClick={() => updateAppearance({ density: "comfortable" })}
                  className={cn(
                    "p-2 rounded border text-[11px] font-medium transition-all text-center",
                    appearance.density === "comfortable"
                      ? "border-accent bg-accent/10 text-foreground"
                      : "border-border/60 text-muted-foreground"
                  )}
                >
                  Comfortable
                </button>
              </div>
            </div>

            {/* Grid Opacity Slider */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span className="font-semibold uppercase tracking-wider">Grid Intensity</span>
                <span className="font-mono">{appearance.gridOpacity}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="20"
                value={appearance.gridOpacity}
                onChange={(e) => updateAppearance({ gridOpacity: Number(e.target.value) })}
                className="w-full accent-accent"
              />
            </div>

            {/* Reset */}
            <div className="pt-2 border-t hairline">
              <button
                type="button"
                onClick={resetLayout}
                className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Reset layout & appearance to default</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        "flex items-center gap-1.5 px-2 py-1 rounded text-[11px] transition-colors",
        active
          ? "bg-surface text-foreground font-medium shadow-xs"
          : "text-muted-foreground hover:text-foreground hover:bg-surface/50"
      )}
    >
      {children}
    </button>
  );
}

function ContextRow({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between px-2.5 py-1.5">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-mono font-medium", highlight ? "text-accent" : "text-foreground")}>
        {value}
      </span>
    </div>
  );
}
