"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useWorkspaceDock } from "./docking/workspace-dock-controller";
import { hydrateTerminalAppearance, useTerminalAppearance } from "@/stores/terminal-appearance";
import { useCustomization, hydrateCustomization } from "@/stores/customization";
import { defaultChartStyle } from "@/lib/customization";
import { useStudies } from "@/stores/studies";
import { migrateStudy, type IndicatorInstance } from "@/lib/indicator-library";
import {
  type ChartIndicators,
} from "./terminal-chart";
import { useWorkspace } from "@/stores/workspace";
import { useResearch } from "@/stores/research";
import { intervalMs } from "@/lib/local-research/dataset";
import type { TradeMarker } from "./terminal-chart";
import { formatSymbol, pricePrecision } from "@/lib/market/contracts";
import { useMarketStream } from "@/hooks/use-market-stream";
import { MARKET_PROVIDERS, type MarketProvider, type Bar, type Timeframe } from "@/lib/market/types";
import { useMarketContract } from "@/hooks/use-market-contract";
import { ChartToolbar } from "./chart-toolbar";
import { chartDocumentKey, createChartDocument, PRIMARY_CHART_ID, type InstrumentKey, type DrawingObject } from "@/lib/chart/contracts";
import { useChartDocuments } from "@/stores/chart-documents";
import type { DrawingTool, MagnetMode } from "@/lib/chart/drawings/contracts";
import { MultiChartGrid } from "./multi-chart-grid";
import { FeedInspector } from "./feed-inspector";
import { useMultiChart } from "@/stores/multi-chart";

function formatPrice(value: number | undefined | null, tick: number) {
  if (value == null || !Number.isFinite(value)) return "—";
  if (!Number.isFinite(tick)) return value.toLocaleString();
  const digits = Math.max(2, pricePrecision(tick));
  return value.toLocaleString("en-US", { minimumFractionDigits: tick >= 1 ? 2 : digits, maximumFractionDigits: tick >= 1 ? 2 : digits });
}

export function ReferenceChartWorkspace() {
  const { activeWorkspaceId, symbol, timeframe, setTimeframe, timezone, setMarketProvider } = useWorkspace();
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
  const instances = useStudies(s => s.instances);
  const appearance = useTerminalAppearance(state => state.appearance);
  const chartDefaults = useCustomization(state => state.preferences.chartDefaults);
  const [crosshairBar, setCrosshairBar] = useState<Bar | null>(null);
  const [latestBar, setLatestBar] = useState<Bar | null>(null);
  const [drawingTool, setDrawingTool] = useState<DrawingTool>("crosshair");
  const [magnetMode, setMagnetMode] = useState<MagnetMode>("off");
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(null);
  const [persistentDrawing, setPersistentDrawing] = useState(false);
  const drawingClipboard = useRef<DrawingObject | null>(null);
  const [studiesHydrated, setStudiesHydrated] = useState(false);
  const [documentsHydrated, setDocumentsHydrated] = useState(false);
  const indicatorDocumentRef = useRef<string | null>(null);
  const indicatorLoadingRef = useRef(false);
  const { lastTrade, derivatives, dataStatus, provider, effectiveProvider, gatewayProvider, transport, health, reason } = useMarketStream(symbol, { trades: 1, depth: false });
  const chartProvider = archivedChart?.dataset.provider ?? provider ?? "gateio";
  const liveContract = useMarketContract(chartSymbol, chartProvider);
  const chartContract = useMemo(() => archivedChart ? { ...liveContract, symbol: archivedChart.dataset.symbol, exchange: archivedChart.dataset.provider === "gateio" ? "GATEIO" as const : "BINANCE" as const, product: "perpetual" as const, tickSize: archivedChart.config.tickSize ?? archivedChart.instrument?.tickSize ?? Number.NaN, multiplier: archivedChart.config.multiplier, quantityStep: archivedChart.config.quantityStep } : liveContract, [archivedChart, liveContract]);
  const contract = chartContract;
  const identityReady = Boolean(archivedChart || chartContract.verified || chartProvider === "mock");
  const instrument = useMemo<InstrumentKey>(() => ({ provider: chartProvider, exchange: chartContract.exchange, product: chartContract.product, nativeSymbol: chartContract.verified ? chartContract.symbol : chartSymbol }), [chartContract, chartProvider, chartSymbol]);
  const chartDocumentId = chartDocumentKey(activeWorkspaceId, PRIMARY_CHART_ID, instrument);
  const olderDocument = useChartDocuments(state => Object.values(state.documents).find(document => document.workspaceId === activeWorkspaceId && document.chartId === PRIMARY_CHART_ID && document.id !== chartDocumentId && document.instrument.nativeSymbol.replace(/[_-]/g, "") === chartSymbol.replace(/[_-]/g, "")));
  const storedChartDocument = useChartDocuments(state => state.documents[chartDocumentId]);
  const fallbackChartDocument = useMemo(() => createChartDocument({ workspaceId: activeWorkspaceId, instrument, timeframe: chartTimeframe as Timeframe, settings: defaultChartStyle(appearance, chartDefaults) }), [activeWorkspaceId, appearance, chartDefaults, chartTimeframe, instrument]);
  const chartDocument = storedChartDocument ?? fallbackChartDocument;
  const chartType = chartDocument.chartType;
  const chartSettings = chartDocument.settings;
  const selectedDrawing = chartDocument.drawings.find(drawing => drawing.id === selectedDrawingId) ?? null;
  const drawingHistory = useChartDocuments(state => state.drawingHistory[chartDocumentId]);
  useEffect(() => { setSelectedDrawingId(null); setDrawingTool("crosshair"); }, [chartDocumentId]);
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
    let disposed = false;
    void Promise.all([useChartDocuments.persist.rehydrate(), hydrateTerminalAppearance(), hydrateCustomization()]).then(() => {
      if (!disposed) setDocumentsHydrated(true);
    });
    const storage = (event: StorageEvent) => { if (event.key === "zterminal.chart-documents") void useChartDocuments.persist.rehydrate(); };
    window.addEventListener("storage", storage);
    return () => { disposed = true; window.removeEventListener("storage", storage); };
  }, []);

  useEffect(() => {
    if (!documentsHydrated || !identityReady) return;
    const store = useChartDocuments.getState();
    store.ensure({ workspaceId: activeWorkspaceId, instrument, timeframe: chartTimeframe as Timeframe, settings: fallbackChartDocument.settings });
    if (useChartDocuments.getState().documents[chartDocumentId]?.timeframe !== chartTimeframe) store.setTimeframe(chartDocumentId, chartTimeframe as Timeframe);
  }, [activeWorkspaceId, chartDocumentId, chartTimeframe, documentsHydrated, fallbackChartDocument.settings, instrument, archivedChart, chartContract.verified, identityReady]);

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
      const owner = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-drawing-chart]") : null;
      if (owner && owner.dataset.drawingChart !== "primary") return;
      const editable = event.target instanceof Element && Boolean(event.target.closest("input,textarea,select,[contenteditable=true],.monaco-editor,[role=dialog]"));
      if (editable || event.defaultPrevented) return;
      const modifier = event.ctrlKey || event.metaKey;
      const store = useChartDocuments.getState();
      if (modifier && event.key.toLowerCase() === "z") { event.preventDefault(); if (event.shiftKey) store.redoDrawings(chartDocumentId); else store.undoDrawings(chartDocumentId); return; }
      if (modifier && event.key.toLowerCase() === "y") { event.preventDefault(); store.redoDrawings(chartDocumentId); return; }
      if (modifier && event.key.toLowerCase() === "c" && selectedDrawingId) {
        const drawing = store.documents[chartDocumentId]?.drawings.find(d => d.id === selectedDrawingId);
        if (drawing) { event.preventDefault(); drawingClipboard.current = structuredClone(drawing); } return;
      }
      if (modifier && event.key.toLowerCase() === "v" && drawingClipboard.current) { event.preventDefault(); setSelectedDrawingId(store.pasteDrawing(chartDocumentId, drawingClipboard.current)); return; }
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
    const rerun = (event: Event) => { const detail = (event as CustomEvent<{ artifactId: string; params: Record<string, number | string | boolean> }>).detail; if (detail?.artifactId) void useResearch.getState().rerunIndicator(detail.artifactId, detail.params); };
    window.addEventListener("zterminal:rerun-python-indicator", rerun);
    return () => window.removeEventListener("zterminal:rerun-python-indicator", rerun);
  }, []);
  return (
        <div className="zt-chart-content" data-testid="primary-chart">
          <div className="zt-chart-actions"><button type="button" onClick={() => setReplay(value => !value)}>{replay ? "Exit replay" : "Bar replay"}</button><button type="button" onClick={() => window.dispatchEvent(new Event("zterminal:refresh-chart"))}>Refresh chart</button></div>
          <ChartToolbar
            symbol={formatSymbol(chartSymbol)}
            productLabel={archivedChart ? "ARCHIVED" : chartContract.product.toUpperCase()}
            timeframe={chartTimeframe as Timeframe}
            archived={Boolean(archivedChart)}
            price={formatPrice(identityReady ? livePrice : null, contract.tickSize)}
            providerLabel={chartProvider.toUpperCase()}
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
              if (MARKET_PROVIDERS.includes(next as MarketProvider)) {
                setMarketProvider(next as MarketProvider);
              }
            }}
          />
          {!identityReady && <p role="status">Instrument metadata is unverified. Provider history must confirm the market before prices or saved drawings are used. Existing documents remain saved.</p>}
          {archivedChart && !Number.isFinite(chartContract.tickSize) && <p role="status">Archived tick size was not captured. Current live precision is not substituted.</p>}
          {olderDocument && <p role="status">Saved drawings under an older instrument identity remain stored separately. Verify their original market before reusing them.</p>}
          <MultiChartGrid
            drawingScopeKey={chartDocumentId}
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
            drawings={identityReady ? chartDocument.drawings : []}
            selectedDrawingId={selectedDrawingId}
            drawingTool={drawingTool}
            persistentDrawing={persistentDrawing}
            onPersistentDrawing={() => setPersistentDrawing(value => !value)}
            onUndoDrawings={() => useChartDocuments.getState().undoDrawings(chartDocumentId)}
            onRedoDrawings={() => useChartDocuments.getState().redoDrawings(chartDocumentId)}
            canUndoDrawings={Boolean(drawingHistory?.past.length)}
            canRedoDrawings={Boolean(drawingHistory?.future.length)}
            magnetMode={magnetMode}
            onDrawingTool={setDrawingTool}
            onMagnetMode={setMagnetMode}
            onSelectDrawing={setSelectedDrawingId}
            onCreateDrawing={(type, anchors) => useChartDocuments.getState().createDrawing(chartDocumentId, type, anchors)}
            onUpdateDrawing={(id, patch) => useChartDocuments.getState().updateDrawing(chartDocumentId, id, patch)}
            onDeleteDrawing={id => { useChartDocuments.getState().deleteDrawing(chartDocumentId, id); if (selectedDrawingId === id) setSelectedDrawingId(null); }}
            onDuplicateDrawing={id => { const duplicate = useChartDocuments.getState().duplicateDrawing(chartDocumentId, id); if (duplicate) setSelectedDrawingId(duplicate); }}
            onClearDrawings={chartDocument.drawings.length > 0 ? () => {
              useChartDocuments.getState().clearDrawings(chartDocumentId);
              setSelectedDrawingId(null);
            } : undefined}
            selectedDrawing={selectedDrawing}
            markers={chartSettings.showStrategyTrades ? markers : []}
            focusRange={focusRange}
            archivedBars={archivedChart?.dataset.bars}
            archivedContract={archivedChart ? chartContract : undefined}
            overlays={chartDocument.overlays}
          />
          {!archivedChart && <FeedInspector transport={transport} provider={provider} effectiveProvider={effectiveProvider} gatewayProvider={gatewayProvider} dataStatus={dataStatus} health={health} reason={reason} />}
        </div>
  );
}
