import { z } from "zod";
import type { ScriptRecord } from "../local-research/contracts";

export const STARTERS = {
  chart: { name: "Chart", description: "One chart. Add tools as you need them." },
  orderflow: { name: "Order Flow", description: "Chart and live order-book context." },
  research: { name: "Python Research", description: "Chart and Python editor. Reports open after a run." },
} as const;
export type WorkspaceStarter = keyof typeof STARTERS;
export const timeframeSchema = z.enum(["1m", "5m", "15m", "30m", "1h", "4h", "1d"]);
export const workspaceBaseSchema = z.object({
  id: z.string().uuid(), name: z.string().trim().min(1).max(80),
  view: z.enum(["markets", "calendar", "alerts", "chart", "strategy", "backtester", "research", "portfolio", "risk", "journal", "connections", "settings"]),
  symbol: z.string().trim().regex(/^[A-Z0-9_]{3,40}$/), timeframe: timeframeSchema,
  timezone: z.enum(["America/New_York", "UTC", "Europe/London", "Asia/Dubai", "Asia/Tokyo", "local"]),
  createdAt: z.number().int().positive(), chartDocuments: z.array(z.unknown()).max(32).optional(),
});
export const workspaceSnapshotSchema = workspaceBaseSchema.extend({
  version: z.literal(3), revision: z.number().int().nonnegative(),
  starter: z.enum(["chart", "orderflow", "research"]),
  marketProvider: z.enum(["gateio", "binance", "bybit", "okx", "coinbase", "mock"]).nullable(),
  sidebarCollapsed: z.boolean(), layoutLocked: z.boolean().default(false), dockLayout: z.record(z.string(), z.unknown()).nullable(),
  multiChart: z.object({
    layout: z.enum(["1", "2h", "2v", "3", "4"]), activePaneIndex: z.number().int().min(0).max(3),
    syncCrosshairs: z.boolean(), syncSymbol: z.boolean(),
    panes: z.array(z.object({ id: z.string().max(100), symbol: z.string().regex(/^[A-Z0-9_]{3,40}$/), timeframe: timeframeSchema, chartType: z.enum(["candles", "bars", "line", "area"]) })).min(1).max(4),
  }),
  studies: z.array(z.unknown()).max(50),
  research: z.object({ activeId: z.string().max(100), config: z.record(z.string(), z.unknown()), params: z.record(z.string().max(80), z.union([z.number().finite(), z.string().max(16000), z.boolean()])), minimap: z.boolean() }).nullable(),
}).refine(value => JSON.stringify(value).length <= 8_000_000, "Workspace exceeds the 8 MB snapshot limit");
export type WorkspaceSnapshot = z.infer<typeof workspaceSnapshotSchema>;
export interface WorkspaceRecord {
  importedDrafts?: Record<string, ScriptRecord>;
  snapshot: WorkspaceSnapshot; updatedAt: number; lastOpenedAt: number;
  /** Null is device-local; non-null is an explicitly bound cloud owner. */
  ownerId: string | null; cloudRevision: number | null; dirty: boolean;
}
export type WorkspaceSummary = Pick<WorkspaceSnapshot, "id" | "name" | "starter" | "symbol" | "timeframe" | "marketProvider"> & Pick<WorkspaceRecord, "updatedAt" | "lastOpenedAt" | "ownerId" | "dirty">;
export function summarize(record: WorkspaceRecord): WorkspaceSummary {
  const { id, name, starter, symbol, timeframe, marketProvider } = record.snapshot;
  return { id, name, starter, symbol, timeframe, marketProvider, updatedAt: record.updatedAt, lastOpenedAt: record.lastOpenedAt, ownerId: record.ownerId, dirty: record.dirty };
}
export function newWorkspace(name: string, starter: WorkspaceStarter, provider: "gateio" | "binance" = "gateio", symbol = "BTCUSDT", timeframe: WorkspaceSnapshot["timeframe"] = "5m"): WorkspaceSnapshot {
  return workspaceSnapshotSchema.parse({
    version: 3, revision: 0, id: crypto.randomUUID(), name, starter, marketProvider: provider,
    symbol, timeframe, timezone: "UTC", createdAt: Date.now(), view: starter === "research" ? "strategy" : "chart",
    sidebarCollapsed: true, chartDocuments: [], dockLayout: null, studies: [], research: null,
    multiChart: { layout: "1", activePaneIndex: 0, syncCrosshairs: true, syncSymbol: false, panes: Array.from({ length: 4 }, (_, i) => ({ id: `pane-${i}`, symbol, timeframe, chartType: "candles" })) },
  });
}
export function copyWorkspace(source: WorkspaceSnapshot, name = `${source.name.slice(0, 75)} copy`): WorkspaceSnapshot {
  const id = crypto.randomUUID();
  // Chart IDs include workspace identity; the normal chart-document migrator rekeys them on restore.
  return workspaceSnapshotSchema.parse({ ...structuredClone(source), id, name, revision: 0, createdAt: Date.now() });
}
export function legacyWorkspace(value: unknown, provider: WorkspaceSnapshot["marketProvider"] = null): WorkspaceSnapshot | null {
  const parsed = workspaceBaseSchema.safeParse(value);
  if (!parsed.success) return null;
  const source = value as Record<string, unknown>;
  const documents = parsed.data.chartDocuments ?? [];
  const chartProvider = (documents[0] as { instrument?: { provider?: unknown } } | undefined)?.instrument?.provider;
  const supported = ["gateio", "binance", "bybit", "okx", "coinbase", "mock"];
  const marketProvider = supported.includes(String(chartProvider)) ? chartProvider : supported.includes(String(source.marketProvider)) ? source.marketProvider : supported.includes(String(provider)) ? provider : null;
  return workspaceSnapshotSchema.parse({ ...newWorkspace(parsed.data.name, "chart"), ...parsed.data, marketProvider });
}
