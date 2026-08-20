import { desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { randomUUID } from "node:crypto";
import { type InsertUser, type Workspace, type WorkspacePreference, users, workspacePreferences, workspaces } from "../drizzle/schema";
import { DEFAULT_TERMINAL_WORKSPACE_PREFERENCES, parseTerminalWorkspacePreferences, type TerminalWorkspacePreferences } from "../shared/workspace/terminalPreferences";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

async function getOrCreateDefaultWorkspace(ownerId: number): Promise<Workspace | null> {
  const db = await getDb();
  if (!db) return null;

  const existing = await db.select().from(workspaces).where(eq(workspaces.ownerId, ownerId)).orderBy(desc(workspaces.updatedAt)).limit(1);
  if (existing[0]) return existing[0];

  const id = randomUUID();
  await db.insert(workspaces).values({ id, ownerId, name: "Terminal workspace" });
  const created = await db.select().from(workspaces).where(eq(workspaces.id, id)).limit(1);
  return created[0] ?? null;
}

export type StoredTerminalWorkspace = {
  workspace: Workspace;
  preferences: TerminalWorkspacePreferences | null;
  revision: number | null;
  updatedAt: Date | null;
};

function storedPreferences(row: WorkspacePreference | undefined): Pick<StoredTerminalWorkspace, "preferences" | "revision" | "updatedAt"> {
  if (!row) return { preferences: null, revision: null, updatedAt: null };
  const preferences = parseTerminalWorkspacePreferences(JSON.parse(row.preferencesJson) as unknown);
  if (!preferences) {
    console.warn("[Workspace] Ignoring invalid stored terminal preferences", { workspaceId: row.workspaceId });
    return { preferences: null, revision: null, updatedAt: row.updatedAt };
  }
  return { preferences, revision: row.revision, updatedAt: row.updatedAt };
}

export async function getTerminalWorkspace(ownerId: number): Promise<StoredTerminalWorkspace | null> {
  const db = await getDb();
  if (!db) return null;

  const workspace = await getOrCreateDefaultWorkspace(ownerId);
  if (!workspace) return null;
  const preferenceRows = await db.select().from(workspacePreferences).where(eq(workspacePreferences.workspaceId, workspace.id)).limit(1);
  return { workspace, ...storedPreferences(preferenceRows[0]) };
}

export class WorkspaceRevisionConflictError extends Error {
  constructor() {
    super("Cloud workspace changed on another device.");
    this.name = "WorkspaceRevisionConflictError";
  }
}

export async function saveTerminalWorkspace(ownerId: number, candidate: TerminalWorkspacePreferences, expectedRevision?: number | null): Promise<StoredTerminalWorkspace | null> {
  const preferences = parseTerminalWorkspacePreferences(candidate);
  if (!preferences) throw new Error("Terminal workspace preferences are invalid");

  const db = await getDb();
  if (!db) return null;
  const workspace = await getOrCreateDefaultWorkspace(ownerId);
  if (!workspace) return null;

  const rows = await db.select().from(workspacePreferences).where(eq(workspacePreferences.workspaceId, workspace.id)).limit(1);
  const current = rows[0];
  if (current && expectedRevision !== undefined && expectedRevision !== null && current.revision !== expectedRevision) {
    throw new WorkspaceRevisionConflictError();
  }

  const revision = (current?.revision ?? 0) + 1;
  const preferencesJson = JSON.stringify(preferences);
  if (current) {
    await db.insert(workspacePreferences).values({
      workspaceId: workspace.id,
      version: 1,
      revision,
      preferencesJson,
    }).onDuplicateKeyUpdate({
      set: { version: 1, revision, preferencesJson, updatedAt: new Date() },
    });
  } else {
    await db.insert(workspacePreferences).values({ workspaceId: workspace.id, version: 1, revision, preferencesJson });
  }

  const stored = await db.select().from(workspacePreferences).where(eq(workspacePreferences.workspaceId, workspace.id)).limit(1);
  return { workspace, ...storedPreferences(stored[0]) };
}

export function defaultTerminalWorkspacePreferences(): TerminalWorkspacePreferences {
  return { ...DEFAULT_TERMINAL_WORKSPACE_PREFERENCES, activeLayers: [...DEFAULT_TERMINAL_WORKSPACE_PREFERENCES.activeLayers], watchlist: [...DEFAULT_TERMINAL_WORKSPACE_PREFERENCES.watchlist] };
}
