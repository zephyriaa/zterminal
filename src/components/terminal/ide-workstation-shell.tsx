"use client";

import { useEffect, useState, useMemo } from "react";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { TerminalHeader } from "./terminal-header";
import { LeftPanel } from "./panels/left-panel";
import { ChartPanel } from "./panels/chart-panel";
import { BottomPanel } from "./panels/bottom-panel";
import { RightPanel } from "./panels/right-panel";
import { useLayout } from "@/stores/layout";
import { useStrategy } from "@/stores/strategy";
import { CloudSyncBridge } from "@/components/auth/cloud-sync-bridge";
import { StrategyReportDialog } from "./strategy-report-dialog";
import { OptimizerDialog } from "./optimizer-dialog";
import { TerminalStatusBar } from "./terminal-status-bar";
import { CommandPalette } from "./command-palette";
import type { ChartStudy } from "./terminal-chart";
import type { IndicatorToggleId } from "./indicators-browser";

export function IdeWorkstationShell() {
  const {
    leftPanelOpen,
    bottomPanelOpen,
    rightPanelOpen,
    leftSize,
    rightSize,
    bottomSize,
    toggleLeftPanel,
    toggleBottomPanel,
    toggleRightPanel,
    appearance,
  } = useLayout();

  // Indicators state shared between LeftPanel (library) and ChartPanel (canvas)
  const [layers, setLayers] = useState<Record<IndicatorToggleId, boolean>>({
    vwap: true,
    ema20: true,
    ema50: false,
    volume: true,
    profile: false,
  });
  const [customStudies, setCustomStudies] = useState<ChartStudy[]>([]);

  const toggleLayer = (id: IndicatorToggleId) => {
    setLayers((curr) => ({ ...curr, [id]: !curr[id] }));
  };

  const createStudy = (study: ChartStudy) => {
    setCustomStudies((curr) => [...curr, study]);
  };

  const updateStudy = (study: ChartStudy) => {
    setCustomStudies((curr) => curr.map((item) => (item.id === study.id ? study : item)));
  };

  const removeStudy = (id: string) => {
    setCustomStudies((curr) => curr.filter((item) => item.id !== id));
  };

  // Synchronize CSS custom properties when appearance settings change
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.terminalDensity = appearance.density;
    root.style.setProperty("--zt-app-bg", appearance.appBackground);
    root.style.setProperty("--zt-panel-bg", appearance.panelBackground);
    root.style.setProperty("--zt-chart-bg", appearance.chartBackground);
    root.style.setProperty("--zt-accent", appearance.accent);
  }, [appearance]);

  // Global Keyboard Shortcuts (VS Code & Terminal conventions)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;

      // Ctrl/Cmd + B -> Toggle Left Explorer Panel
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggleLeftPanel();
        return;
      }

      // Ctrl/Cmd + J -> Toggle Bottom Console Panel
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        toggleBottomPanel();
        return;
      }

      // Ctrl/Cmd + Shift + E or Ctrl/Cmd + L -> Toggle Right Panel
      if ((e.metaKey || e.ctrlKey) && (e.key.toLowerCase() === "l" || (e.shiftKey && e.key.toLowerCase() === "e"))) {
        e.preventDefault();
        toggleRightPanel();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleLeftPanel, toggleBottomPanel, toggleRightPanel]);

  // Center column sizing calculation
  const centerSize = useMemo(() => {
    let size = 100;
    if (leftPanelOpen) size -= leftSize;
    if (rightPanelOpen) size -= rightSize;
    return Math.max(30, size);
  }, [leftPanelOpen, rightPanelOpen, leftSize, rightSize]);

  return (
    <div
      className="flex h-[100dvh] w-screen flex-col overflow-hidden bg-background text-foreground select-none"
      style={
        {
          "--zt-app-bg": appearance.appBackground,
          "--zt-panel-bg": appearance.panelBackground,
          "--zt-chart-bg": appearance.chartBackground,
          "--zt-accent": appearance.accent,
        } as React.CSSProperties
      }
    >
      <CloudSyncBridge />
      <TerminalHeader />

      {/* Main IDE Panels Canvas */}
      <main className="flex-1 min-h-0 min-w-0 overflow-hidden" aria-label="Quantitative IDE Canvas">
        <ResizablePanelGroup direction="horizontal" className="h-full w-full">
          {/* Left Panel: Watchlist / Indicators / Strategy Explorer */}
          {leftPanelOpen && (
            <>
              <ResizablePanel
                id="panel-left"
                order={1}
                defaultSize={leftSize}
                minSize={14}
                maxSize={35}
                className="min-w-[200px]"
              >
                <LeftPanel
                  layers={layers}
                  customStudies={customStudies}
                  onToggleLayer={toggleLayer}
                  onCreateStudy={createStudy}
                  onUpdateStudy={updateStudy}
                  onRemoveStudy={removeStudy}
                />
              </ResizablePanel>
              <ResizableHandle withHandle className="bg-border/60 hover:bg-accent transition-colors" />
            </>
          )}

          {/* Center Column: Chart on top, Console/Editor on bottom */}
          <ResizablePanel
            id="panel-center"
            order={2}
            defaultSize={centerSize}
            minSize={35}
            className="min-w-[320px]"
          >
            <ResizablePanelGroup direction="vertical" className="h-full w-full">
              {/* Center Top: Verified Chart Canvas */}
              <ResizablePanel
                id="panel-chart"
                order={1}
                defaultSize={bottomPanelOpen ? 100 - bottomSize : 100}
                minSize={25}
                className="min-h-[220px]"
              >
                <ChartPanel
                  layers={layers}
                  customStudies={customStudies}
                  onToggleLayer={toggleLayer}
                />
              </ResizablePanel>

              {/* Center Bottom: Strategy Editor / Backtest Results / Logs */}
              {bottomPanelOpen && (
                <>
                  <ResizableHandle withHandle className="bg-border/60 hover:bg-accent transition-colors" />
                  <ResizablePanel
                    id="panel-bottom"
                    order={2}
                    defaultSize={bottomSize}
                    minSize={15}
                    maxSize={75}
                    className="min-h-[140px]"
                  >
                    <BottomPanel />
                  </ResizablePanel>
                </>
              )}
            </ResizablePanelGroup>
          </ResizablePanel>

          {/* Right Panel: Market Context / Risk Planning / Preferences */}
          {rightPanelOpen && (
            <>
              <ResizableHandle withHandle className="bg-border/60 hover:bg-accent transition-colors" />
              <ResizablePanel
                id="panel-right"
                order={3}
                defaultSize={rightSize}
                minSize={16}
                maxSize={38}
                className="min-w-[220px]"
              >
                <RightPanel />
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      </main>

      {/* Institutional Strategy Dialogs */}
      <StrategyReportDialog />
      <OptimizerDialog />
      <TerminalStatusBar />
      <CommandPalette />
    </div>
  );
}
