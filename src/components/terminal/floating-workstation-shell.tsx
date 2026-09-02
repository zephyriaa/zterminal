"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  Activity,
  BarChart3,
  CalendarDays,
  Code2,
  FlaskConical,
  Layers3,
  RotateCcw,
  Search,
  Settings2,
  SlidersHorizontal,
} from "lucide-react";
import { InstrumentPicker } from "./instrument-picker";
import { ReferenceChartWorkspace } from "./reference-chart-workspace";
import { AccountPanel } from "./account-panel";
import { useWorkspace } from "@/stores/workspace";
import { useMarketStream } from "@/hooks/use-market-stream";
import { CloudSyncBridge } from "@/components/auth/cloud-sync-bridge";

/**
 * The public terminal uses one reference-led windowed workstation. Existing P0
 * chart and stream components remain inside it, so visual restoration never
 * substitutes an archived client or simulated market state.
 */
export function FloatingWorkstationShell() {
  const { symbol } = useWorkspace();
  const { provider, dataStatus } = useMarketStream(symbol, { trades: 1, depth: false });
  const [accountOpen, setAccountOpen] = useState(false);

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
      <CloudSyncBridge />
      <header className="zt-reference-header" aria-label="Terminal header">
        <button type="button" className="zt-reference-mark" onClick={() => window.dispatchEvent(new Event("zterminal:focus-chart"))} aria-label="Focus chart workspace" title="Chart workspace">
          <Image src="/brand/zterminal-mark-v2.png" alt="" width={24} height={24} priority />
        </button>
        <span className="zt-header-separator" aria-hidden="true" />
        <InstrumentPicker />
        <div className="zt-workspace-label hidden lg:block"><b>FLOATING WORKSTATION</b><span>Drag windows to arrange</span></div>
        <div className="ml-auto flex items-center gap-1.5">
          <button type="button" className="zt-header-icon" onClick={() => window.dispatchEvent(new Event("zterminal:open-calendar"))} aria-label="Open economic calendar" title="Economic calendar"><CalendarDays /></button>
          <button type="button" className="zt-header-icon" onClick={() => window.dispatchEvent(new Event("zterminal:open-strategy"))} aria-label="Open Python strategy developer" title="Python strategy developer"><Code2 /></button>
          <button type="button" className="zt-header-icon" onClick={() => window.dispatchEvent(new Event("zterminal:open-symbol-picker"))} aria-label="Search verified markets" title="Search verified markets"><Search /></button>
          <button type="button" className="zt-header-icon" onClick={() => window.dispatchEvent(new Event("zterminal:open-terminal-settings"))} aria-label="Terminal preferences" title="Terminal preferences"><Settings2 /></button>
          <button type="button" className="zt-research-account" onClick={() => setAccountOpen((open) => !open)} aria-expanded={accountOpen} aria-label="Open research account information"><span>R</span><div className="hidden sm:block"><b>Research mode</b><small>Read only</small></div></button>
          {accountOpen && <AccountPanel symbol={symbol} provider={provider} dataStatus={dataStatus} onClose={() => setAccountOpen(false)} />}
        </div>
      </header>
      <div className="zt-reference-body">
        <nav className="zt-reference-toolrail" aria-label="Research tools">
          <RailButton label="Indicators" onClick={() => window.dispatchEvent(new Event("zterminal:open-indicators"))}><Layers3 /></RailButton>
          <RailButton label="Strategy and backtesting" onClick={() => window.dispatchEvent(new Event("zterminal:open-strategy"))}><FlaskConical /></RailButton>
          <RailButton label="Open local backtester" onClick={() => window.dispatchEvent(new Event("zterminal:open-backtester"))}><BarChart3 /></RailButton>
          <RailButton label="Market context" onClick={() => window.dispatchEvent(new Event("zterminal:open-context"))}><SlidersHorizontal /></RailButton>
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
