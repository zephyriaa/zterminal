"use client";

import { useEffect } from "react";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { CommandPalette } from "./command-palette";
import { useWorkspace, type ViewId } from "@/stores/workspace";

import { ChartView } from "@/components/views/chart-view";
import { MarketsView } from "@/components/views/markets-view";
import { StrategyView } from "@/components/views/strategy-view";
import { BacktesterView } from "@/components/views/backtester-view";
import { OrderFlowView } from "@/components/views/orderflow-view";
import {
  CalendarView,
  AlertsView,
  ResearchView,
  PortfolioView,
  RiskView,
  JournalView,
  ConnectionsView,
  SettingsView,
} from "@/components/views/secondary-views";

const REGISTRY: Record<ViewId, React.ComponentType> = {
  chart: ChartView,
  markets: MarketsView,
  strategy: StrategyView,
  backtester: BacktesterView,
  orderflow: OrderFlowView,
  calendar: CalendarView,
  alerts: AlertsView,
  research: ResearchView,
  portfolio: PortfolioView,
  risk: RiskView,
  journal: JournalView,
  connections: ConnectionsView,
  settings: SettingsView,
};

// Per-view global keyboard shortcuts (single-letter where no conflict).
const SHORTCUTS: Record<string, ViewId> = {
  "g c": "chart",
  "g s": "strategy",
  "g b": "backtester",
  "g o": "orderflow",
  "g m": "markets",
};

export function WorkspaceShell() {
  const { activeView, setView, setCommandOpen } = useWorkspace();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const editable =
        tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable;

      // Esc closes command palette handled elsewhere.
      if (!editable) {
        if (e.key === "?") {
          setCommandOpen(true);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setCommandOpen]);

  const Active = REGISTRY[activeView] ?? ChartView;

  return (
    <div className="h-screen w-screen flex bg-background text-foreground overflow-hidden">
      <div className="hidden shrink-0 sm:block"><Sidebar /></div>
      <div className="flex-1 min-w-0 flex flex-col">
        <Topbar />
        <main className="flex-1 min-h-0 overflow-hidden relative">
          <Active />
        </main>
      </div>
      <CommandPalette />
    </div>
  );
}

export { SHORTCUTS };
