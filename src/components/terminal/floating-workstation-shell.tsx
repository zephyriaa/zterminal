"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  CalendarDays,
  Code2,
  Search,
  Settings2,
} from "lucide-react";
import { InstrumentPicker } from "./instrument-picker";
import { WorkspaceDockProvider, useWorkspaceDock } from "./docking/workspace-dock-controller";
import { TerminalErrorBoundary } from "./terminal-error-boundary";
import { CommandPalette } from "./command-palette";
import { useSession } from "next-auth/react";
import { useCloudSyncStatus } from "@/stores/cloud-sync-status";
import { AccountPanel } from "./account-panel";
import { useWorkspace } from "@/stores/workspace";
import { useMarketStream } from "@/hooks/use-market-stream";
import { CloudSyncBridge } from "@/components/auth/cloud-sync-bridge";
import { MobileResearchMenu, ResearchSidebar } from "./research-sidebar";
import { cn } from "@/lib/utils";
import { DynamicWorkspaceDock } from "./docking";

/**
 * The public terminal uses one reference-led windowed workstation. Existing P0
 * chart and stream components remain inside it, so visual restoration never
 * substitutes an archived client or simulated market state.
 */
export function FloatingWorkstationShell() {
  return <TerminalErrorBoundary><WorkspaceDockProvider><Workstation /></WorkspaceDockProvider></TerminalErrorBoundary>;
}

function Workstation() {
  const dock = useWorkspaceDock();
  const { data: session, status } = useSession();
  const syncStatus = useCloudSyncStatus(state => state.status);
  const displayName = session?.user?.name || session?.user?.email || "Account";
  const { symbol, sidebarCollapsed } = useWorkspace();
  const { provider, dataStatus } = useMarketStream(symbol, { trades: 1, depth: false });
  const [accountOpen, setAccountOpen] = useState(false);
  useEffect(() => {
    document.body.dataset.terminal = "true";
    const params = new URLSearchParams(window.location.search);
    setAccountOpen(params.has("account") || params.has("error"));
    return () => { delete document.body.dataset.terminal; };
  }, []);

  useEffect(() => {
    const research = () => dock.openPanel("research");
    window.addEventListener("zterminal:open-backtester", research);
    return () => window.removeEventListener("zterminal:open-backtester", research);
  }, [dock.openPanel]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const editable = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;

      if (!editable && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "b") {
        event.preventDefault();
        useWorkspace.getState().toggleSidebar();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="zt-reference-terminal h-[100dvh] w-screen overflow-hidden text-foreground">
      <CloudSyncBridge /><CommandPalette />
      <header className="zt-reference-header" aria-label="Terminal header">
        <button type="button" className="zt-reference-mark" onClick={() => dock.focusPanel("chart")} aria-label="Focus chart workspace" title="Chart workspace">
          <Image src="/brand/zterminal-mark-v2.png" alt="" width={24} height={24} priority />
        </button>
        <MobileResearchMenu />
        <span className="zt-header-separator" aria-hidden="true" />
        <InstrumentPicker />
        <div className="zt-workspace-label hidden lg:block"><b>RESEARCH WORKSPACE</b><span>Write / backtest / inspect</span></div>
        <div className="ml-auto flex items-center gap-1.5">
          <button type="button" className="zt-header-icon" onClick={() => dock.openPanel("calendar")} aria-label="Open economic calendar" title="Economic calendar"><CalendarDays /></button>
          <button type="button" className="zt-header-icon" onClick={() => dock.openPanel("strategy")} aria-label="Open Python strategy developer" title="Python strategy developer"><Code2 /></button>
          <button type="button" className="zt-header-icon" onClick={() => window.dispatchEvent(new Event("zterminal:open-symbol-picker"))} aria-label="Search verified markets" title="Search verified markets"><Search /></button>
          <button type="button" className="zt-header-icon" onClick={() => dock.openPanel("settings")} aria-label="Terminal preferences" title="Terminal preferences"><Settings2 /></button>
          <button type="button" className="zt-research-account" onClick={() => setAccountOpen((open) => !open)} aria-expanded={accountOpen} aria-label="Open research account information">{session?.user?.image ? <img src={session.user.image} alt="" referrerPolicy="no-referrer" /> : <span aria-hidden="true">{status === "authenticated" ? displayName[0].toUpperCase() : "○"}</span>}<div className="hidden sm:block"><b>{status === "authenticated" ? displayName : "Local workspace"}</b><small>{status === "authenticated" ? syncStatus : "On this device"}</small></div></button>
          {accountOpen && <AccountPanel symbol={symbol} provider={provider} dataStatus={dataStatus} onClose={() => setAccountOpen(false)} />}
        </div>
      </header>
      <div className={cn("zt-reference-body", sidebarCollapsed && "is-collapsed")} data-sidebar-collapsed={sidebarCollapsed}>
        <ResearchSidebar />
        <main className="min-h-0 min-w-0 overflow-hidden" aria-label="Market research workspace"><DynamicWorkspaceDock /></main>
      </div>
    </div>
  );
}
