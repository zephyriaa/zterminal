"use client";
import { usePrimaryDocument } from "./use-primary-chart-document";
import { useChartDocuments } from "@/stores/chart-documents";
import { formatSymbol } from "@/lib/market/contracts";
import { ChartSettingsPanel } from "../chart-settings-panel";
import { IndicatorsBrowser } from "../indicators-browser";
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
