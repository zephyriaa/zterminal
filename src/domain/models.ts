import type {
  ContractMetadata,
  DataStatus,
  Environment,
  ProviderId,
  Timeframe,
} from "@/lib/market/types";

/** Opaque identifiers remain strings at the transport boundary but are named in domain contracts. */
export type WorkspaceId = string;
export type StrategyId = string;
export type StrategyVersionId = string;
export type DatasetId = string;
export type BacktestRunId = string;
export type RiskPlanId = string;
export type AlertId = string;
export type JournalEntryId = string;
export type TradePlanId = string;

/** All persisted and transmitted instants are UTC epoch milliseconds. */
export type UtcMillis = number;

export interface DataProvenance {
  provider: ProviderId;
  environment: Environment;
  status: DataStatus;
  observedAt: UtcMillis;
  receivedAt: UtcMillis;
  exchangeTimezone: string;
  datasetId?: DatasetId;
  sourceSequence?: number;
}

export interface Instrument {
  metadata: ContractMetadata;
  canonicalSymbol: string;
  providerSymbol: string;
  activeFrom?: UtcMillis;
  activeTo?: UtcMillis;
}

export interface MarketDataPoint {
  instrument: string;
  timeframe: Timeframe;
  openTime: UtcMillis;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  provenance: DataProvenance;
}

export type MarketRegimeKind = "trend" | "balance" | "high_volatility" | "compression" | "unknown";

export interface MarketRegime {
  instrument: string;
  timeframe: Timeframe;
  observedAt: UtcMillis;
  kind: MarketRegimeKind;
  confidence: number;
  reasons: string[];
}

export type TradeDirection = "long" | "short";

export interface TradingSetup {
  id: string;
  instrument: string;
  direction: TradeDirection;
  detectedAt: UtcMillis;
  strategyVersionId?: StrategyVersionId;
  regime?: MarketRegime;
  context: Record<string, number | string | boolean | null>;
  provenance: DataProvenance;
}

export interface Position {
  instrument: string;
  quantity: number;
  averageEntryPrice: number;
  realizedPnl: number;
  unrealizedPnl: number;
  updatedAt: UtcMillis;
}

export interface RiskPlan {
  id: RiskPlanId;
  workspaceId: WorkspaceId;
  accountEquity: number;
  currency: string;
  maxRiskPerTrade: number;
  maxDailyLoss: number;
  maxWeeklyLoss: number;
  maxGrossExposure: number;
  createdAt: UtcMillis;
  updatedAt: UtcMillis;
}

export interface TradePlan {
  id: TradePlanId;
  workspaceId: WorkspaceId;
  setupId?: string;
  strategyVersionId?: StrategyVersionId;
  instrument: string;
  direction: TradeDirection;
  entryPrice: number;
  stopPrice: number;
  targetPrice?: number;
  requestedQuantity: number;
  riskPlanId?: RiskPlanId;
  createdAt: UtcMillis;
  /** Future execution routing remains opt-in; new plans are always review-only. */
  executionPermission: "disabled" | "review_only" | "user_confirmed";
}

export type TradePlanDecision = "accepted" | "rejected" | "needs_review";

export interface RiskEvaluation {
  decision: TradePlanDecision;
  reasons: string[];
  approvedQuantity: number;
  perUnitRisk: number;
  estimatedLoss: number;
  estimatedProfit?: number;
  rewardToRisk?: number;
  grossExposure: number;
}

export interface AlertContext {
  setupId?: string;
  strategyVersionId?: StrategyVersionId;
  riskPlanId?: RiskPlanId;
  provenance: DataProvenance;
  values: Record<string, number | string | boolean | null>;
}

export type AlertType =
  | "ORB_BREAKOUT"
  | "VWAP_CROSS"
  | "VWAP_REJECTION"
  | "PRICE_LEVEL_REACHED"
  | "REGIME_CHANGED"
  | "RISK_THRESHOLD"
  | "SETUP_CONFIRMED";

export interface Alert {
  id: AlertId;
  workspaceId: WorkspaceId;
  type: AlertType;
  instrument: string;
  enabled: boolean;
  cooldownMs: number;
  lastTriggeredAt?: UtcMillis;
  context: AlertContext;
  createdAt: UtcMillis;
  updatedAt: UtcMillis;
}

export interface JournalEntry {
  id: JournalEntryId;
  workspaceId: WorkspaceId;
  instrument: string;
  direction?: TradeDirection;
  strategyVersionId?: StrategyVersionId;
  tradePlanId?: TradePlanId;
  entryTime?: UtcMillis;
  exitTime?: UtcMillis;
  entryPrice?: number;
  stopPrice?: number;
  targetPrice?: number;
  exitPrice?: number;
  quantity?: number;
  pnl?: number;
  rMultiple?: number;
  regime?: MarketRegime;
  notes: string;
  createdAt: UtcMillis;
  updatedAt: UtcMillis;
}
