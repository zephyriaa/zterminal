/**
 * Advanced Institutional Risk Engine
 * Features:
 * - Parametric & Historical Value-at-Risk (VaR 95%, 99%)
 * - Expected Shortfall (CVaR)
 * - Maximum Adverse Excursion (MAE) & Maximum Favorable Excursion (MFE)
 * - Dynamic Drawdown Circuit Breakers & Consecutive Loss Halts
 */

export interface VaRMetrics {
  confidence: number; // 0.95 or 0.99
  timeHorizonDays: number;
  parametricVaR: number; // Absolute currency amount
  parametricVaRPercent: number; // Percentage of portfolio
  historicalVaR: number; // Absolute currency amount
  historicalVaRPercent: number;
  expectedShortfallCVaR: number; // Tail risk beyond VaR
}

export interface ExcursionPoint {
  tradeId: string;
  symbol: string;
  pnl: number;
  mae: number; // Worst unrealized negative draw (positive number)
  mfe: number; // Best unrealized positive move
  entryPrice: number;
  exitPrice: number;
}

export interface CircuitBreakerState {
  isTripped: boolean;
  reason?: string;
  trippedAt?: number;
  coolDownUntil?: number;
  currentDrawdownPct: number;
  maxDrawdownLimitPct: number;
  consecutiveLosses: number;
  maxConsecutiveLossLimit: number;
}

export interface AdvancedRiskConfig {
  maxDrawdownPct: number; // e.g. 0.08 (8%)
  maxConsecutiveLosses: number; // e.g. 4
  coolDownDurationMs: number; // e.g. 30 minutes
  dailyLossLimit: number;
}

export class AdvancedRiskEngine {
  private peakEquity: number;
  private currentEquity: number;
  private consecutiveLosses = 0;
  private trippedReason: string | null = null;
  private coolDownUntil = 0;

  constructor(
    initialEquity: number,
    private config: AdvancedRiskConfig = {
      maxDrawdownPct: 0.1, // 10%
      maxConsecutiveLosses: 3,
      coolDownDurationMs: 30 * 60 * 1000,
      dailyLossLimit: 5000,
    },
  ) {
    this.peakEquity = initialEquity;
    this.currentEquity = initialEquity;
  }

  /**
   * Updates current equity and checks peak-to-trough drawdown circuit breaker.
   */
  public updateEquity(equity: number, timestamp = Date.now()): CircuitBreakerState {
    this.currentEquity = equity;
    if (equity > this.peakEquity) {
      this.peakEquity = equity;
    }

    const drawdownPct = this.peakEquity > 0 ? (this.peakEquity - equity) / this.peakEquity : 0;

    if (drawdownPct >= this.config.maxDrawdownPct) {
      this.trippedReason = `Peak-to-trough drawdown reached ${(drawdownPct * 100).toFixed(2)}% (limit: ${(this.config.maxDrawdownPct * 100).toFixed(1)}%)`;
      this.coolDownUntil = timestamp + this.config.coolDownDurationMs;
    }

    return this.getCircuitBreakerStatus(timestamp);
  }

  /**
   * Records a closed trade outcome and checks consecutive loss streak.
   */
  public recordTradeOutcome(pnl: number, timestamp = Date.now()): CircuitBreakerState {
    if (pnl < 0) {
      this.consecutiveLosses++;
      if (this.consecutiveLosses >= this.config.maxConsecutiveLosses) {
        this.trippedReason = `Consecutive loss limit reached (${this.consecutiveLosses} losses)`;
        this.coolDownUntil = timestamp + this.config.coolDownDurationMs;
      }
    } else if (pnl > 0) {
      this.consecutiveLosses = 0;
    }

    return this.getCircuitBreakerStatus(timestamp);
  }

  public getCircuitBreakerStatus(now = Date.now()): CircuitBreakerState {
    const isTripped = this.coolDownUntil > now;
    const drawdownPct = this.peakEquity > 0 ? (this.peakEquity - this.currentEquity) / this.peakEquity : 0;

    return {
      isTripped,
      reason: isTripped ? (this.trippedReason ?? "Cooling down") : undefined,
      coolDownUntil: isTripped ? this.coolDownUntil : undefined,
      currentDrawdownPct: Number(drawdownPct.toFixed(4)),
      maxDrawdownLimitPct: this.config.maxDrawdownPct,
      consecutiveLosses: this.consecutiveLosses,
      maxConsecutiveLossLimit: this.config.maxConsecutiveLosses,
    };
  }

  public resetCircuitBreaker(): void {
    this.trippedReason = null;
    this.coolDownUntil = 0;
    this.consecutiveLosses = 0;
  }
}

/**
 * Computes Parametric VaR, Historical VaR, and Expected Shortfall (CVaR).
 * @param dailyReturns Array of historical fractional returns (e.g. [-0.02, 0.015, -0.01])
 * @param portfolioValue Current total portfolio value in base currency
 * @param confidence Confidence level, e.g. 0.95 or 0.99
 * @param timeHorizonDays Forecast horizon in days (default 1)
 */
export function calculateVaR(
  dailyReturns: number[],
  portfolioValue: number,
  confidence = 0.95,
  timeHorizonDays = 1,
): VaRMetrics {
  if (dailyReturns.length < 5 || portfolioValue <= 0) {
    return {
      confidence,
      timeHorizonDays,
      parametricVaR: 0,
      parametricVaRPercent: 0,
      historicalVaR: 0,
      historicalVaRPercent: 0,
      expectedShortfallCVaR: 0,
    };
  }

  // 1. Parametric VaR (Normal Distribution)
  // Z-scores: 95% = 1.64485, 99% = 2.32635
  const zScore = confidence >= 0.99 ? 2.32635 : 1.64485;
  const mean = dailyReturns.reduce((sum, r) => sum + r, 0) / dailyReturns.length;
  const variance =
    dailyReturns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (dailyReturns.length - 1);
  const stdDev = Math.sqrt(variance);

  const horizonFactor = Math.sqrt(timeHorizonDays);
  const parametricPct = Math.max(0, (zScore * stdDev - mean) * horizonFactor);
  const parametricVaR = Number((portfolioValue * parametricPct).toFixed(2));

  // 2. Historical VaR & CVaR (Empirical Percentile)
  const sorted = [...dailyReturns].sort((a, b) => a - b);
  const percentileIndex = Math.floor((1 - confidence) * sorted.length);
  const cutoffReturn = sorted[Math.max(0, percentileIndex)];
  const historicalPct = Math.max(0, -cutoffReturn * horizonFactor);
  const historicalVaR = Number((portfolioValue * historicalPct).toFixed(2));

  // 3. Expected Shortfall (CVaR) - average of all returns worse than cutoff
  const tailReturns = sorted.slice(0, Math.max(1, percentileIndex + 1));
  const avgTailLoss = tailReturns.reduce((sum, r) => sum + r, 0) / tailReturns.length;
  const cvarPct = Math.max(0, -avgTailLoss * horizonFactor);
  const expectedShortfallCVaR = Number((portfolioValue * cvarPct).toFixed(2));

  return {
    confidence,
    timeHorizonDays,
    parametricVaR,
    parametricVaRPercent: Number((parametricPct * 100).toFixed(2)),
    historicalVaR,
    historicalVaRPercent: Number((historicalPct * 100).toFixed(2)),
    expectedShortfallCVaR,
  };
}

/**
 * Calculates Maximum Adverse Excursion (MAE) and Maximum Favorable Excursion (MFE)
 * for a series of intra-trade price ticks or high/low bars.
 */
export function calculateExcursion(
  tradeId: string,
  symbol: string,
  direction: "long" | "short",
  entryPrice: number,
  exitPrice: number,
  barHighs: number[],
  barLows: number[],
): ExcursionPoint {
  let highestHigh = entryPrice;
  let lowestLow = entryPrice;

  for (let i = 0; i < barHighs.length; i++) {
    if (barHighs[i] > highestHigh) highestHigh = barHighs[i];
    if (barLows[i] < lowestLow) lowestLow = barLows[i];
  }

  let mae = 0;
  let mfe = 0;
  let pnl = 0;

  if (direction === "long") {
    mae = Math.max(0, entryPrice - lowestLow);
    mfe = Math.max(0, highestHigh - entryPrice);
    pnl = exitPrice - entryPrice;
  } else {
    mae = Math.max(0, highestHigh - entryPrice);
    mfe = Math.max(0, entryPrice - lowestLow);
    pnl = entryPrice - exitPrice;
  }

  return {
    tradeId,
    symbol,
    pnl: Number(pnl.toFixed(4)),
    mae: Number(mae.toFixed(4)),
    mfe: Number(mfe.toFixed(4)),
    entryPrice,
    exitPrice,
  };
}
