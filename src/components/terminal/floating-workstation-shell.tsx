"use client";

import { useEffect, useState, type ReactNode } from "react";
import Image from "next/image";
import {
  CalendarDays,
  Code2,
  Search,
  Settings2,
  Plus,
} from "lucide-react";
import { InstrumentPicker } from "./instrument-picker";
import { WorkspaceDockProvider, useWorkspaceDock } from "./docking/workspace-dock-controller";
import { TerminalErrorBoundary } from "./terminal-error-boundary";
import { TerminalShortcuts } from "./terminal-shortcuts";
import { CommandPalette } from "./command-palette";
import { useSession } from "next-auth/react";
import { useAuthHealth } from "@/components/auth/session-provider";
import { useCloudSyncStatus } from "@/stores/cloud-sync-status";
import { AccountPanel } from "./account-panel";
import { useWorkspace } from "@/stores/workspace";
import { useMarketStream } from "@/hooks/use-market-stream";
import { CloudSyncBridge } from "@/components/auth/cloud-sync-bridge";
import { MobileResearchMenu, ResearchSidebar } from "./research-sidebar";
import { cn } from "@/lib/utils";
import { DynamicWorkspaceDock } from "./docking";
import { TerminalAppearanceBridge } from "./terminal-appearance-bridge";
import { useTerminalAppearance } from "@/stores/terminal-appearance";
import { PANEL_DEFINITIONS, WORKSPACE_LAYOUT_KEY, type DockPanelId } from "@/lib/workspace-dock-layout";
import { useWorkspaceDockSession } from "@/components/workspaces/session-context";

/**
 * The public terminal uses one reference-led windowed workstation. Existing P0
 * chart and stream components remain inside it, so visual restoration never
 * substitutes an archived client or simulated market state.
 */
export function FloatingWorkstationShell({ managed = false, name, workspaceControls, readOnly = false }: { managed?: boolean; name?: string; workspaceControls?: ReactNode; readOnly?: boolean }) {
  const session = useWorkspaceDockSession();
  return <TerminalErrorBoundary resetLayout={session ? () => session.removeItem(WORKSPACE_LAYOUT_KEY) : undefined}><WorkspaceDockProvider><Workstation managed={managed} name={name} workspaceControls={workspaceControls} readOnly={readOnly} /></WorkspaceDockProvider></TerminalErrorBoundary>;
}

function Workstation({ managed, name, workspaceControls, readOnly }: { managed: boolean; name?: string; workspaceControls?: ReactNode; readOnly: boolean }) {
  const dock = useWorkspaceDock();
  const { data: session, status } = useSession();
  const authHealth = useAuthHealth();
  const syncStatus = useCloudSyncStatus(state => state.status);
  const displayName = session?.user?.name || session?.user?.email || "Account";
  const { symbol, sidebarCollapsed } = useWorkspace();
  const { provider, dataStatus } = useMarketStream(symbol, { trades: 1, depth: false });
  const [accountOpen, setAccountOpen] = useState(false);
  const material = useTerminalAppearance(state => state.appearance.material);
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


  return (
    <div data-terminal-material={material} className="zt-reference-terminal h-[100dvh] w-screen overflow-hidden text-foreground">
      <TerminalAppearanceBridge />{!managed && <CloudSyncBridge />}{!readOnly && <><CommandPalette /><TerminalShortcuts /></>}
      <header className="zt-reference-header" aria-label="Terminal header">
        <div className="contents" inert={readOnly}>
        <button type="button" className="zt-reference-mark" onClick={() => dock.focusPanel("chart")} aria-label="Focus chart workspace" title="Chart workspace">
          <Image src="/brand/zterminal-mark-kit-v1.png" alt="" width={24} height={24} priority />
        </button>
        <MobileResearchMenu />
        <span className="zt-header-separator" aria-hidden="true" />
        <InstrumentPicker />
        </div>
        {workspaceControls ?? <div className="zt-workspace-label hidden lg:block"><b>{name ?? "RESEARCH WORKSPACE"}</b><span>Write / backtest / inspect</span></div>}
        <div className="ml-auto flex items-center gap-1.5" inert={readOnly}>
          {managed && <details className="ws-add-panel"><summary aria-label="Add panel"><Plus size={15} /><span>Add panel</span></summary><div>{Object.entries(PANEL_DEFINITIONS).map(([id, panel]) => <button key={id} onClick={event => { dock.openPanel(id as DockPanelId); event.currentTarget.closest("details")?.removeAttribute("open"); }}>{panel.title}</button>)}</div></details>}
          <button type="button" className="zt-header-icon" onClick={() => dock.openPanel("calendar")} aria-label="Open economic calendar" title="Economic calendar"><CalendarDays /></button>
          <button type="button" className="zt-header-icon" onClick={() => dock.openPanel("strategy")} aria-label="Open Python strategy developer" title="Python strategy developer"><Code2 /></button>
          <button type="button" className="zt-header-icon" onClick={() => window.dispatchEvent(new Event("zterminal:open-symbol-picker"))} aria-label="Search verified markets" title="Search verified markets"><Search /></button>
          <button type="button" className="zt-header-icon" onClick={() => dock.openPanel("settings")} aria-label="Terminal preferences" title="Terminal preferences"><Settings2 /></button>
          <button type="button" className="zt-research-account" onClick={() => setAccountOpen((open) => !open)} aria-expanded={accountOpen} aria-label="Open research account information">{session?.user?.image ? <img src={session.user.image} alt="" referrerPolicy="no-referrer" /> : <span aria-hidden="true">{status === "authenticated" ? displayName[0].toUpperCase() : "○"}</span>}<div className="hidden sm:block"><b>{status === "authenticated" ? displayName : authHealth.phase === "error" ? "Session unavailable" : status === "loading" ? "Checking session…" : "Local workspace"}</b><small>{status === "authenticated" ? syncStatus : authHealth.phase === "error" ? "Retry account verification" : status === "loading" ? "" : "On this device"}</small></div></button>
          {accountOpen && <AccountPanel symbol={symbol} provider={provider} dataStatus={dataStatus} onClose={() => setAccountOpen(false)} />}
        </div>
      </header>
      <div className={cn("zt-reference-body", sidebarCollapsed && "is-collapsed")} data-sidebar-collapsed={sidebarCollapsed} inert={readOnly}>
        <ResearchSidebar />
        <main className="min-h-0 min-w-0 overflow-hidden" aria-label="Market research workspace"><DynamicWorkspaceDock /></main>
      </div>
    </div>
  );
}
