"use client";
import { useMemo } from "react";
import { useWorkspace } from "@/stores/workspace";
import { useResearch } from "@/stores/research";
import { useChartDocuments } from "@/stores/chart-documents";
import { useMarketStream } from "@/hooks/use-market-stream";
import { useMarketContract } from "@/hooks/use-market-contract";
import { chartDocumentKey, PRIMARY_CHART_ID, type InstrumentKey } from "@/lib/chart/contracts";
export function usePrimaryDocument() {
  const { activeWorkspaceId, symbol } = useWorkspace();
  const archived = useResearch(state => state.chartResult);
  const { provider } = useMarketStream(symbol, { trades: 1, depth: false });
  const chartSymbol = archived?.dataset.symbol ?? symbol;
  const chartProvider = archived?.dataset.provider ?? provider ?? "gateio";
  const contract = useMarketContract(chartSymbol, chartProvider);
  const instrument = useMemo<InstrumentKey>(() => ({ provider: chartProvider, exchange: archived ? archived.dataset.provider === "gateio" ? "GATEIO" : "BINANCE" : contract.exchange, product: archived ? "perpetual" : contract.product, nativeSymbol: archived ? archived.dataset.symbol : contract.verified ? contract.symbol : chartSymbol }), [chartProvider, chartSymbol, contract, archived]);
  const id = chartDocumentKey(activeWorkspaceId, PRIMARY_CHART_ID, instrument);
  const document = useChartDocuments(state => state.documents[id]);
  return { id, document, chartSymbol, chartProvider };
}
