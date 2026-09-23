"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useWorkspaceDock } from "./docking/workspace-dock-controller";
import { useTerminalAppearance, hydrateTerminalAppearance } from "./terminal-preferences";
import { useStudies } from "@/stores/studies";
import { migrateStudy, type IndicatorInstance } from "@/lib/indicator-library";
import {
  type ChartIndicators,
} from "./terminal-chart";
import { useWorkspace } from "@/stores/workspace";
import { useResearch } from "@/stores/research";
import { intervalMs } from "@/lib/local-research/dataset";
import type { TradeMarker } from "./terminal-chart";
import { getContract, formatSymbol } from "@/lib/market/contracts";
import { useMarketStream } from "@/hooks/use-market-stream";
import { publicMarketData, type StreamProvider } from "@/lib/market/public-stream";
import type { Bar, Timeframe } from "@/lib/market/types";
import { ChartToolbar } from "./chart-toolbar";
import { chartDocumentKey, createChartDocument, PRIMARY_CHART_ID, type InstrumentKey } from "@/lib/chart/contracts";
import { useChartDocuments } from "@/stores/chart-documents";
import type { DrawingTool, MagnetMode } from "@/lib/chart/drawings/contracts";
import { MultiChartGrid } from "./multi-chart-grid";
import { FeedInspector } from "./feed-inspector";
import { useMultiChart } from "@/stores/multi-chart";

function formatPrice(value: number | undefined | null, tick: number) {
  if (value == null || !Number.isFinite(value)) return "—";
  const digits = Math.max(2, Math.min(8, Math.round(-Math.log10(tick))));
  return value.toLocaleString("en-US", { minimumFractionDigits: tick >= 1 ? 2 : digits, maximumFractionDigits: tick >= 1 ? 2 : digits });
}

export function ReferenceChartWorkspace() {
  const { activeWorkspaceId, symbol, timeframe, setTimeframe, timezone } = useWorkspace();
  const contract = getContract(symbol);
  const archivedChart = useResearch(s => s.chartResult);
  const selectedTrade = useResearch(s => s.selectedTrade);
  const pythonEvaluations = useResearch(s => s.indicatorResults);
  const chartSymbol = archivedChart?.dataset.symbol ?? symbol;
  const chartTimeframe = archivedChart?.dataset.timeframe ?? timeframe;
  const selected = archivedChart?.trades.find(t => t.id === selectedTrade);
  const markers = useMemo<TradeMarker[]>(() => selected ? [
    { t: selected.entryTime, side: selected.side === "long" ? "buy" : "sell", price: selected.entryPrice, qty: selected.quantity, label: "Entry" },
    ...(selected.exitTime == null ? [] : [{ t: selected.exitTime, side: selected.side === "long" ? "sell" as const : "buy" as const, price: selected.exitPrice, qty: selected.quantity, label: "Exit" }]),
  ] : [], [selected]);
  const focusRange = useMemo(() => selected && archivedChart ? {
    from: Math.max(archivedChart.dataset.from, selected.entryTime - 10 * intervalMs(chartTimeframe)),
    to: Math.min(archivedChart.dataset.to, (selected.exitTime ?? archivedChart.dataset.to) + 10 * intervalMs(chartTimeframe)),
  } : null, [selected, archivedChart, chartTimeframe]);
  const [replay, setReplay] = useState(false);
  const dock = useWorkspaceDock();
  const indicatorsOpen = dock.activePanelId === "indicators";
  const setIndicatorsOpen = (_open: boolean) => dock.openPanel("indicators");
  const setSettingsOpen = (_open: boolean) => dock.openPanel("chart-settings");
  const { layout: multiChartLayout, setLayout: setMultiChartLayout } = useMultiChart();
  const [selectedProvider, setSelectedProvider] = useState<StreamProvider | undefined>();
  const instances = useStudies(s => s.instances);
  const appearance = useTerminalAppearance(state => state.appearance);
  const [crosshairBar, setCrosshairBar] = useState<Bar | null>(null);
  const [latestBar, setLatestBar] = useState<Bar | null>(null);
  const [drawingTool, setDrawingTool] = useState<DrawingTool>("crosshair");
  const [magnetMode, setMagnetMode] = useState<MagnetMode>("off");
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(null);
  const [studiesHydrated, setStudiesHydrated] = useState(false);
  const indicatorDocumentRef = useRef<string | null>(null);
  const indicatorLoadingRef = useRef(false);
  const { lastTrade, derivatives, dataStatus, provider, health, reason } = useMarketStream(symbol, { trades: 1, depth: false });
  useEffect(() => {
    if (selectedProvider && selectedProvider !== provider) {
      publicMarketData.setProvider(selectedProvider);
    }
  }, [provider, selectedProvider]);
  const chartProvider = archivedChart?.dataset.provider ?? provider ?? "gateio";
  const chartContract = getContract(chartSymbol);
  const instrument = useMemo<InstrumentKey>(() => ({ provider: chartProvider, exchange: chartContract.exchange, product: "perpetual", nativeSymbol: chartSymbol }), [chartContract.exchange, chartProvider, chartSymbol]);
  const chartDocumentId = chartDocumentKey(activeWorkspaceId, PRIMARY_CHART_ID, instrument);
  const storedChartDocument = useChartDocuments(state => state.documents[chartDocumentId]);
  const fallbackChartDocument = useMemo(() => createChartDocument({ workspaceId: activeWorkspaceId, instrument, timeframe: chartTimeframe as Timeframe, settings: { backgroundColor: appearance.chartBackground, candleUpColor: appearance.upColor, candleDownColor: appearance.downColor, gridOpacity: appearance.gridOpacity / 100 } }), [activeWorkspaceId, appearance.chartBackground, appearance.downColor, appearance.gridOpacity, appearance.upColor, chartTimeframe, instrument]);
  const chartDocument = storedChartDocument ?? fallbackChartDocument;
  const chartType = chartDocument.chartType;
  const chartSettings = chartDocument.settings;
  const selectedDrawing = chartDocument.drawings.find(drawing => drawing.id === selectedDrawingId) ?? null;
  const volumePane = chartDocument.panes.find(pane => pane.id === "volume") ?? { id: "volume", kind: "volume" as const, visible: true, height: 0.22, order: 1 };
  const indicators: ChartIndicators = useMemo(() => ({
    vwap: false, ema20: false, ema50: false,
    volume: volumePane.visible && instances.some(item => item.kind === "volume" && item.enabled),
    profile: instances.some(item => item.kind === "profile" && item.enabled),
    customStudies: [],
  }), [instances, volumePane.visible]);
  const livePrice = lastTrade?.price ?? derivatives?.markPrice ?? null;


  useEffect(() => {
    void Promise.resolve(useStudies.persist.rehydrate()).then(() => setStudiesHydrated(true));
    void Promise.resolve(useChartDocuments.persist.rehydrate()).then(() => { useChartDocuments.getState().ensure({ instrument, timeframe: chartTimeframe as Timeframe, settings: fallbackChartDocument.settings }); });
    void hydrateTerminalAppearance();
  }, []);

  useEffect(() => {
    useChartDocuments.getState().ensure({ instrument, timeframe: chartTimeframe as Timeframe, settings: fallbackChartDocument.settings });
  }, [chartDocumentId]);

  useEffect(() => {
    if (!studiesHydrated) return;
    if (indicatorDocumentRef.current === chartDocumentId) return;
    indicatorDocumentRef.current = chartDocumentId;
    const saved = useChartDocuments.getState().documents[chartDocumentId]?.indicators.map(migrateStudy).filter((item): item is IndicatorInstance => item !== null) ?? [];
    if (saved.length) { indicatorLoadingRef.current = true; useStudies.getState().replaceInstances(saved); }
    else useChartDocuments.getState().setIndicators(chartDocumentId, instances);
  }, [chartDocumentId, storedChartDocument, studiesHydrated]);

  useEffect(() => {
    if (indicatorDocumentRef.current !== chartDocumentId) return;
    if (indicatorLoadingRef.current) { indicatorLoadingRef.current = false; return; }
    useChartDocuments.getState().setIndicators(chartDocumentId, instances);
  }, [chartDocumentId, instances]);

  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      const editable = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || (event.target instanceof HTMLElement && event.target.isContentEditable);
      if (!editable && event.key === "Escape") { setDrawingTool("cursor"); setSelectedDrawingId(null); return; }
      if (!editable && (event.key === "Delete" || event.key === "Backspace") && selectedDrawingId) {
        const drawing = useChartDocuments.getState().documents[chartDocumentId]?.drawings.find(item => item.id === selectedDrawingId);
        if (drawing && !drawing.locked) { event.preventDefault(); useChartDocuments.getState().deleteDrawing(chartDocumentId, selectedDrawingId); setSelectedDrawingId(null); }
      }
      if (!editable && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d" && selectedDrawingId) {
        event.preventDefault(); setSelectedDrawingId(useChartDocuments.getState().duplicateDrawing(chartDocumentId, selectedDrawingId));
      }
    };
    window.addEventListener("keydown", keyboard);
    return () => window.removeEventListener("keydown", keyboard);
  }, [chartDocumentId, selectedDrawingId]);

  useEffect(() => {
    document.documentElement.dataset.terminalDensity = appearance.density;
    document.documentElement.style.setProperty("--zt-app-bg", appearance.appBackground);
    document.documentElement.style.setProperty("--zt-panel-bg", appearance.panelBackground);
    document.documentElement.style.setProperty("--zt-chart-bg", appearance.chartBackground);
    document.documentElement.style.setProperty("--zt-accent", appearance.accent);
  }, [appearance]);

  useEffect(() => {
    const rerun = (event: Event) => { const detail = (event as CustomEvent<{ artifactId: string; params: Record<string, number | string | boolean> }>).detail; if (detail?.artifactId) void useResearch.getState().rerunIndicator(detail.artifactId, detail.params); };
    window.addEventListener("zterminal:rerun-python-indicator", rerun);
    return () => window.removeEventListener("zterminal:rerun-python-indicator", rerun);
  }, []);
  return (
        <div className="zt-chart-content" data-testid="primary-chart">
          <div className="zt-chart-actions"><button type="button" onClick={() => setReplay(value => !value)}>{replay ? "Exit replay" : "Bar replay"}</button><button type="button" onClick={() => window.dispatchEvent(new Event("zterminal:refresh-chart"))}>Refresh chart</button></div>
          <ChartToolbar
            symbol={formatSymbol(chartSymbol)}
            productLabel={archivedChart ? "ARCHIVED" : "PERPETUAL"}
            timeframe={chartTimeframe as Timeframe}
            archived={Boolean(archivedChart)}
            price={formatPrice(livePrice, contract.tickSize)}
            providerLabel={(selectedProvider || provider || chartProvider).toUpperCase()}
            dataStatus={dataStatus}
            statusReason={reason ?? health?.reason}
            chartType={chartType}
            indicatorsOpen={indicatorsOpen}
            layout={multiChartLayout}
            onTimeframe={next => { setTimeframe(next); useChartDocuments.getState().setTimeframe(chartDocumentId, next); }}
            onChartType={next => useChartDocuments.getState().setChartType(chartDocumentId, next)}
            onIndicators={() => setIndicatorsOpen(true)}
            onSettings={() => setSettingsOpen(true)}
            onReturnLive={() => useResearch.setState({ chartResult: null, selectedTrade: null })}
            onLayoutChange={setMultiChartLayout}
            onProviderChange={next => {
              if (next === "binance" || next === "gateio" || next === "bybit" || next === "coinbase") {
                setSelectedProvider(next);
              }
            }}
          />
          <MultiChartGrid
            primarySymbol={chartSymbol}
            primaryTimeframe={chartTimeframe as Timeframe}
            chartType={chartType}
            indicators={indicators}
            indicatorInstances={instances}
            pythonEvaluations={pythonEvaluations}
            settings={chartSettings}
            volumePaneHeight={volumePane.height}
            replayEnabled={!archivedChart && replay}
            timezone={archivedChart ? "UTC" : timezone}
            markPrice={archivedChart || !chartSettings.showMarkPrice ? undefined : derivatives?.markPrice}
            crosshairBar={crosshairBar}
            latestBar={latestBar}
            onCrosshair={setCrosshairBar}
            onLatestBar={setLatestBar}
            drawings={chartDocument.drawings}
            selectedDrawingId={selectedDrawingId}
            drawingTool={drawingTool}
            magnetMode={magnetMode}
            onDrawingTool={setDrawingTool}
            onMagnetMode={setMagnetMode}
            onSelectDrawing={setSelectedDrawingId}
            onCreateDrawing={(type, anchors) => useChartDocuments.getState().createDrawing(chartDocumentId, type, anchors)}
            onUpdateDrawing={(id, patch) => useChartDocuments.getState().updateDrawing(chartDocumentId, id, patch)}
            onDeleteDrawing={id => { useChartDocuments.getState().deleteDrawing(chartDocumentId, id); if (selectedDrawingId === id) setSelectedDrawingId(null); }}
            onDuplicateDrawing={id => { const duplicate = useChartDocuments.getState().duplicateDrawing(chartDocumentId, id); if (duplicate) setSelectedDrawingId(duplicate); }}
            onClearDrawings={chartDocument.drawings.length > 0 ? () => {
              chartDocument.drawings.forEach(d => useChartDocuments.getState().deleteDrawing(chartDocumentId, d.id));
              setSelectedDrawingId(null);
            } : undefined}
            selectedDrawing={selectedDrawing}
            markers={chartSettings.showStrategyTrades ? markers : []}
            focusRange={focusRange}
            archivedBars={archivedChart?.dataset.bars}
            overlays={chartDocument.overlays}
          />
          {!archivedChart && <FeedInspector provider={provider} dataStatus={dataStatus} health={health} reason={reason} />}
        </div>
  );
}
