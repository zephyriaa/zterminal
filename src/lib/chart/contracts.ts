import type { Exchange, ProviderId, Timeframe } from "@/lib/market/types";

export const CHART_DOCUMENT_SCHEMA_VERSION = 2 as const;
export const DEFAULT_WORKSPACE_ID = "local-default";
export const PRIMARY_CHART_ID = "primary-chart";

export type ChartType = "candles" | "bars" | "line" | "area";
export type ChartScaleMode = "normal" | "logarithmic" | "percentage";

export interface InstrumentKey {
  provider: ProviderId;
  exchange: Exchange;
  product: "perpetual" | "future" | "spot";
  nativeSymbol: string;
}

export interface ChartSettingsV2 {
  futureBars: number;
  gridOpacity: number;
  candleUpColor: string;
  candleDownColor: string;
  candleBorderUpColor: string;
  candleBorderDownColor: string;
  candleWickUpColor: string;
  candleWickDownColor: string;
  backgroundColor: string;
  showGrid: boolean;
  showPriceLine: boolean;
  showCrosshair: boolean;
  showCandleBorders: boolean;
  showCandleWicks: boolean;
  scaleMode: ChartScaleMode;
  invertScale: boolean;
  scaleMarginTop: number;
  scaleMarginBottom: number;
  showStrategyTrades: boolean;
  showMarkPrice: boolean;
}

export interface ChartPane {
  id: string;
  kind: "price" | "volume" | "indicator";
  height: number;
  visible: boolean;
  order: number;
}

export type DrawingType =
  | "trend-line" | "ray" | "extended-line" | "horizontal-line"
  | "horizontal-ray" | "vertical-line" | "rectangle" | "text"
  | "ruler" | "long-position" | "short-position" | "fibonacci-retracement";

export interface DrawingAnchor { time: number; price: number; }
export interface DrawingStyle { color: string; width: number; lineStyle: "solid" | "dashed" | "dotted"; fill?: string; opacity: number; text?: string; textSize?: number; }
export interface DrawingVisibility { timeframes: Timeframe[] | "all"; }
export interface DrawingObject {
  id: string;
  type: DrawingType;
  instrument: InstrumentKey;
  chartId: string;
  anchors: DrawingAnchor[];
  style: DrawingStyle;
  visibility: DrawingVisibility;
  locked: boolean;
  hidden: boolean;
  zOrder: number;
  createdAt: number;
  updatedAt: number;
}

export interface IndicatorOutputStyle {
  id: string;
  label: string;
  plot: "line" | "histogram" | "area" | "marker";
  color: string;
  width: number;
  lineStyle: "solid" | "dashed" | "dotted";
  opacity: number;
  visible: boolean;
}
export interface IndicatorVisibility { timeframes: Timeframe[] | "all"; }
export interface IndicatorInstanceV2 {
  id: string;
  definitionId?: string;
  artifactId?: string;
  name: string;
  inputs: Record<string, number | string | boolean>;
  outputs: IndicatorOutputStyle[];
  paneId: string;
  priceScaleId: string;
  visibility: IndicatorVisibility;
  enabled: boolean;
}

export interface ReplaySession {
  state: "selecting" | "paused" | "playing" | "complete";
  datasetHash: string;
  startTime: number;
  cursorTime: number;
  speed: 0.25 | 0.5 | 1 | 2 | 5 | 10;
}

export interface ChartDocument {
  schemaVersion: typeof CHART_DOCUMENT_SCHEMA_VERSION;
  id: string;
  workspaceId: string;
  chartId: string;
  instrument: InstrumentKey;
  timeframe: Timeframe;
  chartType: ChartType;
  settings: ChartSettingsV2;
  panes: ChartPane[];
  indicators: IndicatorInstanceV2[];
  drawings: DrawingObject[];
  replay?: ReplaySession;
  updatedAt: number;
}

export const DEFAULT_CHART_SETTINGS: ChartSettingsV2 = {
  futureBars: 24,
  gridOpacity: 0.075,
  candleUpColor: "#34d399",
  candleDownColor: "#ef4444",
  candleBorderUpColor: "#34d399",
  candleBorderDownColor: "#ef4444",
  candleWickUpColor: "#34d399",
  candleWickDownColor: "#ef4444",
  backgroundColor: "#0a0a0a",
  showGrid: true,
  showPriceLine: true,
  showCrosshair: true,
  showCandleBorders: false,
  showCandleWicks: true,
  scaleMode: "normal",
  invertScale: false,
  scaleMarginTop: 0.08,
  scaleMarginBottom: 0.18,
  showStrategyTrades: true,
  showMarkPrice: true,
};

export const DEFAULT_CHART_PANES: ChartPane[] = [
  { id: "price", kind: "price", height: 0.78, visible: true, order: 0 },
  { id: "volume", kind: "volume", height: 0.22, visible: true, order: 1 },
];

function finite(value: unknown, fallback: number, min: number, max: number) {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}
function color(value: unknown, fallback: string) {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}

export function chartDocumentKey(workspaceId: string, chartId: string, instrument: InstrumentKey) {
  return [workspaceId, chartId, instrument.provider, instrument.exchange, instrument.product, instrument.nativeSymbol].map(encodeURIComponent).join("::");
}

export function createChartDocument(input: { workspaceId?: string; chartId?: string; instrument: InstrumentKey; timeframe: Timeframe; settings?: Partial<ChartSettingsV2>; now?: number }): ChartDocument {
  const workspaceId = input.workspaceId ?? DEFAULT_WORKSPACE_ID;
  const chartId = input.chartId ?? PRIMARY_CHART_ID;
  return {
    schemaVersion: CHART_DOCUMENT_SCHEMA_VERSION,
    id: chartDocumentKey(workspaceId, chartId, input.instrument),
    workspaceId,
    chartId,
    instrument: input.instrument,
    timeframe: input.timeframe,
    chartType: "candles",
    settings: sanitizeChartSettings(input.settings),
    panes: DEFAULT_CHART_PANES.map(pane => ({ ...pane })),
    indicators: [],
    drawings: [],
    updatedAt: input.now ?? Date.now(),
  };
}

export function sanitizeChartSettings(value: unknown): ChartSettingsV2 {
  const input = value && typeof value === "object" ? value as Partial<ChartSettingsV2> : {};
  const up = color(input.candleUpColor, DEFAULT_CHART_SETTINGS.candleUpColor);
  const down = color(input.candleDownColor, DEFAULT_CHART_SETTINGS.candleDownColor);
  return {
    ...DEFAULT_CHART_SETTINGS,
    ...input,
    futureBars: Math.round(finite(input.futureBars, 24, 0, 80)),
    gridOpacity: finite(input.gridOpacity, 0.075, 0, 0.3),
    candleUpColor: up,
    candleDownColor: down,
    candleBorderUpColor: color(input.candleBorderUpColor, up),
    candleBorderDownColor: color(input.candleBorderDownColor, down),
    candleWickUpColor: color(input.candleWickUpColor, up),
    candleWickDownColor: color(input.candleWickDownColor, down),
    backgroundColor: color(input.backgroundColor, DEFAULT_CHART_SETTINGS.backgroundColor),
    scaleMode: ["normal", "logarithmic", "percentage"].includes(String(input.scaleMode)) ? input.scaleMode as ChartScaleMode : "normal",
    scaleMarginTop: finite(input.scaleMarginTop, 0.08, 0, 0.4),
    scaleMarginBottom: finite(input.scaleMarginBottom, 0.18, 0, 0.4),
    showGrid: input.showGrid !== false,
    showPriceLine: input.showPriceLine !== false,
    showCrosshair: input.showCrosshair !== false,
    showCandleBorders: input.showCandleBorders === true,
    showCandleWicks: input.showCandleWicks !== false,
    invertScale: input.invertScale === true,
    showStrategyTrades: input.showStrategyTrades !== false,
    showMarkPrice: input.showMarkPrice !== false,
  };
}

export function migrateChartDocument(value: unknown, fallback: ChartDocument): ChartDocument {
  if (!value || typeof value !== "object") return fallback;
  const input = value as Partial<ChartDocument>;
  if (input.id !== fallback.id) return fallback;
  const chartType = ["candles", "bars", "line", "area"].includes(String(input.chartType)) ? input.chartType as ChartType : "candles";
  const volume = Array.isArray(input.panes) ? input.panes.find(pane => pane?.id === "volume") : undefined;
  return {
    ...fallback,
    chartType,
    settings: sanitizeChartSettings(input.settings),
    panes: [
      { ...DEFAULT_CHART_PANES[0] },
      { ...DEFAULT_CHART_PANES[1], visible: volume?.visible !== false, height: finite(volume?.height, 0.22, 0.12, 0.45) },
    ],
    indicators: Array.isArray(input.indicators) ? input.indicators : [],
    drawings: Array.isArray(input.drawings) ? input.drawings.filter(drawing => drawing?.chartId === fallback.chartId && drawing?.instrument?.nativeSymbol === fallback.instrument.nativeSymbol) : [],
    replay: input.replay,
    updatedAt: finite(input.updatedAt, fallback.updatedAt, 0, Number.MAX_SAFE_INTEGER),
  };
}
