import type { TaskMetricsSnapshot } from "../events/types.js"
import type { Step } from "../Agents/plannerAgent.js"
import type { TaskRegistryEntry } from "../store/taskRegistry.js"
import { isDatabaseEnabled } from "../db/prisma.js"
import {
  completeStepInDb,
  saveMetricsToDb,
  syncStepsToDb,
  updateTaskInDb,
  upsertStepInDb,
} from "../repositories/taskRepository.js"
import { recordTaskUsage, getUserIdForTask } from "../repositories/usageRepository.js"
import logger from "../logger.js"

export async function persistTaskStatus(
  taskId: string,
  status: TaskRegistryEntry["status"] | "planning" | "verifying",
  extra?: {
    issueTitle?: string
    issueNumber?: number
    prUrl?: string
    failureReason?: string
    branchName?: string
    completedAt?: Date | null
  },
): Promise<void> {
  if (!isDatabaseEnabled()) return
  try {
    await updateTaskInDb(taskId, { status, ...extra })
  } catch (error) {
    logger.error(`Failed to persist task status: ${error instanceof Error ? error.message : error}`, { taskId })
  }
}

export async function persistTaskMetrics(taskId: string, metrics: TaskMetricsSnapshot): Promise<void> {
  if (!isDatabaseEnabled()) return
  try {
    await saveMetricsToDb(taskId, metrics)
  } catch (error) {
    logger.error(`Failed to persist task metrics: ${error instanceof Error ? error.message : error}`, { taskId })
  }
}

export async function persistPlanSteps(taskId: string, steps: Step[]): Promise<void> {
  if (!isDatabaseEnabled()) return
  try {
    await syncStepsToDb(taskId, steps)
  } catch (error) {
    logger.error(`Failed to persist plan steps: ${error instanceof Error ? error.message : error}`, { taskId })
  }
}

export async function persistStepStart(taskId: string, step: Step): Promise<void> {
  if (!isDatabaseEnabled()) return
  try {
    await upsertStepInDb(taskId, step, "running")
  } catch (error) {
    logger.error(`Failed to persist step start: ${error instanceof Error ? error.message : error}`, { taskId })
  }
}

export async function persistStepDone(taskId: string, stepNumber: number, outputSummary?: string): Promise<void> {
  if (!isDatabaseEnabled()) return
  try {
    await completeStepInDb(taskId, stepNumber, outputSummary)
  } catch (error) {
    logger.error(`Failed to persist step done: ${error instanceof Error ? error.message : error}`, { taskId })
  }
}

export async function persistTaskComplete(
  taskId: string,
  metrics: TaskMetricsSnapshot,
  prUrl?: string,
): Promise<void> {
  if (!isDatabaseEnabled()) return
  try {
    const completedAt = new Date()
    await saveMetricsToDb(taskId, metrics)
    await updateTaskInDb(taskId, {
      status: "done",
      ...(prUrl ? { prUrl } : {}),
      completedAt,
    })

    const userId = await getUserIdForTask(taskId)
    if (userId && metrics.costUsd > 0) {
      await recordTaskUsage({
        userId,
        taskId,
        totalUsd: metrics.costUsd,
        metadata: {
          inputTokens: metrics.inputTokens,
          outputTokens: metrics.outputTokens,
          llmCalls: metrics.llmCalls,
        },
      })
    }
  } catch (error) {
    logger.error(`Failed to persist task complete: ${error instanceof Error ? error.message : error}`, { taskId })
  }
}

export async function persistTaskFailed(
  taskId: string,
  metrics: TaskMetricsSnapshot,
  reason: string,
): Promise<void> {
  if (!isDatabaseEnabled()) return
  try {
    const completedAt = new Date()
    await saveMetricsToDb(taskId, metrics)
    await updateTaskInDb(taskId, {
      status: "failed",
      failureReason: reason,
      completedAt,
    })

    const userId = await getUserIdForTask(taskId)
    if (userId && metrics.costUsd > 0) {
      await recordTaskUsage({
        userId,
        taskId,
        totalUsd: metrics.costUsd,
        metadata: { failureReason: reason },
      })
    }
  } catch (error) {
    logger.error(`Failed to persist task failed: ${error instanceof Error ? error.message : error}`, { taskId })
  }
}
