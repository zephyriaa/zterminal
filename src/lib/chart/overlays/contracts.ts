export const CHART_OVERLAY_SCHEMA_VERSION = 1 as const;

/**
 * Persisted chart configuration only. Live overlay payloads intentionally do
 * not belong in a chart document: they are bounded runtime state.
 */
export type ChartOverlayKind = "big-trades" | "price-line" | "marker" | "bubble" | "range" | "heatmap" | "footprint" | "profile";

export type BigTradesOverlaySettings = {
  minimumNotional: number;
  minimumQuantity: number;
  relativeVolumeThreshold: number | null;
  aggregationWindowMs: number;
  bubbleScale: "notional" | "quantity";
  opacity: number;
  maxVisible: number;
  buyColor: string;
  sellColor: string;
};

export type ChartOverlaySettings = BigTradesOverlaySettings | Record<string, never>;

/** A renderer capability, not a persisted user selection. */
export interface OverlayDefinition {
  type: ChartOverlayKind;
  label: string;
  category: "order-flow" | "liquidity" | "options" | "drawing";
  requires: readonly string[];
}

export interface ChartOverlayInstance {
  schemaVersion: typeof CHART_OVERLAY_SCHEMA_VERSION;
  id: string;
  type: ChartOverlayKind;
  visible: boolean;
  zIndex: number;
  settings: ChartOverlaySettings;
}

/** Ephemeral runtime data. This deliberately has no place in a ChartDocument. */
export interface OverlayFrame<TPayload = unknown> {
  overlayId: string;
  provider: string;
  sourceTimestamp: number;
  receivedAt: number;
  integrityEpoch?: string;
  calculationVersion: string;
  payload: TPayload;
}

export const BIG_TRADES_OVERLAY_ID = "order-flow.big-trades";

export const OVERLAY_REGISTRY: readonly OverlayDefinition[] = [
  { type: "big-trades", label: "Big Trades", category: "order-flow", requires: ["trades"] },
];

export const DEFAULT_BIG_TRADES_SETTINGS: BigTradesOverlaySettings = {
  minimumNotional: 500_000,
  minimumQuantity: 0,
  relativeVolumeThreshold: null,
  aggregationWindowMs: 250,
  bubbleScale: "notional",
  opacity: 0.55,
  maxVisible: 500,
  buyColor: "#38bdf8",
  sellColor: "#fb7185",
};

export function createBigTradesOverlay(): ChartOverlayInstance {
  return {
    schemaVersion: CHART_OVERLAY_SCHEMA_VERSION,
    id: BIG_TRADES_OVERLAY_ID,
    type: "big-trades",
    visible: true,
    zIndex: 30,
    settings: { ...DEFAULT_BIG_TRADES_SETTINGS },
  };
}

function finite(value: unknown, fallback: number, min: number, max: number) {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

function color(value: unknown, fallback: string) {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}

export function sanitizeBigTradesSettings(value: unknown): BigTradesOverlaySettings {
  const input = value && typeof value === "object" ? value as Partial<BigTradesOverlaySettings> : {};
  const relative = input.relativeVolumeThreshold;
  return {
    minimumNotional: finite(input.minimumNotional, DEFAULT_BIG_TRADES_SETTINGS.minimumNotional, 0, 1_000_000_000_000),
    minimumQuantity: finite(input.minimumQuantity, DEFAULT_BIG_TRADES_SETTINGS.minimumQuantity, 0, 1_000_000_000_000),
    relativeVolumeThreshold: typeof relative === "number" && Number.isFinite(relative) ? finite(relative, 1, 1, 1000) : null,
    aggregationWindowMs: Math.round(finite(input.aggregationWindowMs, DEFAULT_BIG_TRADES_SETTINGS.aggregationWindowMs, 50, 60_000)),
    bubbleScale: input.bubbleScale === "quantity" ? "quantity" : "notional",
    opacity: finite(input.opacity, DEFAULT_BIG_TRADES_SETTINGS.opacity, 0.05, 1),
    maxVisible: Math.round(finite(input.maxVisible, DEFAULT_BIG_TRADES_SETTINGS.maxVisible, 10, 500)),
    buyColor: color(input.buyColor, DEFAULT_BIG_TRADES_SETTINGS.buyColor),
    sellColor: color(input.sellColor, DEFAULT_BIG_TRADES_SETTINGS.sellColor),
  };
}

export function sanitizeChartOverlay(value: unknown): ChartOverlayInstance | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Partial<ChartOverlayInstance>;
  if (typeof input.id !== "string" || !input.id || !["big-trades", "price-line", "marker", "bubble", "range", "heatmap", "footprint", "profile"].includes(String(input.type))) return null;
  return {
    schemaVersion: CHART_OVERLAY_SCHEMA_VERSION,
    id: input.id.slice(0, 120),
    type: input.type as ChartOverlayKind,
    visible: input.visible !== false,
    zIndex: Math.round(finite(input.zIndex, 0, -10_000, 10_000)),
    settings: input.type === "big-trades" ? sanitizeBigTradesSettings(input.settings) : {},
  };
}

export function bigTradesSettings(overlays: readonly ChartOverlayInstance[]) {
  const overlay = overlays.find(item => item.id === BIG_TRADES_OVERLAY_ID && item.type === "big-trades");
  if (!overlay || !overlay.visible) return null;
  return sanitizeBigTradesSettings(overlay.settings);
}
