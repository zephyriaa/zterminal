import { PrismaClient } from "@prisma/client";
import { withAccelerate } from "@prisma/extension-accelerate";
import path from "node:path";

/**
 * Database client with dual-mode support:
 * - Local development: SQLite file at db/custom.db (auto-configured when DATABASE_URL is absent)
 * - Production / edge: PostgreSQL via direct connection or Prisma Accelerate proxy
 */

const isEdge = typeof globalThis.caches !== "undefined";

if (!process.env.DATABASE_URL && !isEdge) {
  // Local development: fall back to SQLite file
  const dbPath = path.resolve(process.cwd(), "db/custom.db").replace(/\\/g, "/");
  process.env.DATABASE_URL = `file:${dbPath}`;
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createClient() {
  const url = process.env.DATABASE_URL ?? "";
  const usesAccelerate = url.startsWith("prisma://");

  if (usesAccelerate || isEdge) {
    // Prisma Accelerate or edge runtime: use the extension for HTTP-based queries
    return new PrismaClient().$extends(withAccelerate()) as unknown as PrismaClient;
  }

  // Standard Node.js runtime (local dev or self-hosted VPS)
  return new PrismaClient({
    // Query payloads can contain user-authored strategy, journal, and risk data.
    // Keep operational error visibility without emitting query values by default.
    log: ["error", "warn"],
  });
}

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
