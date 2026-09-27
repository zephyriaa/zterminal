import { PrismaClient } from "@prisma/client";
import { PrismaClient as PrismaClientWasm } from "@prisma/client/wasm.js";
import { PrismaPg } from "@prisma/adapter-pg";
import path from "node:path";

/**
 * Database client with dual-mode support:
 * - Local development: SQLite file at db/custom.db (auto-configured when DATABASE_URL is absent)
 * - Production / Workers: PostgreSQL through the pg driver adapter
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
  const usesPostgres = /^postgres(?:ql)?:\/\//i.test(url);

  if (usesPostgres || isEdge) {
    // A missing edge URL remains fail-closed in auth-runtime. Prisma still needs
    // an adapter to initialize, but this placeholder is never queried.
    const connectionString = usesPostgres
      ? url
      : "postgresql://unconfigured:unconfigured@127.0.0.1:5432/unconfigured";
    // Workers cannot read Prisma's Node WASM file from the virtual filesystem.
    // The explicit WASM entry lets the bundler import it as a Worker module.
    const Client = isEdge ? PrismaClientWasm : PrismaClient;
    return new Client({ adapter: new PrismaPg({ connectionString }) });
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
