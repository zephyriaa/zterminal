/**
 * Context-Rich Alerts Engine
 * Multi-factor institutional alert evaluation:
 * - Multi-condition confluence (Price, VWAP, RVOL, CVD/Order-Flow Delta, Regime)
 * - Cooldown & deduplication lifecycle management
 * - Rich telemetry payload generation (severity, audio cue, descriptive institutional summary)
 */

import type { MarketRegimeKind } from "@/domain/models";

export type AlertSeverity = "INFO" | "NOTICE" | "WARNING" | "CRITICAL";

export interface MarketConfluenceSnapshot {
  symbol: string;
  price: number;
  previousPrice: number;
  vwap?: number;
  rvol?: number; // Relative Volume e.g. 1.8x
  delta?: number; // Order Flow Net Delta
  deltaPercent?: number; // Delta as % of volume
  regime?: MarketRegimeKind;
  session?: "ASIA" | "LONDON" | "NEW_YORK" | "POST_MARKET";
  timestamp: number;
}

export interface ContextRichAlertRule {
  id: string;
  symbol: string;
  name: string;
  severity: AlertSeverity;
  cooldownMs: number; // Prevent re-trigger within this duration
  // Confluence triggers
  priceLevel?: { level: number; direction: "ABOVE" | "BELOW" };
  vwapCross?: { direction: "ABOVE" | "BELOW" };
  minRvol?: number; // e.g. 1.5 (Must have at least 1.5x average volume)
  deltaFilter?: "POSITIVE" | "NEGATIVE";
  requiredRegime?: MarketRegimeKind;
  allowedSessions?: string[];
}

export interface DispatchedAlert {
  ruleId: string;
  ruleName: string;
  symbol: string;
  severity: AlertSeverity;
  headline: string;
  contextSummary: string;
  snapshot: MarketConfluenceSnapshot;
  triggeredAt: number;
  soundCue?: "CHIME" | "BELL" | "ALARM" | "ALERT";
}

export class ContextAlertManager {
  private rules = new Map<string, ContextRichAlertRule>();
  private lastTriggeredTimes = new Map<string, number>();

  public registerRule(rule: ContextRichAlertRule): void {
    this.rules.set(rule.id, rule);
  }

  public removeRule(ruleId: string): void {
    this.rules.delete(ruleId);
    this.lastTriggeredTimes.delete(ruleId);
  }

  public getRules(): ContextRichAlertRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Evaluates a live snapshot against all registered rules for the symbol.
   * Returns triggered alerts that satisfied all confluence conditions and passed cooldown.
   */
  public evaluate(snapshot: MarketConfluenceSnapshot): DispatchedAlert[] {
    const triggered: DispatchedAlert[] = [];
    const now = snapshot.timestamp || Date.now();

    for (const rule of this.rules.values()) {
      if (rule.symbol !== snapshot.symbol) continue;

      // 1. Cooldown check
      const lastTrigger = this.lastTriggeredTimes.get(rule.id) ?? 0;
      if (now - lastTrigger < rule.cooldownMs) {
        continue;
      }

      // 2. Price level check
      if (rule.priceLevel) {
        const { level, direction } = rule.priceLevel;
        const crossed =
          direction === "ABOVE"
            ? snapshot.previousPrice < level && snapshot.price >= level
            : snapshot.previousPrice > level && snapshot.price <= level;
        if (!crossed) continue;
      }

      // 3. VWAP cross check
      if (rule.vwapCross && snapshot.vwap !== undefined) {
        const { direction } = rule.vwapCross;
        const crossed =
          direction === "ABOVE"
            ? snapshot.previousPrice < snapshot.vwap && snapshot.price >= snapshot.vwap
            : snapshot.previousPrice > snapshot.vwap && snapshot.price <= snapshot.vwap;
        if (!crossed) continue;
      }

      // 4. RVOL check
      if (rule.minRvol !== undefined) {
        if (snapshot.rvol === undefined || snapshot.rvol < rule.minRvol) {
          continue;
        }
      }

      // 5. Delta filter
      if (rule.deltaFilter) {
        if (snapshot.delta === undefined) continue;
        if (rule.deltaFilter === "POSITIVE" && snapshot.delta <= 0) continue;
        if (rule.deltaFilter === "NEGATIVE" && snapshot.delta >= 0) continue;
      }

      // 6. Regime check
      if (rule.requiredRegime) {
        if (snapshot.regime !== rule.requiredRegime) continue;
      }

      // 7. Session check
      if (rule.allowedSessions && rule.allowedSessions.length > 0) {
        if (!snapshot.session || !rule.allowedSessions.includes(snapshot.session)) {
          continue;
        }
      }

      // All confluence conditions met! Record trigger time
      this.lastTriggeredTimes.set(rule.id, now);

      // Build rich context telemetry
      const contextParts: string[] = [
        `Price: ${snapshot.price.toFixed(2)}`,
      ];
      if (snapshot.rvol !== undefined) contextParts.push(`RVOL: ${snapshot.rvol.toFixed(1)}x`);
      if (snapshot.delta !== undefined) {
        const sign = snapshot.delta > 0 ? "+" : "";
        contextParts.push(`Delta: ${sign}${snapshot.delta.toFixed(0)}`);
      }
      if (snapshot.session) contextParts.push(`Session: ${snapshot.session}`);
      if (snapshot.regime) contextParts.push(`Regime: ${snapshot.regime}`);

      const headline = `[${rule.severity}] ${rule.name}: ${snapshot.symbol} @ ${snapshot.price.toFixed(2)}`;
      const contextSummary = contextParts.join(" | ");

      let soundCue: DispatchedAlert["soundCue"] = "CHIME";
      if (rule.severity === "WARNING") soundCue = "BELL";
      if (rule.severity === "CRITICAL") soundCue = "ALARM";

      triggered.push({
        ruleId: rule.id,
        ruleName: rule.name,
        symbol: snapshot.symbol,
        severity: rule.severity,
        headline,
        contextSummary,
        snapshot,
        triggeredAt: now,
        soundCue,
      });
    }

    return triggered;
  }

  public resetCooldowns(): void {
    this.lastTriggeredTimes.clear();
  }
}
