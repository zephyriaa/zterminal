import { createChartDocument, migrateChartDocument, CHART_DOCUMENT_SCHEMA_VERSION, type ChartDocument } from "./contracts";
import type { Timeframe } from "@/lib/market/types";

/** Validate at both the cloud boundary and the device restoration boundary. */
export function workspaceChartDocuments(values: unknown, workspaceId: string): ChartDocument[] {
  if (!Array.isArray(values)) return [];
  const documents: ChartDocument[] = [];
  for (const value of values.slice(0, 32)) {
    if (!value || typeof value !== "object") continue;
    const input = value as ChartDocument, instrument = input.instrument;
    if (typeof input.chartId !== "string" || input.chartId.length > 100 || !instrument ||
      !["mock", "binance", "gateio", "bybit", "mexc", "okx", "coinbase", "deribit", "rithmic-test", "rithmic-prod", "databento"].includes(instrument.provider) ||
      !["CME", "CBOT", "COMEX", "NYMEX", "NASDAQ", "NYSE", "ICE", "GATEIO", "BINANCE", "BYBIT", "OKX", "MEXC", "COINBASE", "DERIBIT"].includes(instrument.exchange) ||
      !["perpetual", "future", "spot"].includes(instrument.product) ||
      typeof instrument.nativeSymbol !== "string" || !/^[A-Z0-9._:-]{1,40}$/.test(instrument.nativeSymbol) ||
      !["1m", "5m", "15m", "30m", "1h", "4h", "1d"].includes(input.timeframe) ||
      (typeof input.schemaVersion === "number" && input.schemaVersion > CHART_DOCUMENT_SCHEMA_VERSION)) continue;
    const fallback = createChartDocument({ workspaceId, chartId: input.chartId, instrument, timeframe: input.timeframe as Timeframe });
    const restored = migrateChartDocument({ ...input, id: fallback.id, workspaceId }, fallback);
    if (!documents.some(document => document.id === restored.id)) documents.push(restored);
  }
  return documents;
}
