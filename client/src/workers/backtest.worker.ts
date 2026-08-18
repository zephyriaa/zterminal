import { runBacktest, runSignalBacktest, type BacktestBar, type BacktestConfig, type BacktestResult, type BacktestRunContext, type StrategyDefinition, type StrategyTemplateId } from "@shared/backtest/engine";
import { evaluateClosedZS } from "@shared/strategy/zsRuntime";

type TemplateBacktestWorkerRequest = {
  id: string;
  mode?: "template";
  strategyId: StrategyTemplateId;
  bars: BacktestBar[];
  config: Partial<BacktestConfig>;
  context: BacktestRunContext;
};

type ClosedSourceBacktestWorkerRequest = {
  id: string;
  mode: "closed_source";
  source: string;
  bars: BacktestBar[];
  config: Partial<BacktestConfig>;
  context: BacktestRunContext;
};

type BacktestWorkerRequest = TemplateBacktestWorkerRequest | ClosedSourceBacktestWorkerRequest;
type BacktestWorkerResponse = { id: string; result: BacktestResult } | { id: string; error: string };

self.onmessage = (event: MessageEvent<BacktestWorkerRequest>) => {
  const request = event.data;
  try {
    let result: BacktestResult;
    if (request.mode === "closed_source") {
      const runtime = evaluateClosedZS(request.source, request.bars);
      if (!runtime.ok || !runtime.fingerprint) {
        const firstError = runtime.diagnostics.find(item => item.severity === "error");
        throw new Error(firstError ? `Closed runtime rejected source: ${firstError.message}` : "Closed runtime rejected the strategy source.");
      }
      const strategy: StrategyDefinition = {
        id: `zs_${runtime.fingerprint.slice(-10)}`,
        version: runtime.runtimeVersion,
        label: runtime.strategyName,
        description: "Closed ZS source interpreted over the loaded verified historical candle window.",
        signalTiming: "bar_close",
        entryRule: "Closed-runtime strategy.entry declaration at the current bar close.",
        exitRule: "Closed-runtime strategy.close declaration at the current bar close.",
        limitations: ["Closed ZS runtime v1 is long-only and candle-only.", "Source is interpreted as a closed AST, never executed as JavaScript.", "No historical CVD, tape, depth, large-order, or tick-data input is available."],
      };
      result = runSignalBacktest(strategy, runtime.signals, request.bars, request.config, { ...request.context, sourceFingerprint: runtime.fingerprint });
    } else {
      result = runBacktest(request.strategyId, request.bars, request.config, request.context);
    }
    const response: BacktestWorkerResponse = { id: request.id, result };
    self.postMessage(response);
  } catch (error) {
    const response: BacktestWorkerResponse = { id: request.id, error: error instanceof Error ? error.message : "The deterministic research worker could not complete the run." };
    self.postMessage(response);
  }
};
