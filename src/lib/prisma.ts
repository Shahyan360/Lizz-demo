import { PrismaClient } from "@prisma/client";

/**
 * Single shared PrismaClient instance.
 *
 * Instantiating `new PrismaClient()` per-module exhausts the database connection
 * pool under Next.js hot-reload. The instance is cached on `globalThis` in
 * non-production so module reloads reuse one client.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
