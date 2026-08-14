"use client";

import {
  Activity,
  Bell,
  Briefcase,
  Calendar,
  CandlestickChart,
  Code2,
  FlaskConical,
  Layers,
  Microscope,
  NotebookPen,
  PanelLeftClose,
  PanelLeftOpen,
  Plug,
  Settings,
  ShieldAlert,
  Waves,
} from "lucide-react";
import { useWorkspace, type ViewId } from "@/stores/workspace";
import { cn } from "@/lib/utils";

interface NavItem {
  id: ViewId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  hint: string;
}

const SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: "Markets",
    items: [
      { id: "markets", label: "Markets", icon: Activity, hint: "Watchlist" },
      { id: "calendar", label: "Calendar", icon: Calendar, hint: "Econ events" },
      { id: "alerts", label: "Alerts", icon: Bell, hint: "Price alerts" },
    ],
  },
  {
    title: "Analysis",
    items: [
      { id: "chart", label: "Chart", icon: CandlestickChart, hint: "Charting" },
      { id: "orderflow", label: "Order Flow", icon: Waves, hint: "DOM / Footprint" },
    ],
  },
  {
    title: "Research",
    items: [
      { id: "strategy", label: "Strategy Builder", icon: Code2, hint: "Code-first IDE" },
      { id: "backtester", label: "Backtester", icon: FlaskConical, hint: "Event-driven" },
      { id: "research", label: "Research Lab", icon: Microscope, hint: "Hypotheses" },
    ],
  },
  {
    title: "Portfolio",
    items: [
      { id: "portfolio", label: "Portfolio", icon: Briefcase, hint: "Positions" },
      { id: "risk", label: "Risk", icon: ShieldAlert, hint: "Sizing / exposure" },
    ],
  },
  {
    title: "Journal",
    items: [{ id: "journal", label: "Journal", icon: NotebookPen, hint: "Trade log" }],
  },
  {
    title: "System",
    items: [
      { id: "connections", label: "Connections", icon: Plug, hint: "Providers" },
      { id: "settings", label: "Settings", icon: Settings, hint: "Preferences" },
    ],
  },
];

export function Sidebar() {
  const { activeView, setView, sidebarCollapsed, toggleSidebar, connection } = useWorkspace();
  const collapsed = sidebarCollapsed;

  return (
    <aside
      className={cn(
        "shrink-0 border-r hairline bg-panel flex flex-col h-full transition-[width] duration-200",
        collapsed ? "w-[52px]" : "w-[208px]"
      )}
      aria-label="Primary navigation"
    >
      {/* Brand */}
      <div className="h-11 flex items-center gap-2 px-3 border-b hairline">
        <img
          src="/brand/zterminal-mark-v2.png"
          alt="Z Terminal"
          className="h-7 w-7 shrink-0 rounded-[7px] object-contain"
        />
        {!collapsed && (
          <img
            src="/brand/zterminal-wordmark.png"
            alt="Z Terminal"
            className="h-6 w-[96px] min-w-0 object-contain object-left"
          />
        )}
        <button
          onClick={toggleSidebar}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "ml-auto grid place-items-center h-7 w-7 rounded text-muted-foreground hover:text-foreground hover:bg-hover transition-colors",
            collapsed && "absolute right-1 top-1.5"
          )}
        >
          {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto scroll-thin py-2">
        {SECTIONS.map((sec) => (
          <div key={sec.title} className="px-2 mb-2">
            {!collapsed && (
              <div className="px-2 mb-1 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground/70">
                {sec.title}
              </div>
            )}
            <ul className="space-y-0.5">
              {sec.items.map((item) => {
                const active = activeView === item.id;
                const Icon = item.icon;
                return (
                  <li key={item.id}>
                    <button
                      onClick={() => setView(item.id)}
                      title={collapsed ? item.label : undefined}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group relative w-full flex items-center gap-2.5 rounded-[5px] px-2 h-8 text-[13px] transition-colors",
                        collapsed && "justify-center px-0",
                        active
                          ? "bg-hover text-foreground"
                          : "text-muted-foreground hover:text-foreground hover:bg-hover/60"
                      )}
                    >
                      {active && (
                        <span
                          className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-full bg-foreground/80"
                          aria-hidden
                        />
                      )}
                      <Icon className={cn("w-[15px] h-[15px] shrink-0", active && "text-foreground")} />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer status */}
      <div className="border-t hairline px-2 py-2">
        <div className={cn("flex items-center gap-2", collapsed && "justify-center")}>
          <span className={cn("w-1.5 h-1.5 rounded-full", connection.dataStatus === "LIVE" ? "bg-mdata shadow-[0_0_6px_var(--mdata)]" : "bg-warn")} />
          {!collapsed && (
            <span className="text-[10.5px] text-muted-foreground uppercase tracking-wider">
              {(connection.provider ?? "gateio").toUpperCase()} · {connection.dataStatus}
            </span>
          )}
        </div>
      </div>
    </aside>
  );
}


export { Layers };
