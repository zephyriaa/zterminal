import type {
  Instrument,
  Position,
  RiskEvaluation,
  RiskPlan,
  TradePlan,
} from "@/domain/models";

export interface RiskEvaluationContext {
  instrument: Instrument;
  riskPlan: RiskPlan;
  existingPositions: Position[];
  realizedDailyLoss: number;
  realizedWeeklyLoss: number;
}

function isFinitePositive(value: number) {
  return Number.isFinite(value) && value > 0;
}

function priceDistanceForDirection(plan: TradePlan) {
  return plan.direction === "long"
    ? plan.entryPrice - plan.stopPrice
    : plan.stopPrice - plan.entryPrice;
}

/**
 * Evaluates a review-only trade plan. It does not submit, queue, or alter an order.
 * Quantity is reduced when the requested plan exceeds configured per-trade risk.
 */
export function evaluateTradePlan(
  plan: TradePlan,
  context: RiskEvaluationContext,
): RiskEvaluation {
  const reasons: string[] = [];
  const { instrument, riskPlan, existingPositions, realizedDailyLoss, realizedWeeklyLoss } = context;
  const { multiplier } = instrument.metadata;

  if (!isFinitePositive(riskPlan.accountEquity) || !isFinitePositive(riskPlan.maxRiskPerTrade)) {
    return rejected("Risk-plan equity and per-trade risk must be positive finite values.");
  }
  if (!isFinitePositive(plan.entryPrice) || !isFinitePositive(plan.stopPrice)) {
    return rejected("Entry and stop prices must be positive finite values.");
  }
  if (!Number.isInteger(plan.requestedQuantity) || plan.requestedQuantity <= 0) {
    return rejected("Requested quantity must be a positive whole number.");
  }
  if (!isFinitePositive(multiplier)) {
    return rejected("Instrument multiplier is unavailable or invalid.");
  }

  const stopDistance = priceDistanceForDirection(plan);
  if (!isFinitePositive(stopDistance)) {
    return rejected("Stop price must be below entry for a long plan and above entry for a short plan.");
  }

  const perUnitRisk = stopDistance * multiplier;
  const riskBudget = riskPlan.maxRiskPerTrade;
  const maxQuantityByRisk = Math.floor(riskBudget / perUnitRisk);
  if (maxQuantityByRisk < 1) {
    return rejected("Configured per-trade risk cannot support one unit at the proposed stop distance.", perUnitRisk);
  }

  if (realizedDailyLoss >= riskPlan.maxDailyLoss) {
    return rejected("Daily loss limit has already been reached.", perUnitRisk);
  }
  if (realizedWeeklyLoss >= riskPlan.maxWeeklyLoss) {
    return rejected("Weekly loss limit has already been reached.", perUnitRisk);
  }

  const approvedQuantity = Math.min(plan.requestedQuantity, maxQuantityByRisk);
  if (approvedQuantity < plan.requestedQuantity) {
    reasons.push("Quantity was reduced to respect the configured per-trade risk limit.");
  }

  const currentGrossExposure = existingPositions.reduce(
    (sum, position) => sum + Math.abs(position.quantity * position.averageEntryPrice * multiplier),
    0,
  );
  const proposedGrossExposure = approvedQuantity * plan.entryPrice * multiplier;
  const grossExposure = currentGrossExposure + proposedGrossExposure;
  if (grossExposure > riskPlan.maxGrossExposure) {
    return {
      decision: "rejected",
      reasons: ["Proposed trade would exceed the configured gross exposure limit."],
      approvedQuantity: 0,
      perUnitRisk,
      estimatedLoss: 0,
      grossExposure,
    };
  }

  const estimatedLoss = approvedQuantity * perUnitRisk;
  const targetDistance = plan.targetPrice === undefined
    ? undefined
    : plan.direction === "long"
      ? plan.targetPrice - plan.entryPrice
      : plan.entryPrice - plan.targetPrice;
  const estimatedProfit = targetDistance && targetDistance > 0
    ? targetDistance * multiplier * approvedQuantity
    : undefined;
  const rewardToRisk = estimatedProfit === undefined ? undefined : estimatedProfit / estimatedLoss;

  if (plan.executionPermission !== "user_confirmed") {
    reasons.push("Trade plan remains review-only until the user explicitly confirms manual execution.");
    return {
      decision: "needs_review",
      reasons,
      approvedQuantity,
      perUnitRisk,
      estimatedLoss,
      estimatedProfit,
      rewardToRisk,
      grossExposure,
    };
  }

  reasons.push("Risk checks passed; this result authorizes review only and does not submit an order.");
  return {
    decision: "accepted",
    reasons,
    approvedQuantity,
    perUnitRisk,
    estimatedLoss,
    estimatedProfit,
    rewardToRisk,
    grossExposure,
  };
}

function rejected(reason: string, perUnitRisk = 0): RiskEvaluation {
  return {
    decision: "rejected",
    reasons: [reason],
    approvedQuantity: 0,
    perUnitRisk,
    estimatedLoss: 0,
    grossExposure: 0,
  };
}
