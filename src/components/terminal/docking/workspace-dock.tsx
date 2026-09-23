"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { DockviewReact, type DockviewReadyEvent, type IDockviewPanelProps } from "dockview-react";
import "dockview-react/dist/styles/dockview.css";
import { ReferenceChartWorkspace } from "../reference-chart-workspace";
import { OrderbookPanel } from "./orderbook-panel";
import { useWorkspaceDock } from "./workspace-dock-controller";
import { initializeWorkspace, persistWorkspace, PANEL_DEFINITIONS, isDockPanelId, type DockPanelId } from "@/lib/workspace-dock-layout";
const loading = () => <p className="p-4 text-xs" role="status">Opening tool…</p>;
const Research = dynamic(() => import("../research-report").then(m => m.ResearchReport), { loading });
const Strategy = dynamic(() => import("../research-workbench").then(m => m.ResearchWorkbench), { loading });
const Indicators = dynamic(() => import("./chart-tools").then(m => m.DockIndicators), { loading });
const ChartSettings = dynamic(() => import("./chart-tools").then(m => m.DockChartSettings), { loading });
const Calendar = dynamic(() => import("../economic-calendar/economic-calendar-table").then(m => m.EconomicCalendarTable), { loading });
const Settings = dynamic(() => import("../terminal-preferences").then(m => m.TerminalPreferences), { loading });
const content = { chart: ReferenceChartWorkspace, orderbook: OrderbookPanel, research: Research, strategy: Strategy, indicators: Indicators, calendar: Calendar, settings: Settings, "chart-settings": ChartSettings };
const components = Object.fromEntries(Object.entries(content).map(([id, Panel]) => [id, function DockPanel({ api }: IDockviewPanelProps) {
  const [opened, setOpened] = useState(api.isVisible);
  useEffect(() => { if (api.isVisible) setOpened(true); const listener = api.onDidVisibilityChange(({ isVisible }) => { if (isVisible) setOpened(true); }); return () => listener.dispose(); }, [api]);
  return <div className="zt-dock-panel" data-panel-id={id}>{opened && <Panel />}</div>;
}]));
// Access localStorage inside guarded methods; even its getter can throw in private mode.
const storage = {
  getItem: (key: string) => window.localStorage.getItem(key),
  setItem: (key: string, value: string) => window.localStorage.setItem(key, value),
  removeItem: (key: string) => window.localStorage.removeItem(key),
};
export function WorkspaceDock() {
  const { attach, setActivePanelId } = useWorkspaceDock();
  const dispose = useRef<(() => void) | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [ready, setReady] = useState(false);
  const onReady = useCallback(({ api }: DockviewReadyEvent) => {
    dispose.current?.();
    let persistence: ReturnType<typeof persistWorkspace> | undefined;
    let activeListener: { dispose(): void } | undefined;
    const narrow = window.matchMedia("(max-width: 900px)");
    const fit = () => {
      api.exitMaximizedGroup();
      if (narrow.matches && api.activePanel) api.maximizeGroup(api.activePanel);
    };
    const onPageHide = () => persistence?.flush();
    const cleanup = () => {
      persistence?.dispose(); activeListener?.dispose();
      narrow.removeEventListener("change", fit);
      window.removeEventListener("pagehide", onPageHide);
      attach(null);
    };
    dispose.current = cleanup;
    try {
      initializeWorkspace(api, storage);
      if (narrow.matches) api.getPanel("chart")?.api.setActive();
      fit();
      activeListener = api.onDidActivePanelChange(({ panel }) => {
        const panelId = panel?.id;
        setActivePanelId(panelId && isDockPanelId(panelId) ? panelId : null);
        if (narrow.matches) fit();
      });
      setActivePanelId(api.activePanel && isDockPanelId(api.activePanel.id) ? api.activePanel.id : null);
      persistence = persistWorkspace(api, storage);
      const openPanel = (id: DockPanelId) => {
        try {
          let panel = api.getPanel(id);
          if (!panel) {
            const reference = api.getPanel("research") ?? api.getPanel("orderbook") ?? api.getPanel("chart");
            panel = api.addPanel({ id, ...PANEL_DEFINITIONS[id], position: reference ? { referencePanel: reference.id, direction: "within" } : undefined });
          }
          panel.api.setActive(); fit();
        } catch (cause) { setError(cause instanceof Error ? cause : new Error("Unable to open panel")); }
      };
      attach({ openPanel, focusPanel: openPanel, resetLayout: () => {
        try { persistence?.reset(); fit(); } catch (cause) { setError(cause instanceof Error ? cause : new Error("Unable to reset workspace")); }
      } });
      narrow.addEventListener("change", fit);
      window.addEventListener("pagehide", onPageHide);
      setReady(true);
    } catch (cause) {
      cleanup(); dispose.current = null;
      setError(cause instanceof Error ? cause : new Error("Unable to initialize workspace"));
    }
  }, [attach, setActivePanelId]);
  useEffect(() => () => { dispose.current?.(); dispose.current = null; }, []);
  if (error) throw error;
  return <div className="zt-workspace-dock" data-testid="workspace-dock" data-ready={ready}><DockviewReact components={components} onReady={onReady} className="dockview-theme-dark" /></div>;
}
export default WorkspaceDock;
