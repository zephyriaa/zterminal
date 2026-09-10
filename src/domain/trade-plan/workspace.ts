/**
 * Advanced Trade-Plan Workspace
 * Multi-scenario planning, partial scaling brackets, expected value modeling,
 * and lifecycle state machine.
 */

import type { TradeDirection, UtcMillis } from "@/domain/models";

export type TradePlanStatus = "DRAFT" | "EVALUATED" | "STAGED" | "ACTIVE" | "COMPLETED" | "CANCELLED";

export interface TargetBracket {
  targetPrice: number;
  percentageQuantity: number; // e.g. 50 for 50%
  rMultiple: number;
  projectedProfit: number;
}

export interface TradeScenario {
  name: "CONSERVATIVE" | "BASE" | "AGGRESSIVE";
  targetPrice: number;
  rMultiple: number;
  winProbabilityPct: number;
  expectedValue: number;
}

export interface AdvancedTradePlan {
  id: string;
  symbol: string;
  direction: TradeDirection;
  status: TradePlanStatus;
  entryPrice: number;
  stopPrice: number;
  initialRiskPerUnit: number;
  quantity: number;
  capitalAtRisk: number;
  breakevenWinRatePct: number; // 1 / (1 + R) * 100
  brackets: TargetBracket[];
  scenarios: TradeScenario[];
  notes?: string;
  createdAt: UtcMillis;
  updatedAt: UtcMillis;
}

export interface PlanCreationInput {
  id?: string;
  symbol: string;
  direction: TradeDirection;
  entryPrice: number;
  stopPrice: number;
  quantity: number;
  brackets?: Array<{ targetPrice: number; percentageQuantity: number }>;
  notes?: string;
}

export class TradePlanWorkspaceManager {
  private plans = new Map<string, AdvancedTradePlan>();

  /**
   * Creates and compiles an advanced multi-scenario trade plan.
   */
  public createPlan(input: PlanCreationInput): AdvancedTradePlan {
    const { symbol, direction, entryPrice, stopPrice, quantity, brackets: rawBrackets, notes } = input;

    if (entryPrice <= 0 || stopPrice <= 0 || quantity <= 0) {
      throw new Error("Entry, stop, and quantity must be positive numbers.");
    }

    const riskPerUnit = direction === "long" ? entryPrice - stopPrice : stopPrice - entryPrice;
    if (riskPerUnit <= 0) {
      throw new Error("Invalid stop price for proposed trade direction.");
    }

    const capitalAtRisk = Number((riskPerUnit * quantity).toFixed(2));

    // Default brackets if none provided: 50% at 2R, 50% at 3R
    const baseTarget1 = direction === "long" ? entryPrice + riskPerUnit * 2 : entryPrice - riskPerUnit * 2;
    const baseTarget2 = direction === "long" ? entryPrice + riskPerUnit * 3 : entryPrice - riskPerUnit * 3;

    const bracketsInput = rawBrackets && rawBrackets.length > 0
      ? rawBrackets
      : [
          { targetPrice: baseTarget1, percentageQuantity: 50 },
          { targetPrice: baseTarget2, percentageQuantity: 50 },
        ];

    // Compute brackets
    const brackets: TargetBracket[] = bracketsInput.map((b) => {
      const targetDist = direction === "long" ? b.targetPrice - entryPrice : entryPrice - b.targetPrice;
      const r = Number((targetDist / riskPerUnit).toFixed(2));
      const partialQty = (quantity * b.percentageQuantity) / 100;
      const projectedProfit = Number((targetDist * partialQty).toFixed(2));
      return {
        targetPrice: b.targetPrice,
        percentageQuantity: b.percentageQuantity,
        rMultiple: r,
        projectedProfit,
      };
    });

    const primaryR = brackets[0]?.rMultiple ?? 2.0;
    const breakevenWinRatePct = Number(((1 / (1 + primaryR)) * 100).toFixed(1));

    // Scenarios: Conservative (1R), Base (2R), Aggressive (4R)
    const consTarget = direction === "long" ? entryPrice + riskPerUnit * 1 : entryPrice - riskPerUnit * 1;
    const baseTarget = direction === "long" ? entryPrice + riskPerUnit * 2 : entryPrice - riskPerUnit * 2;
    const aggTarget = direction === "long" ? entryPrice + riskPerUnit * 4 : entryPrice - riskPerUnit * 4;

    const scenarios: TradeScenario[] = [
      {
        name: "CONSERVATIVE",
        targetPrice: Number(consTarget.toFixed(2)),
        rMultiple: 1.0,
        winProbabilityPct: 65,
        expectedValue: Number((0.65 * (1.0 * capitalAtRisk) - 0.35 * capitalAtRisk).toFixed(2)),
      },
      {
        name: "BASE",
        targetPrice: Number(baseTarget.toFixed(2)),
        rMultiple: 2.0,
        winProbabilityPct: 45,
        expectedValue: Number((0.45 * (2.0 * capitalAtRisk) - 0.55 * capitalAtRisk).toFixed(2)),
      },
      {
        name: "AGGRESSIVE",
        targetPrice: Number(aggTarget.toFixed(2)),
        rMultiple: 4.0,
        winProbabilityPct: 30,
        expectedValue: Number((0.30 * (4.0 * capitalAtRisk) - 0.70 * capitalAtRisk).toFixed(2)),
      },
    ];

    const plan: AdvancedTradePlan = {
      id: input.id ?? `PLAN-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      symbol,
      direction,
      status: "DRAFT",
      entryPrice,
      stopPrice,
      initialRiskPerUnit: Number(riskPerUnit.toFixed(4)),
      quantity,
      capitalAtRisk,
      breakevenWinRatePct,
      brackets,
      scenarios,
      notes,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.plans.set(plan.id, plan);
    return plan;
  }

  public getPlan(id: string): AdvancedTradePlan | undefined {
    return this.plans.get(id);
  }

  public getAllPlans(): AdvancedTradePlan[] {
    return Array.from(this.plans.values());
  }

  /**
   * Transition plan through state machine:
   * DRAFT -> EVALUATED -> STAGED -> ACTIVE -> COMPLETED / CANCELLED
   */
  public transitionStatus(planId: string, nextStatus: TradePlanStatus): AdvancedTradePlan {
    const plan = this.plans.get(planId);
    if (!plan) throw new Error(`Plan ${planId} not found`);

    const validTransitions: Record<TradePlanStatus, TradePlanStatus[]> = {
      DRAFT: ["EVALUATED", "CANCELLED"],
      EVALUATED: ["STAGED", "DRAFT", "CANCELLED"],
      STAGED: ["ACTIVE", "CANCELLED", "DRAFT"],
      ACTIVE: ["COMPLETED", "CANCELLED"],
      COMPLETED: [],
      CANCELLED: [],
    };

    if (!validTransitions[plan.status].includes(nextStatus)) {
      throw new Error(`Illegal state transition from ${plan.status} to ${nextStatus}`);
    }

    plan.status = nextStatus;
    plan.updatedAt = Date.now();
    return plan;
  }

  public removePlan(id: string): boolean {
    return this.plans.delete(id);
  }
}
