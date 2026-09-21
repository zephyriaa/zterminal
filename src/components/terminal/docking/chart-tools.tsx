"use client";
import { useMemo } from "react";
import { useWorkspace } from "@/stores/workspace";
import { useResearch } from "@/stores/research";
import { useChartDocuments } from "@/stores/chart-documents";
import { useMarketStream } from "@/hooks/use-market-stream";
import { getContract, formatSymbol } from "@/lib/market/contracts";
import { chartDocumentKey, PRIMARY_CHART_ID, type InstrumentKey } from "@/lib/chart/contracts";
import { ChartSettingsPanel } from "../chart-settings-panel";
import { IndicatorsBrowser } from "../indicators-browser";
function usePrimaryDocument() {
  const { activeWorkspaceId, symbol } = useWorkspace();
  const archived = useResearch(state => state.chartResult);
  const { provider } = useMarketStream(symbol, { trades: 1, depth: false });
  const chartSymbol = archived?.dataset.symbol ?? symbol;
  const chartProvider = archived?.dataset.provider ?? provider ?? "gateio";
  const instrument = useMemo<InstrumentKey>(() => ({ provider: chartProvider, exchange: getContract(chartSymbol).exchange, product: "perpetual", nativeSymbol: chartSymbol }), [chartProvider, chartSymbol]);
  const id = chartDocumentKey(activeWorkspaceId, PRIMARY_CHART_ID, instrument);
  const document = useChartDocuments(state => state.documents[id]);
  return { id, document, chartSymbol, chartProvider };
}
export function DockIndicators() {
  const { id, document } = usePrimaryDocument();
  return <IndicatorsBrowser overlays={document?.overlays} onSetOverlay={overlay => useChartDocuments.getState().setOverlay(id, overlay)} onRemoveOverlay={overlayId => useChartDocuments.getState().removeOverlay(id, overlayId)} />;
}
export function DockChartSettings() {
  const { id, document, chartSymbol, chartProvider } = usePrimaryDocument();
  if (!document) return <p className="p-4">Open the chart to configure this market.</p>;
  const volume = document.panes.find(pane => pane.id === "volume");
  return <ChartSettingsPanel settings={document.settings} instrument={formatSymbol(chartSymbol)} provider={chartProvider.toUpperCase()} volumeVisible={volume?.visible ?? true} volumeHeight={volume?.height ?? 0.22} onChange={patch => useChartDocuments.getState().updateSettings(id, patch)} onVolume={patch => useChartDocuments.getState().setVolumePane(id, patch)} onReset={() => useChartDocuments.getState().resetSettings(id)} />;
}
