"use client";

import {
  Activity,
  BarChart3,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Code2,
  FlaskConical,
  Layers3,
  Menu,
  RotateCcw,
  Settings2,
} from "lucide-react";
import { usePanels } from "@/stores/panels";
import { useWorkspace } from "@/stores/workspace";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

type Tool = { id: string; label: string; detail: string; icon: typeof BarChart3; action: () => void };

function tools(): Tool[] {
  const open = (id: string) => () => usePanels.getState().open(id);
  return [
    { id: "chart", label: "Chart", detail: "Market canvas", icon: BarChart3, action: open("chart") },
    { id: "indicators", label: "Indicators", detail: "Studies and overlays", icon: Layers3, action: open("indicators") },
    { id: "strategy", label: "Strategy Developer", detail: "Python research", icon: Code2, action: () => { open("strategy")(); open("backtester")(); usePanels.getState().focus("strategy"); } },
    { id: "backtester", label: "Research", detail: "Reports and archive", icon: FlaskConical, action: open("backtester") },
    { id: "context", label: "Market Context", detail: "Feed and contract", icon: Activity, action: open("context") },
    { id: "economic-calendar", label: "Calendar", detail: "Economic events", icon: CalendarDays, action: open("economic-calendar") },
    { id: "terminal-settings", label: "Settings", detail: "Terminal preferences", icon: Settings2, action: open("terminal-settings") },
  ];
}

export function ResearchSidebar() {
  const collapsed = useWorkspace(state => state.sidebarCollapsed);
  const toggle = useWorkspace(state => state.toggleSidebar);
  const active = usePanels(state => state.active);
  const panels = usePanels(state => state.panels);

  return <aside className={cn("zt-research-sidebar", collapsed && "is-collapsed")} aria-label="Research navigation">
    <div className="zt-sidebar-heading">
      <div className="zt-sidebar-identity" aria-hidden={collapsed}><strong>ZTERMINAL</strong><span>Research terminal</span></div>
      <button type="button" onClick={toggle} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} title={`${collapsed ? "Expand" : "Collapse"} sidebar (Ctrl/Cmd+B)`}>{collapsed ? <ChevronRight /> : <ChevronLeft />}</button>
    </div>
    <nav className="zt-sidebar-tools" aria-label="Workspace tools">
      {tools().map(tool => <SidebarTool key={tool.id} tool={tool} collapsed={collapsed} active={active === tool.id && panels[tool.id]?.status === "open"} />)}
    </nav>
    <div className="zt-sidebar-footer">
      <SidebarTool collapsed={collapsed} active={false} tool={{ id: "reset", label: "Reset Layout", detail: "Restore panel defaults", icon: RotateCcw, action: () => window.dispatchEvent(new Event("zterminal:reset-layout")) }} />
      {!collapsed && <span>Layout saved locally</span>}
    </div>
  </aside>;
}

function SidebarTool({ tool, collapsed, active }: { tool: Tool; collapsed: boolean; active: boolean }) {
  const Icon = tool.icon;
  const button = <button type="button" className={cn("zt-sidebar-tool", active && "is-active")} onClick={tool.action} aria-current={active ? "page" : undefined} aria-label={tool.label}>
    <Icon /><span className="zt-sidebar-tool-copy"><b>{tool.label}</b><small>{tool.detail}</small></span>
  </button>;
  if (!collapsed) return button;
  return <Tooltip><TooltipTrigger asChild>{button}</TooltipTrigger><TooltipContent side="right" sideOffset={8} className="zt-sidebar-tooltip">{tool.label}</TooltipContent></Tooltip>;
}

export function MobileResearchMenu() {
  const active = usePanels(state => state.active);
  const panels = usePanels(state => state.panels);
  return <Sheet>
    <SheetTrigger asChild><button type="button" className="zt-mobile-menu-trigger" aria-label="Open workspace navigation"><Menu /></button></SheetTrigger>
    <SheetContent side="left" className="zt-mobile-navigation">
      <SheetHeader><SheetTitle>ZTerminal</SheetTitle><SheetDescription>Research workspace</SheetDescription></SheetHeader>
      <nav aria-label="Mobile workspace tools">{tools().map(tool => <SheetClose asChild key={tool.id}><button type="button" className={cn("zt-mobile-navigation-tool", active === tool.id && panels[tool.id]?.status === "open" && "is-active")} onClick={tool.action}><tool.icon /><span><b>{tool.label}</b><small>{tool.detail}</small></span></button></SheetClose>)}</nav>
      <div className="zt-mobile-navigation-footer"><SheetClose asChild><button type="button" onClick={() => window.dispatchEvent(new Event("zterminal:reset-layout"))}><RotateCcw />Reset workspace layout</button></SheetClose></div>
    </SheetContent>
  </Sheet>;
}
