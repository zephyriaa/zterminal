import type { TradeDirection, UtcMillis } from "@/domain/models";

export interface TheoreticalTrade {
  id: string;
  instrument: string;
  direction: TradeDirection;
  entryTime: UtcMillis;
  entryPrice: number;
  exitTime: UtcMillis;
  exitPrice: number;
  quantity: number;
  pnl: number;
}

export interface ExecutedTrade {
  id: string;
  theoreticalTradeId?: string;
  instrument: string;
  direction: TradeDirection;
  entryTime: UtcMillis;
  entryPrice: number;
  exitTime: UtcMillis;
  exitPrice: number;
  quantity: number;
  pnl: number;
}

export interface ExecutionComparison {
  matchedTrades: number;
  missedSetups: number;
  unmatchedExecutions: number;
  averageEntryDelayMs: number | null;
  averageEntrySlippage: number | null;
  realizedPnl: number;
  theoreticalPnl: number;
  executionDeltaPnl: number;
}

/**
 * Compares recorded executions with a theoretical trade set. It is descriptive only:
 * it does not infer intent, diagnose behavior, or alter any risk/execution setting.
 */
export function compareExecution(
  theoretical: readonly TheoreticalTrade[],
  executed: readonly ExecutedTrade[],
): ExecutionComparison {
  const executedByTheory = new Map(
    executed.filter((trade) => trade.theoreticalTradeId).map((trade) => [trade.theoreticalTradeId!, trade]),
  );
  const matched = theoretical
    .map((trade) => ({ theoretical: trade, executed: executedByTheory.get(trade.id) }))
    .filter((pair): pair is { theoretical: TheoreticalTrade; executed: ExecutedTrade } => Boolean(pair.executed));
  const matchedExecutionIds = new Set(matched.map((pair) => pair.executed.id));
  const delays = matched.map((pair) => pair.executed.entryTime - pair.theoretical.entryTime);
  const slippages = matched.map((pair) => {
    const sign = pair.theoretical.direction === "long" ? 1 : -1;
    return (pair.executed.entryPrice - pair.theoretical.entryPrice) * sign;
  });
  const realizedPnl = executed.reduce((sum, trade) => sum + trade.pnl, 0);
  const theoreticalPnl = theoretical.reduce((sum, trade) => sum + trade.pnl, 0);
  return {
    matchedTrades: matched.length,
    missedSetups: theoretical.length - matched.length,
    unmatchedExecutions: executed.filter((trade) => !matchedExecutionIds.has(trade.id)).length,
    averageEntryDelayMs: delays.length ? average(delays) : null,
    averageEntrySlippage: slippages.length ? average(slippages) : null,
    realizedPnl,
    theoreticalPnl,
    executionDeltaPnl: realizedPnl - theoreticalPnl,
  };
}

function average(values: readonly number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
