import { z } from "zod";

export const TERMINAL_TAPE_PROVIDERS = ["gateio", "binance_usdm", "bybit_linear", "coinbase_exchange"] as const;
export const TERMINAL_TIMEFRAMES = ["1m", "3m", "5m", "15m", "30m", "1h", "4h", "D"] as const;
export const TERMINAL_RANGE_PRESETS = ["1D", "5D", "1M", "3M", "6M", "YTD", "1Y", "MAX"] as const;
export const TERMINAL_RESEARCH_LAYERS = ["vwap", "ema", "profile", "sessionProfile", "sessions", "structure", "cvd", "dom", "tape", "largePrints", "footprint", "flowPulse", "gex"] as const;
export const TERMINAL_NATIVE_STUDIES = ["sma", "ema", "wma", "vwap", "rolling_channel", "rsi", "macd", "stochastic", "roc", "atr", "bollinger", "stddev", "volume", "volume_ma", "session_range", "volume_delta", "cumulative_volume_delta"] as const;
export const TERMINAL_FLOATING_PANEL_IDS = ["chart", "market", "indicators", "strategy"] as const;

export type TerminalFloatingPanelId = (typeof TERMINAL_FLOATING_PANEL_IDS)[number];
export type TerminalFloatingPanelGeometry = { x: number; y: number; width: number; height: number; z: number; minimized: boolean };
export type TerminalPanelLayout = Record<TerminalFloatingPanelId, TerminalFloatingPanelGeometry>;

const symbolSchema = z.string().trim().toUpperCase().regex(/^[A-Z0-9]+_USDT$/);
const nativeInputSchema = z.record(z.string().regex(/^[a-z][a-z0-9_]{0,31}$/), z.number().finite().min(0).max(10_000)).refine((value) => Object.keys(value).length <= 8, "A native study supports at most eight bounded inputs.");
const nativeStudyPreferenceSchema = z.object({
  id: z.enum(TERMINAL_NATIVE_STUDIES),
  inputs: nativeInputSchema.optional(),
}).strict();

const floatingPanelGeometrySchema = z.object({
  x: z.number().finite().min(0).max(82),
  y: z.number().finite().min(0).max(84),
  width: z.number().finite().min(18).max(100),
  height: z.number().finite().min(20).max(100),
  z: z.number().int().min(1).max(24),
  minimized: z.boolean().optional().default(false),
}).strict().superRefine((panel, ctx) => {
  if (panel.x + panel.width > 100) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Panel width must remain within the workspace." });
  if (panel.y + panel.height > 100) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Panel height must remain within the workspace." });
});

export const DEFAULT_TERMINAL_PANEL_LAYOUT: TerminalPanelLayout = {
  chart: { x: 4, y: 5, width: 72, height: 84, z: 1, minimized: false },
  market: { x: 77, y: 7, width: 19, height: 62, z: 2, minimized: false },
  indicators: { x: 26, y: 9, width: 34, height: 70, z: 5, minimized: false },
  strategy: { x: 30, y: 12, width: 40, height: 74, z: 6, minimized: false },
};

export function cloneTerminalPanelLayout(layout: TerminalPanelLayout = DEFAULT_TERMINAL_PANEL_LAYOUT): TerminalPanelLayout {
  return Object.fromEntries(TERMINAL_FLOATING_PANEL_IDS.map((id) => [id, { ...layout[id] }])) as TerminalPanelLayout;
}

export const terminalPanelLayoutSchema = z.object({
  chart: floatingPanelGeometrySchema,
  market: floatingPanelGeometrySchema,
  indicators: floatingPanelGeometrySchema,
  strategy: floatingPanelGeometrySchema,
}).strict();

const panelLayoutPreferenceSchema = terminalPanelLayoutSchema.optional().transform((layout) => layout ?? cloneTerminalPanelLayout());

export const terminalWorkspacePreferencesSchema = z.object({
  version: z.literal(1),
  symbol: symbolSchema,
  timeframe: z.enum(TERMINAL_TIMEFRAMES),
  rangePreset: z.enum(TERMINAL_RANGE_PRESETS),
  activeTapeProvider: z.enum(TERMINAL_TAPE_PROVIDERS),
  activeLayers: z.array(z.enum(TERMINAL_RESEARCH_LAYERS)).max(16).transform((layers) => Array.from(new Set(layers))),
  watchlist: z.array(symbolSchema).min(1).max(20).transform((symbols) => Array.from(new Set(symbols))),
  nativeStudies: z.array(nativeStudyPreferenceSchema).max(16).optional().transform((studies) => Array.from(new Map((studies ?? []).map((study) => [study.id, study])).values())),
  indicatorFavorites: z.array(z.enum(TERMINAL_NATIVE_STUDIES)).max(24).optional().transform((favorites) => Array.from(new Set(favorites ?? []))),
  panelLayout: panelLayoutPreferenceSchema,
}).strict();

export type TerminalWorkspacePreferences = z.infer<typeof terminalWorkspacePreferencesSchema>;

export const DEFAULT_TERMINAL_WORKSPACE_PREFERENCES: TerminalWorkspacePreferences = {
  version: 1,
  symbol: "QQQX_USDT",
  timeframe: "15m",
  rangePreset: "1D",
  activeTapeProvider: "gateio",
  activeLayers: ["vwap", "ema", "profile", "structure"],
  watchlist: ["BTC_USDT", "ETH_USDT", "SOL_USDT", "QQQX_USDT"],
  nativeStudies: [{ id: "volume" }],
  indicatorFavorites: [],
  panelLayout: cloneTerminalPanelLayout(),
};

export function parseTerminalWorkspacePreferences(value: unknown): TerminalWorkspacePreferences | null {
  const result = terminalWorkspacePreferencesSchema.safeParse(value);
  return result.success ? result.data : null;
}

export function normalizeTerminalPanelLayout(value: unknown): TerminalPanelLayout {
  const result = terminalPanelLayoutSchema.safeParse(value);
  return result.success ? result.data : cloneTerminalPanelLayout();
}
