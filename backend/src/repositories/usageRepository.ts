import type { UsageType } from "@prisma/client"
import { getPrisma, isDatabaseEnabled } from "../db/prisma.js"

function currentBillingPeriod(): { start: Date; end: Date } {
  const now = new Date()
  const resetDay = Number(process.env.ORG_BUDGET_RESET_DAY ?? 1)
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), resetDay))
  if (now < start) {
    start.setUTCMonth(start.getUTCMonth() - 1)
  }
  const end = new Date(start)
  end.setUTCMonth(end.getUTCMonth() + 1)
  return { start, end }
}

export async function recordTaskUsage(input: {
  userId: string
  taskId: string
  totalUsd: number
  usageType?: UsageType
  metadata?: Record<string, unknown>
}): Promise<void> {
  if (!isDatabaseEnabled()) return

  const { start, end } = currentBillingPeriod()
  await getPrisma().usageRecord.create({
    data: {
      userId: input.userId,
      taskId: input.taskId,
      usageType: input.usageType ?? "llm_cost",
      quantity: 1,
      unitAmountUsd: input.totalUsd,
      totalUsd: input.totalUsd,
      periodStart: start,
      periodEnd: end,
      metadata: (input.metadata ?? {}) as object,
    },
  })
}

export async function getUserIdForTask(taskId: string): Promise<string | null> {
  if (!isDatabaseEnabled()) return null
  const row = await getPrisma().task.findUnique({
    where: { id: taskId },
    select: { userId: true },
  })
  return row?.userId ?? null
}
