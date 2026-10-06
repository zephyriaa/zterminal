import { z } from "zod";
import { workspaceChartDocuments } from "./chart/workspace-snapshot";

export const workspacePayloadSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(80),
  view: z.enum(["markets", "calendar", "alerts", "chart", "strategy", "backtester", "research", "portfolio", "risk", "journal", "connections", "settings"]),
  symbol: z.string().trim().regex(/^[A-Z0-9]{3,24}$/),
  timeframe: z.enum(["1m", "5m", "15m", "30m", "1h", "4h", "1d"]),
  timezone: z.enum(["America/New_York", "UTC", "Europe/London", "Asia/Dubai", "Asia/Tokyo", "local"]),
  createdAt: z.number().int().positive(),
  chartDocuments: z.array(z.unknown()).max(32).optional(),
});
export type WorkspacePayload = z.infer<typeof workspacePayloadSchema>;

export function parseCloudWorkspace(entry: { id: string; name: string; cloudState?: { payload: string | null } | null }) {
  try {
    if (!entry.cloudState?.payload) return null;
    const input = JSON.parse(entry.cloudState.payload);
    if (!input || ![1, 2].includes(input.version)) return null;
    const parsed = workspacePayloadSchema.safeParse({ ...input, id: entry.id, name: entry.name });
    if (!parsed.success) return null;
    return { ...parsed.data, chartDocuments: workspaceChartDocuments(parsed.data.chartDocuments, entry.id) };
  } catch { return null; }
}
