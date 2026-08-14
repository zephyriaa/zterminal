import type { DatasetId, StrategyId, StrategyVersionId, UtcMillis } from "@/domain/models";
import type { Timeframe } from "@/lib/market/types";

export type RuleOperand =
  | { kind: "number"; value: number }
  | { kind: "field"; value: "open" | "high" | "low" | "close" | "volume" }
  | { kind: "indicator"; indicator: "sma" | "ema" | "vwap" | "atr" | "rsi"; period?: number }
  | { kind: "parameter"; name: string };

export type RuleExpression =
  | { kind: "comparison"; left: RuleOperand; operator: ">" | ">=" | "<" | "<=" | "=="; right: RuleOperand }
  | { kind: "crosses_above" | "crosses_below"; left: RuleOperand; right: RuleOperand }
  | { kind: "all" | "any"; expressions: RuleExpression[] }
  | { kind: "not"; expression: RuleExpression };

export interface StrategyParameter {
  name: string;
  type: "number" | "boolean" | "string";
  defaultValue: number | boolean | string;
  min?: number;
  max?: number;
}

export interface StrategyRiskModel {
  sizing: "fixed_quantity" | "fixed_risk" | "volatility_adjusted";
  maxQuantity?: number;
  maxRisk?: number;
}

export interface StrategyDefinition {
  id: StrategyId;
  versionId: StrategyVersionId;
  version: number;
  name: string;
  instruments: string[];
  timeframe: Timeframe;
  sessionId: string;
  parameters: StrategyParameter[];
  entry: { long?: RuleExpression; short?: RuleExpression };
  exit: RuleExpression[];
  filters: RuleExpression[];
  risk: StrategyRiskModel;
  datasetId?: DatasetId;
  createdAt: UtcMillis;
  parentVersionId?: StrategyVersionId;
  /** Existing ZS source is retained as an optional migration representation. */
  legacySource?: { language: "zs"; source: string };
}

export interface StrategyValidationIssue {
  path: string;
  message: string;
}

export function validateStrategyDefinition(strategy: StrategyDefinition): StrategyValidationIssue[] {
  const issues: StrategyValidationIssue[] = [];
  if (!strategy.name.trim()) issues.push({ path: "name", message: "Strategy name is required." });
  if (!Number.isInteger(strategy.version) || strategy.version < 1) {
    issues.push({ path: "version", message: "Strategy version must be a positive integer." });
  }
  if (!strategy.instruments.length) issues.push({ path: "instruments", message: "At least one instrument is required." });
  if (!strategy.entry.long && !strategy.entry.short) {
    issues.push({ path: "entry", message: "At least one long or short entry expression is required." });
  }
  const parameterNames = new Set<string>();
  for (const [index, parameter] of strategy.parameters.entries()) {
    const path = `parameters[${index}]`;
    if (!parameter.name.trim()) issues.push({ path, message: "Parameter name is required." });
    if (parameterNames.has(parameter.name)) issues.push({ path, message: "Parameter names must be unique." });
    parameterNames.add(parameter.name);
    if (parameter.type === "number" && typeof parameter.defaultValue !== "number") {
      issues.push({ path, message: "Numeric parameters require numeric default values." });
    }
    if (parameter.min !== undefined && parameter.max !== undefined && parameter.min > parameter.max) {
      issues.push({ path, message: "Parameter minimum cannot exceed its maximum." });
    }
  }
  if (strategy.risk.sizing === "fixed_quantity" && (!strategy.risk.maxQuantity || strategy.risk.maxQuantity < 1)) {
    issues.push({ path: "risk.maxQuantity", message: "Fixed-quantity strategies require a positive maximum quantity." });
  }
  if (strategy.risk.sizing !== "fixed_quantity" && (!strategy.risk.maxRisk || strategy.risk.maxRisk <= 0)) {
    issues.push({ path: "risk.maxRisk", message: "Risk-based strategies require a positive maximum risk." });
  }
  return issues;
}
