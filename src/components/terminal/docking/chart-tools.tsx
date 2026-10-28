"use client";
import { usePrimaryDocument } from "./use-primary-chart-document";
import { useChartDocuments } from "@/stores/chart-documents";
import { ChartCustomization } from "../chart-customization";
import { IndicatorsBrowser } from "../indicators-browser";
export function DockIndicators() {
  const { id, document } = usePrimaryDocument();
  return <IndicatorsBrowser overlays={document?.overlays} onSetOverlay={overlay => useChartDocuments.getState().setOverlay(id, overlay)} onRemoveOverlay={overlayId => useChartDocuments.getState().removeOverlay(id, overlayId)} />;
}
export function DockChartSettings() { return <div className="zt-customization zt-chart-customization-scroll"><ChartCustomization /></div>; }
