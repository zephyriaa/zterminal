import type { Exchange, ProviderId, Timeframe } from "@/lib/market/types";

export const CHART_DOCUMENT_SCHEMA_VERSION = 3 as const;
export const DRAWING_SCHEMA_VERSION = 1 as const;
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
  | "horizontal-ray" | "vertical-line" | "rectangle" | "arrow" | "text"
  | "price-label" | "ruler" | "price-range" | "date-range"
  | "long-position" | "short-position" | "fibonacci-retracement";

export interface DrawingAnchor { time: number; price: number; }
export interface DrawingStyle { color: string; width: number; lineStyle: "solid" | "dashed" | "dotted"; fill?: string; opacity: number; text?: string; textSize?: number; extendStart?: boolean; extendEnd?: boolean; }
export interface DrawingVisibility { timeframes: Timeframe[] | "all"; }
export interface DrawingObject {
  schemaVersion: typeof DRAWING_SCHEMA_VERSION;
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

export const DRAWING_TYPES: readonly DrawingType[] = [
  "trend-line", "ray", "extended-line", "horizontal-line", "horizontal-ray", "vertical-line",
  "rectangle", "arrow", "text", "price-label", "ruler", "price-range", "date-range",
  "long-position", "short-position", "fibonacci-retracement",
];

const TIMEFRAMES: readonly Timeframe[] = ["1m", "5m", "15m", "30m", "1h", "4h", "1d"];

export function sameInstrument(left: InstrumentKey, right: InstrumentKey) {
  return left.provider === right.provider && left.exchange === right.exchange && left.product === right.product && left.nativeSymbol === right.nativeSymbol;
}

export function drawingAnchorCount(type: DrawingType) {
  return ["horizontal-line", "vertical-line", "text", "price-label"].includes(type) ? 1 : 2;
}

export function defaultDrawingStyle(type: DrawingType): DrawingStyle {
  const filled = ["rectangle", "long-position", "short-position"].includes(type);
  return { color: type === "short-position" ? "#fb7185" : "#7dd3fc", width: 1, lineStyle: "solid", opacity: 0.9, ...(filled ? { fill: type === "short-position" ? "#fb7185" : "#34d399" } : {}), ...(["text", "price-label"].includes(type) ? { text: type === "text" ? "Text" : "", textSize: 12 } : {}) };
}

export function sanitizeDrawing(value: unknown, fallback: { instrument: InstrumentKey; chartId: string }): DrawingObject | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Partial<DrawingObject>;
  if (typeof input.id !== "string" || !input.id || input.id.length > 100 || !DRAWING_TYPES.includes(input.type as DrawingType) || input.chartId !== fallback.chartId || !input.instrument || !sameInstrument(input.instrument, fallback.instrument)) return null;
  const type = input.type as DrawingType;
  if (!Array.isArray(input.anchors) || input.anchors.length !== drawingAnchorCount(type)) return null;
  const anchors = input.anchors.map(anchor => ({ time: finite(anchor?.time, NaN, 0, Number.MAX_SAFE_INTEGER), price: finite(anchor?.price, NaN, -Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER) }));
  if (anchors.some(anchor => !Number.isFinite(anchor.time) || !Number.isFinite(anchor.price))) return null;
  const sourceStyle: Partial<DrawingStyle> = input.style && typeof input.style === "object" ? input.style : {};
  const defaults = defaultDrawingStyle(type);
  const visibility = input.visibility?.timeframes === "all" ? { timeframes: "all" as const } : { timeframes: Array.isArray(input.visibility?.timeframes) ? input.visibility!.timeframes.filter(timeframe => TIMEFRAMES.includes(timeframe)).slice(0, TIMEFRAMES.length) : "all" as const };
  const style: DrawingStyle = {
    ...defaults,
    color: color(sourceStyle.color, defaults.color),
    width: finite(sourceStyle.width, defaults.width, 1, 4),
    lineStyle: ["solid", "dashed", "dotted"].includes(String(sourceStyle.lineStyle)) ? sourceStyle.lineStyle as DrawingStyle["lineStyle"] : defaults.lineStyle,
    opacity: finite(sourceStyle.opacity, defaults.opacity, 0.05, 1),
    ...(sourceStyle.fill ? { fill: color(sourceStyle.fill, defaults.fill ?? defaults.color) } : defaults.fill ? { fill: defaults.fill } : {}),
    ...(typeof sourceStyle.text === "string" ? { text: sourceStyle.text.slice(0, 500) } : defaults.text ? { text: defaults.text } : {}),
    ...(["text", "price-label"].includes(type) ? { textSize: Math.round(finite(sourceStyle.textSize, defaults.textSize ?? 12, 9, 32)) } : {}),
    extendStart: sourceStyle.extendStart === true,
    extendEnd: sourceStyle.extendEnd === true,
  };
  return {
    schemaVersion: DRAWING_SCHEMA_VERSION,
    id: input.id,
    type,
    instrument: fallback.instrument,
    chartId: fallback.chartId,
    anchors,
    style,
    visibility,
    locked: input.locked === true,
    hidden: input.hidden === true,
    zOrder: Math.round(finite(input.zOrder, 0, -10_000, 10_000)),
    createdAt: finite(input.createdAt, Date.now(), 0, Number.MAX_SAFE_INTEGER),
    updatedAt: finite(input.updatedAt, Date.now(), 0, Number.MAX_SAFE_INTEGER),
  };
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
    drawings: Array.isArray(input.drawings) ? input.drawings.map(drawing => sanitizeDrawing(drawing, fallback)).filter((drawing): drawing is DrawingObject => drawing !== null) : [],
    replay: input.replay,
    updatedAt: finite(input.updatedAt, fallback.updatedAt, 0, Number.MAX_SAFE_INTEGER),
  };
}
