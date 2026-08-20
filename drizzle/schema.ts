import { index, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/** Core user table backing the existing OAuth flow. */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

/** A user-owned research container. No artifact can exist without workspace ownership. */
export const workspaces = mysqlTable("workspaces", {
  id: varchar("id", { length: 36 }).primaryKey(),
  ownerId: int("ownerId").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 160 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("workspaces_owner_idx").on(table.ownerId)]);

/**
 * A source-aware research draft. The JSON payload contains only user-authored
 * hypothesis/condition text and a compact dataset reference; market bars and
 * provider secrets are never persisted in this table.
 */
/**
 * The durable, account-scoped terminal preference snapshot. It intentionally holds
 * only validated interface choices; public-market data, credentials, and strategy
 * source remain outside the cloud workspace boundary.
 */
export const workspacePreferences = mysqlTable("workspacePreferences", {
  workspaceId: varchar("workspaceId", { length: 36 }).primaryKey().references(() => workspaces.id, { onDelete: "cascade" }),
  version: int("version").notNull().default(1),
  revision: int("revision").notNull().default(1),
  preferencesJson: text("preferencesJson").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const researchDrafts = mysqlTable("researchDrafts", {
  id: varchar("id", { length: 36 }).primaryKey(),
  workspaceId: varchar("workspaceId", { length: 36 }).notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 180 }).notNull(),
  hypothesis: text("hypothesis").notNull(),
  condition: text("condition").notNull(),
  datasetJson: text("datasetJson").notNull(),
  revision: int("revision").notNull().default(1),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("research_drafts_workspace_idx").on(table.workspaceId)]);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Workspace = typeof workspaces.$inferSelect;
export type ResearchDraft = typeof researchDrafts.$inferSelect;
export type WorkspacePreference = typeof workspacePreferences.$inferSelect;
