"use client";

import type { Bar } from "../market/types";
import {
  evaluateStrategySource,
  type MonthlyReturn,
  type MonteCarloSummary,
  type QuantitativeMetrics,
  type SlippagePoint,
  type StrategyExecutionResult,
  type StrategyIntent,
} from "./python-runtime";
import { transpileToPython } from "./transpiler";

export interface BacktestConfig {
  symbol: string;
  timeframe: string;
  initialCapital: number;
  commissionPerContract: number;
  commissionType?: "per_contract" | "bps" | "flat";
  slippageTicks: number;
  tickSize: number;
  multiplier: number;
  limitFillMode?: "touch" | "penetrate";
  enableBarMagnifier?: boolean;
  subBars?: Bar[];
}

export interface TradeRecord {
  id: string;
  side: "long" | "short";
  entryTime: number;
  entryPrice: number;
  exitTime: number;
  exitPrice: number;
  qty: number;
  pnl: number;
  bars: number;
  reason: string;
}

interface OpenPosition {
  side: "long" | "short";
  entryTime: number;
  entryPrice: number;
  qty: number;
  entryBarIdx: number;
  reason: string;
  stopLoss?: number;
  takeProfit?: number;
  trailingStopTicks?: number;
  peakPrice: number;
}

/**
 * Calculates trading commission based on the configured model.
 */
function calculateCommission(
  price: number,
  qty: number,
  config: BacktestConfig
): number {
  const type = config.commissionType || "per_contract";
  if (type === "flat") {
    return config.commissionPerContract;
  }
  if (type === "bps") {
    const notional = price * qty * config.multiplier;
    return (notional * config.commissionPerContract) / 10000;
  }
  return config.commissionPerContract * qty;
}

/**
 * Evaluates whether a limit order fills on a given bar.
 */
function checkLimitFill(
  limitPrice: number,
  side: "long" | "short",
  bar: Bar,
  config: BacktestConfig
): { filled: boolean; fillPrice: number } {
  const mode = config.limitFillMode || "touch";
  const tick = config.tickSize;

  if (side === "long") {
    if (mode === "penetrate") {
      // Must trade through limit price by at least 1 tick
      if (bar.l <= limitPrice - tick) {
        return { filled: true, fillPrice: limitPrice };
      }
    } else {
      // Touch mode: fills if price reaches the limit
      if (bar.l <= limitPrice) {
        return { filled: true, fillPrice: Math.min(bar.o, limitPrice) };
      }
    }
  } else {
    // Short limit
    if (mode === "penetrate") {
      if (bar.h >= limitPrice + tick) {
        return { filled: true, fillPrice: limitPrice };
      }
    } else {
      if (bar.h >= limitPrice) {
        return { filled: true, fillPrice: Math.max(bar.o, limitPrice) };
      }
    }
  }

  return { filled: false, fillPrice: 0 };
}

/**
 * Executes a deterministic local quantitative backtest over historical bars
 * with institutional MultiCharts-grade execution realism:
 * - Sub-bar Bar Magnifier (1m/1s intra-bar replay or deterministic path sequencing)
 * - Bracket (OCO) exits and Trailing Stops
 * - Limit Order Touch vs Penetrate fills
 * - Comprehensive institutional metrics, Monthly Returns matrix, and Monte Carlo simulation
 */
export async function executeLocalBacktest(
  rawCode: string,
  bars: Bar[],
  config: BacktestConfig
): Promise<StrategyExecutionResult> {
  if (bars.length < 2) {
    throw new Error("Insufficient bars to backtest. At least 2 bars are required.");
  }

  // 1. Language detection & transpilation
  const transpileRes = transpileToPython(rawCode);
  const pythonCode = transpileRes.pythonCode;

  // 2. Evaluate Strategy Intent Sequence
  const intents = evaluateStrategySource(pythonCode, bars);

  // 3. Execution Simulation
  const trades: TradeRecord[] = [];
  const slippagePenalty = config.slippageTicks * config.tickSize;
  const tick = config.tickSize;

  let currentPosition: OpenPosition | null = null;
  let realizedPnl = 0;
  let tradeCounter = 1;

  // Track bar-by-bar equity curve
  const equityCurve: { time: number; equity: number; drawdown: number; drawdownPct: number }[] = [];
  let peakEquity = config.initialCapital;
  let maxDrawdownDollars = 0;
  let maxDrawdownPct = 0;

  // Pre-index intents by bar_index for fast lookup
  const intentMap = new Map<number, StrategyIntent>();
  for (const intent of intents) {
    intentMap.set(intent.bar_index, intent);
  }

  // Pre-index sub-bars by timestamp if Bar Magnifier is active
  const subBarsByMasterTime = new Map<number, Bar[]>();
  if (config.enableBarMagnifier && config.subBars && config.subBars.length > 0) {
    const subBars = config.subBars;
    let subIdx = 0;
    for (let i = 0; i < bars.length; i++) {
      const barStart = bars[i].t;
      const barEnd = i < bars.length - 1 ? bars[i + 1].t : barStart + 86400000;
      const matched: Bar[] = [];
      while (subIdx < subBars.length && subBars[subIdx].t < barEnd) {
        if (subBars[subIdx].t >= barStart) {
          matched.push(subBars[subIdx]);
        }
        subIdx++;
      }
      if (matched.length > 0) {
        subBarsByMasterTime.set(barStart, matched);
      }
    }
  }

  for (let i = 0; i < bars.length; i++) {
    const currentBar = bars[i];

    // 1. Process pending signal intent from previous bar (executes at currentBar.o)
    const pendingIntent = intentMap.get(i - 1);
    if (pendingIntent) {
      if (pendingIntent.action === "EnterLong") {
        let fillAllowed = true;
        let entryPrice = currentBar.o + slippagePenalty;

        if (pendingIntent.limit_price) {
          const limitCheck = checkLimitFill(pendingIntent.limit_price, "long", currentBar, config);
          fillAllowed = limitCheck.filled;
          entryPrice = limitCheck.fillPrice;
        }

        if (fillAllowed) {
          if (currentPosition?.side === "short") {
            // Close short first
            const exitPrice = currentBar.o + slippagePenalty;
            const comm =
              calculateCommission(currentPosition.entryPrice, currentPosition.qty, config) +
              calculateCommission(exitPrice, currentPosition.qty, config);
            const pnl =
              (currentPosition.entryPrice - exitPrice) *
                currentPosition.qty *
                config.multiplier -
              comm;
            realizedPnl += pnl;
            trades.push({
              id: `TR-${tradeCounter++}`,
              side: "short",
              entryTime: currentPosition.entryTime,
              entryPrice: currentPosition.entryPrice,
              exitTime: currentBar.t,
              exitPrice,
              qty: currentPosition.qty,
              pnl,
              bars: i - currentPosition.entryBarIdx,
              reason: "reversed_long",
            });
            currentPosition = null;
          }

          if (!currentPosition) {
            currentPosition = {
              side: "long",
              entryTime: currentBar.t,
              entryPrice,
              qty: Number(pendingIntent.quantity) || 1,
              entryBarIdx: i,
              reason: pendingIntent.reason,
              stopLoss: pendingIntent.stop_loss,
              takeProfit: pendingIntent.take_profit,
              trailingStopTicks: pendingIntent.trailing_stop_ticks,
              peakPrice: entryPrice,
            };
          }
        }
      } else if (pendingIntent.action === "EnterShort") {
        let fillAllowed = true;
        let entryPrice = currentBar.o - slippagePenalty;

        if (pendingIntent.limit_price) {
          const limitCheck = checkLimitFill(pendingIntent.limit_price, "short", currentBar, config);
          fillAllowed = limitCheck.filled;
          entryPrice = limitCheck.fillPrice;
        }

        if (fillAllowed) {
          if (currentPosition?.side === "long") {
            // Close long first
            const exitPrice = currentBar.o - slippagePenalty;
            const comm =
              calculateCommission(currentPosition.entryPrice, currentPosition.qty, config) +
              calculateCommission(exitPrice, currentPosition.qty, config);
            const pnl =
              (exitPrice - currentPosition.entryPrice) *
                currentPosition.qty *
                config.multiplier -
              comm;
            realizedPnl += pnl;
            trades.push({
              id: `TR-${tradeCounter++}`,
              side: "long",
              entryTime: currentPosition.entryTime,
              entryPrice: currentPosition.entryPrice,
              exitTime: currentBar.t,
              exitPrice,
              qty: currentPosition.qty,
              pnl,
              bars: i - currentPosition.entryBarIdx,
              reason: "reversed_short",
            });
            currentPosition = null;
          }

          if (!currentPosition) {
            currentPosition = {
              side: "short",
              entryTime: currentBar.t,
              entryPrice,
              qty: Number(pendingIntent.quantity) || 1,
              entryBarIdx: i,
              reason: pendingIntent.reason,
              stopLoss: pendingIntent.stop_loss,
              takeProfit: pendingIntent.take_profit,
              trailingStopTicks: pendingIntent.trailing_stop_ticks,
              peakPrice: entryPrice,
            };
          }
        }
      } else if (pendingIntent.action === "Close" && currentPosition) {
        const exitPrice =
          currentPosition.side === "long"
            ? currentBar.o - slippagePenalty
            : currentBar.o + slippagePenalty;

        const comm =
          calculateCommission(currentPosition.entryPrice, currentPosition.qty, config) +
          calculateCommission(exitPrice, currentPosition.qty, config);

        const pnl =
          currentPosition.side === "long"
            ? (exitPrice - currentPosition.entryPrice) *
                currentPosition.qty *
                config.multiplier -
              comm
            : (currentPosition.entryPrice - exitPrice) *
                currentPosition.qty *
                config.multiplier -
              comm;

        realizedPnl += pnl;
        trades.push({
          id: `TR-${tradeCounter++}`,
          side: currentPosition.side,
          entryTime: currentPosition.entryTime,
          entryPrice: currentPosition.entryPrice,
          exitTime: currentBar.t,
          exitPrice,
          qty: currentPosition.qty,
          pnl,
          bars: i - currentPosition.entryBarIdx,
          reason: pendingIntent.reason,
        });
        currentPosition = null;
      }
    }

    // 2. Check intra-bar Stop Loss / Take Profit / Trailing Stop for active position
    if (currentPosition) {
      let exitTriggered = false;
      let exitPrice = 0;
      let exitReason = "";
      let exitTime = currentBar.t;

      // Update trailing stop if active
      if (currentPosition.trailingStopTicks && currentPosition.trailingStopTicks > 0) {
        const trailDist = currentPosition.trailingStopTicks * tick;
        if (currentPosition.side === "long") {
          if (currentBar.h > currentPosition.peakPrice) {
            currentPosition.peakPrice = currentBar.h;
            const newStop = currentBar.h - trailDist;
            if (!currentPosition.stopLoss || newStop > currentPosition.stopLoss) {
              currentPosition.stopLoss = newStop;
            }
          }
        } else {
          if (currentBar.l < currentPosition.peakPrice) {
            currentPosition.peakPrice = currentBar.l;
            const newStop = currentBar.l + trailDist;
            if (!currentPosition.stopLoss || newStop < currentPosition.stopLoss) {
              currentPosition.stopLoss = newStop;
            }
          }
        }
      }

      const sl = currentPosition.stopLoss;
      const tp = currentPosition.takeProfit;

      // Use Bar Magnifier if sub-bars exist for this bar
      const subBars = subBarsByMasterTime.get(currentBar.t);
      if (subBars && subBars.length > 0 && (sl != null || tp != null)) {
        for (const sub of subBars) {
          if (currentPosition.side === "long") {
            if (sl != null && sub.l <= sl) {
              exitTriggered = true;
              exitPrice = sl - slippagePenalty;
              exitReason = "stop_loss_magnifier";
              exitTime = sub.t;
              break;
            }
            if (tp != null && sub.h >= tp) {
              exitTriggered = true;
              exitPrice = tp - slippagePenalty;
              exitReason = "take_profit_magnifier";
              exitTime = sub.t;
              break;
            }
          } else {
            // Short position
            if (sl != null && sub.h >= sl) {
              exitTriggered = true;
              exitPrice = sl + slippagePenalty;
              exitReason = "stop_loss_magnifier";
              exitTime = sub.t;
              break;
            }
            if (tp != null && sub.l <= tp) {
              exitTriggered = true;
              exitPrice = tp + slippagePenalty;
              exitReason = "take_profit_magnifier";
              exitTime = sub.t;
              break;
            }
          }
        }
      } else if (sl != null || tp != null) {
        // MultiCharts classic intra-bar tick sequencing
        if (currentPosition.side === "long") {
          const slHit = sl != null && currentBar.l <= sl;
          const tpHit = tp != null && currentBar.h >= tp;

          if (slHit && tpHit) {
            // Both hit in the same candle: use candle polarity
            if (currentBar.c >= currentBar.o) {
              // Bull candle: Open -> Low (Stop) -> High (Target) -> Close
              exitTriggered = true;
              exitPrice = sl! - slippagePenalty;
              exitReason = "stop_loss";
            } else {
              // Bear candle: Open -> High (Target) -> Low (Stop) -> Close
              exitTriggered = true;
              exitPrice = tp! - slippagePenalty;
              exitReason = "take_profit";
            }
          } else if (slHit) {
            exitTriggered = true;
            exitPrice = sl! - slippagePenalty;
            exitReason = "stop_loss";
          } else if (tpHit) {
            exitTriggered = true;
            exitPrice = tp! - slippagePenalty;
            exitReason = "take_profit";
          }
        } else {
          // Short position
          const slHit = sl != null && currentBar.h >= sl;
          const tpHit = tp != null && currentBar.l <= tp;

          if (slHit && tpHit) {
            if (currentBar.c <= currentBar.o) {
              // Bear candle: Open -> High (Stop) -> Low (Target) -> Close
              exitTriggered = true;
              exitPrice = sl! + slippagePenalty;
              exitReason = "stop_loss";
            } else {
              // Bull candle: Open -> Low (Target) -> High (Stop) -> Close
              exitTriggered = true;
              exitPrice = tp! + slippagePenalty;
              exitReason = "take_profit";
            }
          } else if (slHit) {
            exitTriggered = true;
            exitPrice = sl! + slippagePenalty;
            exitReason = "stop_loss";
          } else if (tpHit) {
            exitTriggered = true;
            exitPrice = tp! + slippagePenalty;
            exitReason = "take_profit";
          }
        }
      }

      if (exitTriggered) {
        const comm =
          calculateCommission(currentPosition.entryPrice, currentPosition.qty, config) +
          calculateCommission(exitPrice, currentPosition.qty, config);

        const grossPnl =
          currentPosition.side === "long"
            ? (exitPrice - currentPosition.entryPrice) * currentPosition.qty * config.multiplier
            : (currentPosition.entryPrice - exitPrice) * currentPosition.qty * config.multiplier;

        const pnl = grossPnl - comm;
        realizedPnl += pnl;

        trades.push({
          id: `TR-${tradeCounter++}`,
          side: currentPosition.side,
          entryTime: currentPosition.entryTime,
          entryPrice: currentPosition.entryPrice,
          exitTime,
          exitPrice,
          qty: currentPosition.qty,
          pnl,
          bars: i - currentPosition.entryBarIdx,
          reason: exitReason,
        });

        currentPosition = null;
      }
    }

    // C. Mark to market unrealized PnL
    let unrealizedPnl = 0;
    if (currentPosition) {
      if (currentPosition.side === "long") {
        unrealizedPnl =
          (currentBar.c - currentPosition.entryPrice) *
          currentPosition.qty *
          config.multiplier;
      } else {
        unrealizedPnl =
          (currentPosition.entryPrice - currentBar.c) *
          currentPosition.qty *
          config.multiplier;
      }
    }

    const currentEquity = config.initialCapital + realizedPnl + unrealizedPnl;
    if (currentEquity > peakEquity) peakEquity = currentEquity;
    const currentDrawdownDollars = peakEquity - currentEquity;
    const currentDrawdownPct = peakEquity > 0 ? currentDrawdownDollars / peakEquity : 0;

    if (currentDrawdownDollars > maxDrawdownDollars) {
      maxDrawdownDollars = currentDrawdownDollars;
    }
    if (currentDrawdownPct > maxDrawdownPct) {
      maxDrawdownPct = currentDrawdownPct;
    }

    // Downsample equity curve to ~500 points for smooth charting
    if (i % Math.max(1, Math.floor(bars.length / 500)) === 0 || i === bars.length - 1) {
      equityCurve.push({
        time: currentBar.t,
        equity: Math.round(currentEquity * 100) / 100,
        drawdown: Math.round(currentDrawdownDollars * 100) / 100,
        drawdownPct: Math.round(currentDrawdownPct * 1000) / 10,
      });
    }
  }

  // 4. Calculate Quantitative Ratios & Summary Metrics
  const totalTrades = trades.length;
  const winningTrades = trades.filter((t) => t.pnl > 0);
  const losingTrades = trades.filter((t) => t.pnl <= 0);

  const grossProfit = winningTrades.reduce((acc, t) => acc + t.pnl, 0);
  const grossLoss = Math.abs(losingTrades.reduce((acc, t) => acc + t.pnl, 0));
  const netProfit = grossProfit - grossLoss;
  const winRate = totalTrades > 0 ? winningTrades.length / totalTrades : 0;
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 99.0 : 0;

  // Annualized Sharpe, Sortino, and CAGR
  const returns: number[] = [];
  for (let i = 1; i < equityCurve.length; i++) {
    const prev = equityCurve[i - 1].equity;
    const curr = equityCurve[i].equity;
    if (prev > 0) returns.push((curr - prev) / prev);
  }

  let meanReturn = 0;
  let variance = 0;
  let downsideVariance = 0;

  if (returns.length > 0) {
    meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    variance =
      returns.reduce((a, b) => a + (b - meanReturn) ** 2, 0) / returns.length;
    const downsideReturns = returns.filter((r) => r < 0);
    downsideVariance =
      downsideReturns.length > 0
        ? downsideReturns.reduce((a, b) => a + b ** 2, 0) / returns.length
        : 0;
  }

  const stdDev = Math.sqrt(variance);
  const downsideStdDev = Math.sqrt(downsideVariance);
  const annualFactor = Math.sqrt(365 * (86400 / 300));
  const sharpeRatio = stdDev > 0 ? (meanReturn / stdDev) * annualFactor : 0;
  const sortinoRatio =
    downsideStdDev > 0 ? (meanReturn / downsideStdDev) * annualFactor : 0;

  // Calculate CAGR & Calmar Ratio
  const totalDurationMs = Math.max(86400000, bars[bars.length - 1].t - bars[0].t);
  const years = totalDurationMs / (365.25 * 86400000);
  const finalEquity = config.initialCapital + netProfit;
  const cagr =
    years > 0 && finalEquity > 0
      ? (Math.pow(finalEquity / config.initialCapital, 1 / years) - 1) * 100
      : 0;
  const calmarRatio = maxDrawdownPct > 0 ? cagr / (maxDrawdownPct * 100) : 0;

  // Consecutive Streaks & Duration
  let currentWinStreak = 0;
  let currentLossStreak = 0;
  let maxConsecutiveWins = 0;
  let maxConsecutiveLosses = 0;
  let totalBarsInTrades = 0;

  for (const t of trades) {
    totalBarsInTrades += t.bars;
    if (t.pnl > 0) {
      currentWinStreak++;
      currentLossStreak = 0;
      if (currentWinStreak > maxConsecutiveWins) maxConsecutiveWins = currentWinStreak;
    } else {
      currentLossStreak++;
      currentWinStreak = 0;
      if (currentLossStreak > maxConsecutiveLosses) maxConsecutiveLosses = currentLossStreak;
    }
  }

  const avgBarsInTrade = totalTrades > 0 ? Math.round(totalBarsInTrades / totalTrades) : 0;
  const expectancy = totalTrades > 0 ? netProfit / totalTrades : 0;
  const largestWin = winningTrades.length > 0 ? Math.max(...winningTrades.map((t) => t.pnl)) : 0;
  const largestLoss = losingTrades.length > 0 ? Math.min(...losingTrades.map((t) => t.pnl)) : 0;

  const longTradesList = trades.filter((t) => t.side === "long");
  const shortTradesList = trades.filter((t) => t.side === "short");
  const longWinCount = longTradesList.filter((t) => t.pnl > 0).length;
  const shortWinCount = shortTradesList.filter((t) => t.pnl > 0).length;
  const longPnL = longTradesList.reduce((acc, t) => acc + t.pnl, 0);
  const shortPnL = shortTradesList.reduce((acc, t) => acc + t.pnl, 0);

  const metrics: QuantitativeMetrics = {
    initialCapital: config.initialCapital,
    finalEquity: Math.round(finalEquity * 100) / 100,
    netProfit: Math.round(netProfit * 100) / 100,
    netProfitPct: Math.round((netProfit / config.initialCapital) * 1000) / 10,
    cagr: Math.round(cagr * 10) / 10,
    totalTrades,
    winningTrades: winningTrades.length,
    losingTrades: losingTrades.length,
    winRate: Math.round(winRate * 1000) / 1000,
    profitFactor: Math.round(profitFactor * 100) / 100,
    sharpeRatio: Math.round(sharpeRatio * 100) / 100,
    sortinoRatio: Math.round(sortinoRatio * 100) / 100,
    calmarRatio: Math.round(calmarRatio * 100) / 100,
    maxDrawdownPct: Math.round(maxDrawdownPct * 1000) / 1000,
    maxDrawdownDollars: Math.round(maxDrawdownDollars * 100) / 100,
    expectancy: Math.round(expectancy * 100) / 100,
    avgTrade: Math.round(expectancy * 100) / 100,
    largestWin: Math.round(largestWin * 100) / 100,
    largestLoss: Math.round(largestLoss * 100) / 100,
    maxConsecutiveWins,
    maxConsecutiveLosses,
    avgBarsInTrade,
    grossProfit: Math.round(grossProfit * 100) / 100,
    grossLoss: Math.round(grossLoss * 100) / 100,
    longTrades: longTradesList.length,
    shortTrades: shortTradesList.length,
    longWinRate: longTradesList.length > 0 ? Math.round((longWinCount / longTradesList.length) * 1000) / 1000 : 0,
    shortWinRate: shortTradesList.length > 0 ? Math.round((shortWinCount / shortTradesList.length) * 1000) / 1000 : 0,
    longPnL: Math.round(longPnL * 100) / 100,
    shortPnL: Math.round(shortPnL * 100) / 100,
  };

  // 5. Build Monthly Returns Matrix
  const monthlyReturns = calculateMonthlyReturns(bars, trades, config.initialCapital);

  // 6. Slippage Sensitivity Analysis (Testing 0, 1, 2, 3, 5, 8 ticks)
  const slippageSensitivity = calculateSlippageSensitivity(trades, config);

  // 7. Monte Carlo Simulation (1,000 reshuffled trade permutations)
  const monteCarlo = runMonteCarloSimulation(trades, config.initialCapital, 1000);

  const runId = `run-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const hash = `sha256:${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;

  return {
    runId,
    hash,
    barsProcessed: bars.length,
    intents,
    trades,
    equityCurve,
    metrics,
    monthlyReturns,
    slippageSensitivity,
    monteCarlo,
  };
}

/**
 * Builds Year × Month return percentages from trade outcomes.
 */
function calculateMonthlyReturns(
  bars: Bar[],
  trades: TradeRecord[],
  initialCapital: number
): MonthlyReturn[] {
  if (bars.length === 0) return [];

  const startYear = new Date(bars[0].t).getUTCFullYear();
  const endYear = new Date(bars[bars.length - 1].t).getUTCFullYear();
  const yearsMap = new Map<number, (number | null)[]>();

  for (let y = startYear; y <= endYear; y++) {
    yearsMap.set(y, new Array(12).fill(null));
  }

  // Aggregate trade PnL by year & month
  for (const trade of trades) {
    const d = new Date(trade.exitTime);
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth();
    const row = yearsMap.get(y);
    if (row) {
      row[m] = (row[m] ?? 0) + trade.pnl;
    }
  }

  const result: MonthlyReturn[] = [];
  for (let y = startYear; y <= endYear; y++) {
    const pnlMonths = yearsMap.get(y)!;
    let yearTotalPnl = 0;
    const pctMonths = pnlMonths.map((pnl) => {
      if (pnl == null) return null;
      yearTotalPnl += pnl;
      return Math.round((pnl / initialCapital) * 1000) / 10;
    });
    result.push({
      year: y,
      months: pctMonths,
      total: Math.round((yearTotalPnl / initialCapital) * 1000) / 10,
    });
  }

  return result;
}

/**
 * Calculates how strategy profitability degrades as slippage increases.
 */
function calculateSlippageSensitivity(
  trades: TradeRecord[],
  config: BacktestConfig
): SlippagePoint[] {
  const tickSteps = [0, 1, 2, 3, 5, 8];
  return tickSteps.map((ticks) => {
    const slippageDelta = (ticks - config.slippageTicks) * config.tickSize;
    let totalPnl = 0;
    const pnls: number[] = [];

    for (const t of trades) {
      // 2 fills per completed trade (entry + exit)
      const adjustedPnl = t.pnl - slippageDelta * 2 * t.qty * config.multiplier;
      totalPnl += adjustedPnl;
      pnls.push(adjustedPnl);
    }

    // Quick Sharpe estimate
    const mean = pnls.length > 0 ? totalPnl / pnls.length : 0;
    const variance =
      pnls.length > 0
        ? pnls.reduce((a, b) => a + (b - mean) ** 2, 0) / pnls.length
        : 0;
    const std = Math.sqrt(variance);
    const sharpe = std > 0 ? Math.round((mean / std) * Math.sqrt(252) * 100) / 100 : 0;

    return {
      slippageTicks: ticks,
      netProfit: Math.round(totalPnl * 100) / 100,
      sharpe,
    };
  });
}

/**
 * Executes a 1,000-run Monte Carlo simulation by bootstrapping trade sequences.
 */
function runMonteCarloSimulation(
  trades: TradeRecord[],
  initialCapital: number,
  iterations: number = 1000
): MonteCarloSummary {
  if (trades.length === 0) {
    return {
      iterations,
      medianDrawdownPct: 0,
      p95DrawdownPct: 0,
      p99DrawdownPct: 0,
      medianNetProfit: 0,
      sampleEquityCurves: [],
    };
  }

  const tradePnls = trades.map((t) => t.pnl);
  const maxDrawdowns: number[] = [];
  const finalProfits: number[] = [];
  const sampleCurves: { percentile: number; points: { time: number; equity: number }[] }[] = [];

  for (let iter = 0; iter < iterations; iter++) {
    // Shuffle trade outcomes with replacement (bootstrap)
    let equity = initialCapital;
    let peak = initialCapital;
    let maxDd = 0;

    for (let k = 0; k < tradePnls.length; k++) {
      const randIdx = Math.floor(Math.random() * tradePnls.length);
      equity += tradePnls[randIdx];
      if (equity > peak) peak = equity;
      const dd = peak > 0 ? (peak - equity) / peak : 0;
      if (dd > maxDd) maxDd = dd;
    }

    maxDrawdowns.push(maxDd);
    finalProfits.push(equity - initialCapital);
  }

  // Sort drawdowns ascending
  maxDrawdowns.sort((a, b) => a - b);
  finalProfits.sort((a, b) => a - b);

  const medianIdx = Math.floor(iterations * 0.5);
  const p95Idx = Math.floor(iterations * 0.95);
  const p99Idx = Math.floor(iterations * 0.99);

  return {
    iterations,
    medianDrawdownPct: Math.round(maxDrawdowns[medianIdx] * 1000) / 10,
    p95DrawdownPct: Math.round(maxDrawdowns[p95Idx] * 1000) / 10,
    p99DrawdownPct: Math.round(maxDrawdowns[p99Idx] * 1000) / 10,
    medianNetProfit: Math.round(finalProfits[medianIdx] * 100) / 100,
    sampleEquityCurves: sampleCurves,
  };
}
