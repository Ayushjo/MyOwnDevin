import { z } from "zod"
import { Redis } from "ioredis"
import type { Step } from "../Agents/plannerAgent.js"
import type { TaskContext } from "../context/taskContext.js"
import type { TaskMetricsSnapshot } from "../events/types.js"
import { createRedisClient } from "../config/redis.js"

export type CheckpointState = {
  steps: Step[]
  completedStepIds: number[]
  taskPath: string
  issueUrl: string
  issueTitle: string
  issueNumber: number
  defaultBranch: string
  context: TaskContext
  metrics?: TaskMetricsSnapshot
}

export class CheckpointStore {
  private redis: Redis
  private TTL = 60 * 60 * 24 // 24 hours

  constructor() {
    this.redis = createRedisClient()
  }

  async save(taskId: string, state: CheckpointState): Promise<void> {
    await this.redis.set(
      `checkpoint:${taskId}`,
      JSON.stringify(state),
      "EX",
      this.TTL
    )
  }

  async load(taskId: string): Promise<CheckpointState | null> {
    const data = await this.redis.get(`checkpoint:${taskId}`)
    return data ? JSON.parse(data) as CheckpointState : null
  }

  async delete(taskId: string): Promise<void> {
    await this.redis.del(`checkpoint:${taskId}`)
  }
}

export const StepSchema = z.object({
  id: z.number(),
  // Short human-readable label for the sidebar (planner may omit → derived from description).
  title: z.string().min(1).optional(),
  description: z.string().min(1),
})

export const PlanSchema = z.array(StepSchema).min(1)
