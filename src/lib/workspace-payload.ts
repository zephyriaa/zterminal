import { z } from "zod";
import { workspaceChartDocuments } from "./chart/workspace-snapshot";
import { workspaceBaseSchema, workspaceSnapshotSchema } from "./workspaces/model";

export const workspacePayloadSchema = z.union([workspaceSnapshotSchema, workspaceBaseSchema.extend({ version: z.union([z.literal(1), z.literal(2)]).optional() })]);
export type WorkspacePayload = z.infer<typeof workspacePayloadSchema>;

export function parseCloudWorkspace(entry: { id: string; name: string; cloudState?: { payload: string | null } | null }) {
  try {
    if (!entry.cloudState?.payload) return null;
    const input = JSON.parse(entry.cloudState.payload);
    if (!input || ![1, 2, 3].includes(input.version)) return null;
    const parsed = workspacePayloadSchema.safeParse({ ...input, id: entry.id, name: entry.name });
    if (!parsed.success) return null;
    return { ...parsed.data, chartDocuments: workspaceChartDocuments(parsed.data.chartDocuments, entry.id) };
  } catch { return null; }
}
