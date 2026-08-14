import type { AlertContext, AlertType, MarketRegimeKind, UtcMillis } from "@/domain/models";

export type AlertRule =
  | { type: "PRICE_LEVEL_REACHED"; direction: "above" | "below"; level: number }
  | { type: "VWAP_CROSS"; direction: "above" | "below" }
  | { type: "VWAP_REJECTION"; direction: "above" | "below" }
  | { type: "ORB_BREAKOUT"; direction: "above" | "below"; level: number }
  | { type: "REGIME_CHANGED"; from?: MarketRegimeKind; to: MarketRegimeKind }
  | { type: "RISK_THRESHOLD"; threshold: number; metric: "daily_loss" | "weekly_loss" | "gross_exposure" }
  | { type: "SETUP_CONFIRMED"; setupId: string };

export interface AlertObservation {
  observedAt: UtcMillis;
  instrument: string;
  price?: number;
  previousPrice?: number;
  vwap?: number;
  previousVwap?: number;
  regime?: MarketRegimeKind;
  previousRegime?: MarketRegimeKind;
  risk?: Partial<Record<"daily_loss" | "weekly_loss" | "gross_exposure", number>>;
  setupId?: string;
  context: AlertContext;
}

export interface AlertEvaluation {
  triggered: boolean;
  type: AlertType;
  reason: string;
  observedAt: UtcMillis;
  context: AlertContext;
}

/**
 * Evaluates data already obtained by an application service. This module neither sends a
 * notification nor creates a trade instruction; cooldown/deduplication belongs to the alert service.
 */
export function evaluateAlertRule(rule: AlertRule, observation: AlertObservation): AlertEvaluation {
  const base = {
    type: rule.type,
    observedAt: observation.observedAt,
    context: observation.context,
  } satisfies Omit<AlertEvaluation, "triggered" | "reason">;

  const missing = (reason: string): AlertEvaluation => ({ ...base, triggered: false, reason });
  const result = (triggered: boolean, reason: string): AlertEvaluation => ({ ...base, triggered, reason });

  if (rule.type === "PRICE_LEVEL_REACHED" || rule.type === "ORB_BREAKOUT") {
    if (!Number.isFinite(observation.price) || !Number.isFinite(observation.previousPrice)) {
      return missing("Current and previous price are required to evaluate a crossing.");
    }
    const crossed = rule.direction === "above"
      ? observation.previousPrice! < rule.level && observation.price! >= rule.level
      : observation.previousPrice! > rule.level && observation.price! <= rule.level;
    return result(crossed, crossed ? `Price crossed ${rule.direction} ${rule.level}.` : "Price did not cross the configured level.");
  }

  if (rule.type === "VWAP_CROSS") {
    if (![observation.price, observation.previousPrice, observation.vwap, observation.previousVwap].every(Number.isFinite)) {
      return missing("Current and previous price and VWAP are required to evaluate a VWAP cross.");
    }
    const priorDifference = observation.previousPrice! - observation.previousVwap!;
    const difference = observation.price! - observation.vwap!;
    const crossed = rule.direction === "above" ? priorDifference < 0 && difference >= 0 : priorDifference > 0 && difference <= 0;
    return result(crossed, crossed ? `Price crossed ${rule.direction} session VWAP.` : "Price did not cross session VWAP.");
  }

  if (rule.type === "VWAP_REJECTION") {
    if (![observation.price, observation.previousPrice, observation.vwap].every(Number.isFinite)) {
      return missing("Current and previous price plus VWAP are required to evaluate a rejection.");
    }
    const rejected = rule.direction === "above"
      ? observation.previousPrice! >= observation.vwap! && observation.price! < observation.vwap!
      : observation.previousPrice! <= observation.vwap! && observation.price! > observation.vwap!;
    return result(rejected, rejected ? `Price rejected ${rule.direction} VWAP context.` : "No VWAP rejection was detected.");
  }

  if (rule.type === "REGIME_CHANGED") {
    if (!observation.regime) return missing("Current regime is unavailable.");
    const triggered = observation.regime === rule.to && (!rule.from || observation.previousRegime === rule.from);
    return result(triggered, triggered ? `Regime changed to ${rule.to}.` : "Configured regime transition did not occur.");
  }

  if (rule.type === "RISK_THRESHOLD") {
    const value = observation.risk?.[rule.metric];
    if (!Number.isFinite(value)) return missing(`Risk metric ${rule.metric} is unavailable.`);
    return result(value! >= rule.threshold, `${rule.metric} is ${value}; threshold is ${rule.threshold}.`);
  }

  const triggered = observation.setupId === rule.setupId;
  return result(triggered, triggered ? `Setup ${rule.setupId} was confirmed.` : "Configured setup was not confirmed.");
}
