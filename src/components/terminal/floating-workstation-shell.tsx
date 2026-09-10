"use client";

import { useEffect } from "react";
import Image from "next/image";
import { InstrumentPicker } from "./instrument-picker";
import { ReferenceChartWorkspace } from "./reference-chart-workspace";
import { GlobalControls } from "./global-controls";
import { TerminalStatusBar } from "./terminal-status-bar";
import { useWorkspace } from "@/stores/workspace";
import { useMarketStream } from "@/hooks/use-market-stream";
import { CloudSyncBridge } from "@/components/auth/cloud-sync-bridge";
import { MobileResearchMenu, ResearchSidebar } from "./research-sidebar";
import { CommandPalette } from "./command-palette";
import { cn } from "@/lib/utils";
import { usePanels } from "@/stores/panels";

/**
 * The public terminal uses one reference-led windowed workstation. Existing P0
 * chart and stream components remain inside it, so visual restoration never
 * substitutes an archived client or simulated market state.
 */
export function FloatingWorkstationShell() {
  const { symbol, timeframe, sidebarCollapsed, setCommandOpen } = useWorkspace();
  const { provider, dataStatus } = useMarketStream(symbol, { trades: 1, depth: false });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const editable = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;
      if (!editable && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "b") {
        event.preventDefault();
        useWorkspace.getState().toggleSidebar();
      }
      if (!editable && event.key === "/") {
        event.preventDefault();
        window.dispatchEvent(new Event("zterminal:open-symbol-picker"));
      }
      if (!editable && event.altKey && event.key === "Enter") {
        event.preventDefault();
        const panel = usePanels.getState().panels.chart;
        if (panel) usePanels.getState().patch("chart", { maximized: !panel.maximized, status: "open" });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [setCommandOpen]);

  return (
    <div className="zt-reference-terminal h-[100dvh] w-screen overflow-hidden text-foreground flex flex-col">
      <CloudSyncBridge />
      <header className="zt-reference-header flex-shrink-0" aria-label="Terminal header">
        <button type="button" className="zt-reference-mark" onClick={() => window.dispatchEvent(new Event("zterminal:focus-chart"))} aria-label="Focus chart workspace" title="Chart workspace">
          <Image src="/brand/zterminal-mark-v2.png" alt="" width={24} height={24} priority />
        </button>
        <MobileResearchMenu />
        <span className="zt-header-separator" aria-hidden="true" />
        <InstrumentPicker />
        <div className="zt-workspace-label hidden lg:flex" title="Write / backtest / inspect"><b>RESEARCH WORKSPACE</b><span>Write / backtest / inspect</span></div>
        <GlobalControls
          symbol={symbol}
          timeframe={timeframe}
          provider={provider}
          dataStatus={dataStatus}
        />
      </header>
      <div className={cn("zt-reference-body flex-1 min-h-0", sidebarCollapsed && "is-collapsed")} data-sidebar-collapsed={sidebarCollapsed}>
        <ResearchSidebar />
        <main className="min-h-0 min-w-0 overflow-hidden" aria-label="Market research workspace"><ReferenceChartWorkspace /></main>
      </div>
      <TerminalStatusBar />
      <CommandPalette />
    </div>
  );
}
