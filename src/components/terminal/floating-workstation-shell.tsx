"use client";

import { useEffect, type ComponentType } from "react";
import {
  Activity,
  BarChart3,
  BookOpen,
  CandlestickChart,
  FlaskConical,
  LineChart,
  Settings2,
} from "lucide-react";
import { CommandPalette } from "./command-palette";
import { Topbar } from "./topbar";
import { useWorkspace, type ViewId } from "@/stores/workspace";
import { ChartView } from "@/components/views/chart-view";
import { MarketsView } from "@/components/views/markets-view";
import { StrategyView } from "@/components/views/strategy-view";
import { BacktesterView } from "@/components/views/backtester-view";
import { OrderFlowView } from "@/components/views/orderflow-view";
import {
  AlertsView,
  CalendarView,
  ConnectionsView,
  JournalView,
  PortfolioView,
  ResearchView,
  RiskView,
  SettingsView,
} from "@/components/views/secondary-views";

const REGISTRY: Record<ViewId, ComponentType> = {
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

const RAIL_ITEMS: Array<{ id: ViewId; label: string; icon: ComponentType<{ className?: string }> }> = [
  { id: "chart", label: "Chart workspace", icon: CandlestickChart },
  { id: "markets", label: "Markets", icon: BarChart3 },
  { id: "orderflow", label: "Order flow", icon: Activity },
  { id: "strategy", label: "Strategy developer", icon: LineChart },
  { id: "backtester", label: "Backtester", icon: FlaskConical },
  { id: "research", label: "Research notes", icon: BookOpen },
];

/**
 * The public terminal deliberately keeps the legacy workstation hierarchy:
 * one compact control bar, a narrow tool rail, and a chart-first canvas.
 * The contents remain the current Next/P0 components, so data availability
 * and withholding rules are not inherited from the archived Vite client.
 */
export function FloatingWorkstationShell() {
  const { activeView, setCommandOpen, setView } = useWorkspace();
  const ActiveView = REGISTRY[activeView] ?? ChartView;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const editable = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;
      if (!editable && event.key === "?") {
        event.preventDefault();
        setCommandOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [setCommandOpen]);

  return (
    <div className="zt-legacy-terminal h-[100dvh] w-screen overflow-hidden text-foreground">
      <Topbar />
      <div className="zt-legacy-workstation">
        <nav className="zt-legacy-toolrail hidden sm:flex" aria-label="Terminal tools">
          {RAIL_ITEMS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className={activeView === id ? "is-active" : undefined}
              onClick={() => setView(id)}
              aria-label={label}
              aria-pressed={activeView === id}
              title={label}
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
          <span className="zt-legacy-rail-divider" aria-hidden="true" />
          <button type="button" onClick={() => setView("settings")} aria-label="Terminal settings" title="Terminal settings">
            <Settings2 className="h-4 w-4" />
          </button>
        </nav>
        <main className="min-w-0 min-h-0 overflow-hidden" aria-label="Floating research workstation">
          <ActiveView />
        </main>
      </div>
      <CommandPalette />
    </div>
  );
}

export const SHORTCUTS: Record<string, ViewId> = {
  "g c": "chart",
  "g s": "strategy",
  "g b": "backtester",
  "g o": "orderflow",
  "g m": "markets",
};
