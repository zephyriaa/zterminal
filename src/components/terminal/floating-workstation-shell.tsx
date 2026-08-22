"use client";

import { useEffect } from "react";
import Image from "next/image";
import {
  Activity,
  ChartNoAxesCombined,
  FlaskConical,
  Layers3,
  RotateCcw,
  Settings2,
  SlidersHorizontal,
} from "lucide-react";
import { InstrumentPicker } from "./instrument-picker";
import { ReferenceChartWorkspace } from "./reference-chart-workspace";
import { useWorkspace } from "@/stores/workspace";
import { useMarketStream } from "@/hooks/use-market-stream";
import { cn } from "@/lib/utils";

function formatPrice(value: number | undefined | null) {
  return value == null || !Number.isFinite(value) ? "—" : value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * The public terminal uses one reference-led windowed workstation. Existing P0
 * chart and stream components remain inside it, so visual restoration never
 * substitutes an archived client or simulated market state.
 */
export function FloatingWorkstationShell() {
  const { symbol } = useWorkspace();
  const { lastTrade, derivatives, provider, dataStatus } = useMarketStream(symbol, { trades: 1, depth: false });
  const price = lastTrade?.price ?? derivatives?.markPrice;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const editable = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;
      if (!editable && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        window.dispatchEvent(new Event("zterminal:open-symbol-picker"));
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="zt-reference-terminal h-[100dvh] w-screen overflow-hidden text-foreground">
      <header className="zt-reference-header" aria-label="Terminal header">
        <button type="button" className="zt-reference-mark" onClick={() => window.dispatchEvent(new Event("zterminal:focus-chart"))} aria-label="Focus chart workspace" title="Chart workspace">
          <Image src="/brand/zterminal-mark-v2.png" alt="" width={24} height={24} priority />
        </button>
        <span className="zt-header-separator" aria-hidden="true" />
        <InstrumentPicker />
        <div className="zt-header-market hidden md:flex">
          <span>{provider?.toUpperCase() ?? "BINANCE"} · USDⓈ-M</span>
          <b>{formatPrice(price)}</b>
          <em className={cn(dataStatus === "LIVE" ? "is-positive" : "")}>{dataStatus === "LIVE" ? "OBSERVED" : "RESEARCH"}</em>
        </div>
        <div className="zt-workspace-label hidden lg:block"><b>FLOATING WORKSTATION</b><span>Drag windows to arrange</span></div>
        <div className="ml-auto flex items-center gap-1.5">
          <button type="button" className="zt-header-icon" onClick={() => window.dispatchEvent(new Event("zterminal:open-symbol-picker"))} aria-label="Search verified markets" title="Search verified markets"><SlidersHorizontal /></button>
          <button type="button" className="zt-header-icon" onClick={() => window.dispatchEvent(new Event("zterminal:open-settings"))} aria-label="Terminal settings" title="Terminal settings"><Settings2 /></button>
          <div className="zt-research-account"><span>R</span><div className="hidden sm:block"><b>Research mode</b><small>Read only</small></div></div>
        </div>
      </header>
      <div className="zt-reference-body">
        <nav className="zt-reference-toolrail" aria-label="Research tools">
          <RailButton label="Studies" onClick={() => window.dispatchEvent(new Event("zterminal:open-studies"))}><Layers3 /></RailButton>
          <RailButton label="Strategy and backtesting" onClick={() => window.dispatchEvent(new Event("zterminal:open-strategy"))}><FlaskConical /></RailButton>
          <RailButton label="Market context" onClick={() => window.dispatchEvent(new Event("zterminal:open-context"))}><SlidersHorizontal /></RailButton>
          <RailButton label="Observed order flow" onClick={() => window.dispatchEvent(new Event("zterminal:open-flow"))}><ChartNoAxesCombined /></RailButton>
          <span className="zt-rail-divider" aria-hidden="true" />
          <RailButton label="Reset workspace layout" onClick={() => window.dispatchEvent(new Event("zterminal:reset-layout"))}><RotateCcw /></RailButton>
          <RailButton label="Feed details" onClick={() => window.dispatchEvent(new Event("zterminal:open-context"))}><Activity /></RailButton>
        </nav>
        <main className="min-h-0 min-w-0 overflow-hidden" aria-label="Floating market research canvas"><ReferenceChartWorkspace /></main>
      </div>
    </div>
  );
}

function RailButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" className="zt-reference-rail-button" onClick={onClick} aria-label={label} title={label}>{children}</button>;
}
