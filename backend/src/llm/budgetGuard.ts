import { Redis } from "ioredis"
import type { AgentRole, ProviderName } from "./types.js"
import { createRedisClient } from "../config/redis.js"
import { loadLLMConfig } from "./config.js"
import { DOWNGRADE_LADDER } from "./models.js"
import { estimateCallCost } from "./pricing.js"
import { BudgetExceededError } from "./errors.js"
import logger from "../logger.js"

export type BudgetSnapshot = {
  taskSpentUsd: number
  taskLimitUsd: number
  taskRemainingUsd: number
  openaiSpentUsd: number
  openaiLimitUsd: number
  orgSpentUsd: number
  orgLimitUsd: number
  orgRemainingUsd: number
  llmCalls: number
  openaiCalls: number
  downgraded: boolean
}

const PAID_PROVIDERS = new Set<ProviderName>(["openai", "anthropic"])

function orgMonthKey(): string {
  const resetDay = Number(process.env.ORG_BUDGET_RESET_DAY ?? 1)
  const now = new Date()
  let year = now.getUTCFullYear()
  let month = now.getUTCMonth() + 1
  if (now.getUTCDate() < resetDay) {
    month -= 1
    if (month < 1) {
      month = 12
      year -= 1
    }
  }
  return `budget:org:${year}-${String(month).padStart(2, "0")}`
}

export class BudgetGuard {
  private redis: Redis | null = null
  private memory = new Map<string, number>()
  private taskSpentLocal = new Map<string, number>()
  private openaiSpentLocal = new Map<string, number>()
  private llmCallsLocal = new Map<string, number>()
  private openaiCallsLocal = new Map<string, number>()
  private downgradedTasks = new Set<string>()

  constructor(redis?: Redis) {
    if (redis) {
      this.redis = redis
    } else if (process.env.REDIS_URL) {
      try {
        this.redis = createRedisClient()
      } catch {
        this.redis = null
      }
    }
  }

  get taskBudgetUsd(): number {
    return Number(process.env.TASK_BUDGET_USD ?? 0.10)
  }

  get openaiTaskBudgetUsd(): number {
    return Number(process.env.OPENAI_TASK_BUDGET_USD ?? 0.08)
  }

  get orgBudgetUsd(): number {
    return Number(process.env.ORG_BUDGET_USD ?? 5.0)
  }

  get orgHardStopUsd(): number {
    return Number(process.env.ORG_HARD_STOP_USD ?? 4.75)
  }

  get maxSingleCallUsd(): number {
    return Number(process.env.MAX_SINGLE_CALL_USD ?? 0.02)
  }

  get downgradeThresholdPct(): number {
    return Number(process.env.BUDGET_DOWNGRADE_PCT ?? 0.5)
  }

  get maxLlmCallsPerTask(): number {
    return Number(process.env.MAX_LLM_CALLS_PER_TASK ?? 35)
  }

  get maxOpenaiCallsPerTask(): number {
    // Resets each orchestrator step — executor tool loops need many calls per step.
    return Number(process.env.MAX_OPENAI_CALLS_PER_TASK ?? 40)
  }

  isPaidProvider(provider: ProviderName): boolean {
    return PAID_PROVIDERS.has(provider)
  }

  private async getSpend(key: string): Promise<number> {
    if (this.redis) {
      const val = await this.redis.get(key)
      return val ? parseFloat(val) : 0
    }
    return this.memory.get(key) ?? 0
  }

  private async getCount(key: string): Promise<number> {
    if (this.redis) {
      const val = await this.redis.get(key)
      return val ? parseInt(val, 10) : 0
    }
    return this.memory.get(key) ?? 0
  }

  private async addSpend(key: string, amount: number): Promise<number> {
    if (amount <= 0) return this.getSpend(key)
    if (this.redis) {
      const next = await this.redis.incrbyfloat(key, amount)
      await this.redis.expire(key, 60 * 60 * 24 * 45)
      return parseFloat(next)
    }
    const prev = this.memory.get(key) ?? 0
    const next = prev + amount
    this.memory.set(key, next)
    return next
  }

  private async incrCount(key: string): Promise<number> {
    if (this.redis) {
      const next = await this.redis.incr(key)
      await this.redis.expire(key, 60 * 60 * 24 * 45)
      return next
    }
    const next = (this.memory.get(key) ?? 0) + 1
    this.memory.set(key, next)
    return next
  }

  async getTaskSpent(taskId: string): Promise<number> {
    if (this.redis) return this.getSpend(`budget:task:${taskId}`)
    return this.taskSpentLocal.get(taskId) ?? 0
  }

  async getOpenaiSpent(taskId: string): Promise<number> {
    if (this.redis) return this.getSpend(`budget:task:${taskId}:openai`)
    return this.openaiSpentLocal.get(taskId) ?? 0
  }

  async getOrgSpent(): Promise<number> {
    return this.getSpend(orgMonthKey())
  }

  async getLlmCallCount(taskId: string): Promise<number> {
    if (this.redis) return this.getCount(`budget:task:${taskId}:calls`)
    return this.llmCallsLocal.get(taskId) ?? 0
  }

  async getOpenaiCallCount(taskId: string): Promise<number> {
    if (this.redis) return this.getCount(`budget:task:${taskId}:openai_calls`)
    return this.openaiCallsLocal.get(taskId) ?? 0
  }

  async snapshot(taskId?: string): Promise<BudgetSnapshot> {
    const orgSpent = await this.getOrgSpent()
    const taskSpent = taskId ? await this.getTaskSpent(taskId) : 0
    const openaiSpent = taskId ? await this.getOpenaiSpent(taskId) : 0
    const llmCalls = taskId ? await this.getLlmCallCount(taskId) : 0
    const openaiCalls = taskId ? await this.getOpenaiCallCount(taskId) : 0
    const orgLimit = Math.min(this.orgBudgetUsd, this.orgHardStopUsd)
    return {
      taskSpentUsd: taskSpent,
      taskLimitUsd: this.taskBudgetUsd,
      taskRemainingUsd: Math.max(0, this.taskBudgetUsd - taskSpent),
      openaiSpentUsd: openaiSpent,
      openaiLimitUsd: this.openaiTaskBudgetUsd,
      orgSpentUsd: orgSpent,
      orgLimitUsd: orgLimit,
      orgRemainingUsd: Math.max(0, orgLimit - orgSpent),
      llmCalls,
      openaiCalls,
      downgraded: taskId ? this.downgradedTasks.has(taskId) : false,
    }
  }

  async assertTaskCanContinue(taskId: string): Promise<void> {
    const calls = await this.getLlmCallCount(taskId)
    if (calls >= this.maxLlmCallsPerTask) {
      throw new BudgetExceededError(
        `LLM call limit reached (${calls}/${this.maxLlmCallsPerTask})`,
        "task",
        calls,
        this.maxLlmCallsPerTask,
      )
    }
  }

  async shouldBlockPaidProvider(taskId: string, provider: ProviderName): Promise<boolean> {
    if (!this.isPaidProvider(provider)) return false
    const openaiSpent = await this.getOpenaiSpent(taskId)
    const openaiCalls = await this.getOpenaiCallCount(taskId)
    if (openaiSpent >= this.openaiTaskBudgetUsd) {
      logger.warn(`OpenAI task budget exhausted ($${openaiSpent.toFixed(4)}/$${this.openaiTaskBudgetUsd}) — using free providers`)
      return true
    }
    if (openaiCalls >= this.maxOpenaiCallsPerTask) {
      logger.warn(`OpenAI call limit reached (${openaiCalls}/${this.maxOpenaiCallsPerTask}) — using free providers`)
      return true
    }
    return false
  }

  async assertCanSpend(taskId: string, estimateUsd: number, provider?: ProviderName): Promise<void> {
    if (estimateUsd > this.maxSingleCallUsd) {
      throw new BudgetExceededError(
        `Single call estimate $${estimateUsd.toFixed(4)} exceeds max $${this.maxSingleCallUsd}`,
        "task",
        estimateUsd,
        this.maxSingleCallUsd,
      )
    }

    const taskSpent = await this.getTaskSpent(taskId)
    const orgSpent = await this.getOrgSpent()
    const orgLimit = Math.min(this.orgBudgetUsd, this.orgHardStopUsd)

    if (taskSpent + estimateUsd > this.taskBudgetUsd) {
      throw new BudgetExceededError(
        `Task budget exceeded ($${taskSpent.toFixed(4)} + $${estimateUsd.toFixed(4)} > $${this.taskBudgetUsd})`,
        "task",
        taskSpent,
        this.taskBudgetUsd,
      )
    }
    if (orgSpent + estimateUsd > orgLimit) {
      throw new BudgetExceededError(
        `Org budget exceeded ($${orgSpent.toFixed(4)} + $${estimateUsd.toFixed(4)} > $${orgLimit})`,
        "org",
        orgSpent,
        orgLimit,
      )
    }

    if (provider && this.isPaidProvider(provider)) {
      const openaiSpent = await this.getOpenaiSpent(taskId)
      if (openaiSpent + estimateUsd > this.openaiTaskBudgetUsd) {
        throw new BudgetExceededError(
          `OpenAI task budget exceeded ($${openaiSpent.toFixed(4)} + $${estimateUsd.toFixed(4)} > $${this.openaiTaskBudgetUsd})`,
          "task",
          openaiSpent,
          this.openaiTaskBudgetUsd,
        )
      }
    }
  }

  async commitSpend(taskId: string, actualUsd: number, provider?: ProviderName): Promise<void> {
    await this.incrCount(`budget:task:${taskId}:calls`)
    if (!this.redis) {
      this.llmCallsLocal.set(taskId, (this.llmCallsLocal.get(taskId) ?? 0) + 1)
    }

    if (actualUsd <= 0) return

    await this.addSpend(`budget:task:${taskId}`, actualUsd)
    await this.addSpend(orgMonthKey(), actualUsd)
    if (!this.redis) {
      const prev = this.taskSpentLocal.get(taskId) ?? 0
      this.taskSpentLocal.set(taskId, prev + actualUsd)
    }

    if (provider && this.isPaidProvider(provider)) {
      await this.incrCount(`budget:task:${taskId}:openai_calls`)
      await this.addSpend(`budget:task:${taskId}:openai`, actualUsd)
      if (!this.redis) {
        this.openaiCallsLocal.set(taskId, (this.openaiCallsLocal.get(taskId) ?? 0) + 1)
        const prev = this.openaiSpentLocal.get(taskId) ?? 0
        this.openaiSpentLocal.set(taskId, prev + actualUsd)
      }
    }
  }

  shouldDowngrade(taskId: string, taskSpentUsd: number): boolean {
    const threshold = this.taskBudgetUsd * this.downgradeThresholdPct
    if (taskSpentUsd >= threshold) {
      this.downgradedTasks.add(taskId)
      return true
    }
    return this.downgradedTasks.has(taskId)
  }

  async resetCallCounters(taskId: string): Promise<void> {
    this.downgradedTasks.delete(taskId)
    if (this.redis) {
      await this.redis.del(`budget:task:${taskId}:calls`, `budget:task:${taskId}:openai_calls`)
    } else {
      this.llmCallsLocal.delete(taskId)
      this.openaiCallsLocal.delete(taskId)
    }
  }

  /** @deprecated use resetCallCounters */
  async resetAttemptCounters(taskId: string): Promise<void> {
    return this.resetCallCounters(taskId)
  }

  downgradeModel(
    role: AgentRole,
    provider: ProviderName,
    model: string,
  ): { provider: ProviderName; model: string } {
    const ladder = DOWNGRADE_LADDER[provider]
    if (ladder) {
      const idx = ladder.indexOf(model)
      if (idx >= 0 && idx < ladder.length - 1) {
        const next = ladder[idx + 1]!
        logger.info(`Budget downgrade ${provider}/${model} → ${provider}/${next}`, { role })
        return { provider, model: next }
      }
    }
    if (provider === "openai" || provider === "anthropic") {
      logger.info(`Budget downgrade ${provider} → groq for role ${role}`)
      return { provider: "groq", model: "openai/gpt-oss-20b" }
    }
    return { provider, model }
  }

  estimateNextCall(
    provider: ProviderName,
    model: string,
    historyTokenEstimate: number,
    maxOutputTokens: number,
  ): number {
    const config = loadLLMConfig()
    return estimateCallCost(model, provider, historyTokenEstimate, maxOutputTokens, config.isFreeTier)
  }
}

let sharedGuard: BudgetGuard | null = null

export function getBudgetGuard(): BudgetGuard {
  if (!sharedGuard) sharedGuard = new BudgetGuard()
  return sharedGuard
}

export function resetBudgetGuardForTests(): void {
  sharedGuard = null
}
