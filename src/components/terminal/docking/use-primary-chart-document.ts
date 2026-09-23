"use client";
import { useMemo } from "react";
import { useWorkspace } from "@/stores/workspace";
import { useResearch } from "@/stores/research";
import { useChartDocuments } from "@/stores/chart-documents";
import { useMarketStream } from "@/hooks/use-market-stream";
import { getContract } from "@/lib/market/contracts";
import { chartDocumentKey, PRIMARY_CHART_ID, type InstrumentKey } from "@/lib/chart/contracts";
export function usePrimaryDocument() {
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
