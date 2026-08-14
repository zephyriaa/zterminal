import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Query payloads can contain user-authored strategy, journal, and risk data.
    // Keep operational error visibility without emitting query values by default.
    log: ["error", "warn"],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db