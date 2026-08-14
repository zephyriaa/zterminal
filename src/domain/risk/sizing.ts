export interface FixedRiskSizingInput {
  accountEquity: number;
  riskPercent: number;
  stopDistance: number;
  tickSize: number;
  multiplier: number;
}

export interface FixedRiskSizingResult {
  valid: boolean;
  riskAmount: number;
  stopTicks: number;
  perUnitRisk: number;
  maxQuantity: number;
}

/**
 * Calculates maximum whole-unit position size from explicit instrument metadata.
 * The caller remains responsible for account policy, fees, margin, liquidity, and final user review.
 */
export function calculateFixedRiskSizing(input: FixedRiskSizingInput): FixedRiskSizingResult {
  const { accountEquity, riskPercent, stopDistance, tickSize, multiplier } = input;
  if (![accountEquity, riskPercent, stopDistance, tickSize, multiplier].every(Number.isFinite)) {
    return invalidSizing();
  }
  if (accountEquity < 0 || riskPercent < 0 || stopDistance < 0 || tickSize <= 0 || multiplier <= 0) {
    return invalidSizing();
  }
  const riskAmount = accountEquity * (riskPercent / 100);
  const stopTicks = stopDistance / tickSize;
  const perUnitRisk = stopDistance * multiplier;
  return {
    valid: perUnitRisk > 0 && riskAmount > 0,
    riskAmount,
    stopTicks,
    perUnitRisk,
    maxQuantity: perUnitRisk > 0 ? Math.floor(riskAmount / perUnitRisk) : 0,
  };
}

function invalidSizing(): FixedRiskSizingResult {
  return { valid: false, riskAmount: 0, stopTicks: 0, perUnitRisk: 0, maxQuantity: 0 };
}
