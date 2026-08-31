import type { PlanTier } from "@prisma/client"
import { getPrisma, isDatabaseEnabled } from "../db/prisma.js"
import logger from "../logger.js"

export type UpsertUserInput = {
  githubId: bigint
  login: string
  name?: string
  avatarUrl?: string
  email?: string
}

export async function upsertUserByGithubId(input: UpsertUserInput): Promise<string | null> {
  if (!isDatabaseEnabled()) return null

  const db = getPrisma()
  const now = new Date()

  const user = await db.user.upsert({
    where: { githubId: input.githubId },
    create: {
      githubId: input.githubId,
      login: input.login,
      name: input.name ?? null,
      avatarUrl: input.avatarUrl ?? null,
      email: input.email ?? null,
      lastLoginAt: now,
    },
    update: {
      login: input.login,
      name: input.name ?? null,
      avatarUrl: input.avatarUrl ?? null,
      email: input.email ?? null,
      lastLoginAt: now,
    },
  })

  await ensureFreeSubscription(user.id)
  return user.id
}

async function ensureFreeSubscription(userId: string): Promise<void> {
  const db = getPrisma()
  const existing = await db.subscription.findUnique({ where: { userId } })
  if (existing) return

  const freePlan = await db.plan.findUnique({ where: { tier: "free" satisfies PlanTier } })
  if (!freePlan) {
    logger.warn("Free plan not seeded — skipping subscription creation")
    return
  }

  await db.subscription.create({
    data: {
      userId,
      planId: freePlan.id,
      status: "active",
    },
  })
}

export async function getUserById(userId: string) {
  if (!isDatabaseEnabled()) return null
  return getPrisma().user.findUnique({ where: { id: userId } })
}
