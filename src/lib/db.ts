import { PrismaClient } from "@prisma/client";

// Standard Next.js dev-mode singleton pattern: without this, hot-reload
// creates a fresh PrismaClient (and a fresh connection pool) on every file
// change, which exhausts Postgres connections quickly against Supabase's
// pooler limits.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
