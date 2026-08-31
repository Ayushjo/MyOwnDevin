import { PrismaClient } from "@prisma/client"
import logger from "../logger.js"

let prisma: PrismaClient | null = null

export function isDatabaseEnabled(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim())
}

export function getPrisma(): PrismaClient {
  if (!isDatabaseEnabled()) {
    throw new Error("DATABASE_URL is not configured")
  }
  if (!prisma) {
    prisma = new PrismaClient({
      log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    })
  }
  return prisma
}

export async function disconnectPrisma(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect()
    prisma = null
  }
}

export async function verifyDatabaseConnection(): Promise<boolean> {
  if (!isDatabaseEnabled()) {
    logger.warn("DATABASE_URL not set — Postgres persistence disabled")
    return false
  }
  try {
    const db = getPrisma()
    await db.$queryRaw`SELECT 1`
    logger.info("Postgres connected")
    return true
  } catch (error) {
    logger.error(`Postgres connection failed: ${error instanceof Error ? error.message : error}`)
    return false
  }
}
