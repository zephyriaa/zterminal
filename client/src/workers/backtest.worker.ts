import { runBacktest, type BacktestBar, type BacktestConfig, type BacktestResult, type BacktestRunContext, type StrategyTemplateId } from "@shared/backtest/engine";

type BacktestWorkerRequest = {
  id: string;
  strategyId: StrategyTemplateId;
  bars: BacktestBar[];
  config: Partial<BacktestConfig>;
  context: BacktestRunContext;
};

type BacktestWorkerResponse = { id: string; result: BacktestResult } | { id: string; error: string };

self.onmessage = (event: MessageEvent<BacktestWorkerRequest>) => {
  const request = event.data;
  try {
    const result = runBacktest(request.strategyId, request.bars, request.config, request.context);
    const response: BacktestWorkerResponse = { id: request.id, result };
    self.postMessage(response);
  } catch (error) {
    const response: BacktestWorkerResponse = { id: request.id, error: error instanceof Error ? error.message : "The deterministic research worker could not complete the run." };
    self.postMessage(response);
  }
};
