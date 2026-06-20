import type { AgentRole, LLMProvider, ChatParams, LLMResponse, UsageCallback, ProviderName } from "./types.js"
import { loadLLMConfig } from "./config.js"
import { EXTRA_MODELS, failoverModelFor } from "./models.js"
import type { BudgetGuard } from "./budgetGuard.js"
import {
  BudgetExceededError,
  isAgentRecoverableError,
  isDailyLimit,
  isInsufficientCredits,
  isOutputParseFailed,
  isRateLimit,
  isToolCallError,
  parseRetryAfterMs,
  providerKey,
} from "./errors.js"
import { createGeminiProvider } from "./providers/gemini.js"
import { createGroqProvider } from "./providers/groq.js"
import { createAnthropicProvider } from "./providers/anthropic.js"
import { createOpenRouterProvider } from "./providers/openrouter.js"
import { createOpenAIProvider } from "./providers/openai.js"
import logger from "../logger.js"

export type RouterMetricsHooks = {
  onFailover?: () => void
  onRouterRetry?: () => void
}

export type RouterContext = {
  taskId?: string
  budgetGuard?: BudgetGuard
  metrics?: RouterMetricsHooks
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function affordableMaxTokens(error: unknown, requested: number): number | null {
  if (!(error instanceof Error)) return null
  const match = error.message.match(/can only afford (\d+)/i)
  if (!match?.[1]) return null
  const afford = parseInt(match[1], 10)
  if (afford < 256) return null
  return Math.min(requested, afford - 64)
}

function isProviderFailover(error: unknown): boolean {
  if (error instanceof Error) {
    if (isAgentRecoverableError(error)) return false
    const msg = error.message.toLowerCase()
    return (
      isRateLimit(error) ||
      isInsufficientCredits(error) ||
      isOutputParseFailed(error) ||
      msg.includes("404") ||
      msg.includes("does not exist") ||
      msg.includes("not a valid model") ||
      msg.includes("not found") ||
      msg.includes("500") ||
      msg.includes("502") ||
      msg.includes("503") ||
      msg.includes("overloaded") ||
      msg.includes("resource_exhausted")
    )
  }
  return false
}

const cooldownUntil = new Map<string, number>()

function isOnCooldown(provider: ProviderName, model: string): boolean {
  const until = cooldownUntil.get(providerKey(provider, model))
  return until !== undefined && Date.now() < until
}

function markCooldown(provider: ProviderName, model: string, error: unknown) {
  const key = providerKey(provider, model)
  if (isDailyLimit(error)) {
    cooldownUntil.set(key, Date.now() + 6 * 60 * 60 * 1000)
    logger.warn(`Provider ${key} on daily limit cooldown (6h)`)
    return
  }
  if (isInsufficientCredits(error)) {
    cooldownUntil.set(key, Date.now() + 10 * 60 * 1000)
    return
  }
  const wait = parseRetryAfterMs(error)
  if (wait) cooldownUntil.set(key, Date.now() + wait)
}

function buildChain(role: AgentRole, primary: { provider: ProviderName; model: string }, failover: ProviderName[]) {
  const chain: { provider: ProviderName; model: string }[] = []
  const seen = new Set<string>()

  const add = (provider: ProviderName, model: string) => {
    const key = providerKey(provider, model)
    if (seen.has(key) || isOnCooldown(provider, model)) return
    seen.add(key)
    chain.push({ provider, model })
  }

  add(primary.provider, primary.model)

  for (const provider of failover) {
    if (provider === primary.provider) {
      for (const model of EXTRA_MODELS[provider] ?? []) {
        if (model !== primary.model) add(provider, model)
      }
      continue
    }
    add(provider, failoverModelFor(role, provider))
    for (const model of EXTRA_MODELS[provider] ?? []) {
      add(provider, model)
    }
  }

  return chain
}

function estimateHistoryTokens(params: ChatParams): number {
  let chars = params.system.length
  for (const msg of params.messages) {
    if (typeof msg.content === "string") {
      chars += msg.content.length
    } else {
      for (const block of msg.content) {
        if (block.type === "text") chars += block.text.length
        else if (block.type === "tool_result") chars += block.content.length
        else chars += JSON.stringify(block.input).length
      }
    }
  }
  return Math.ceil(chars / 4)
}

export class LLMRouter {
  private config = loadLLMConfig()

  constructor(
    private onUsage?: UsageCallback,
    private context: RouterContext = {},
  ) {}

  modelFor(role: AgentRole): { provider: ProviderName; model: string } {
    return this.config.roles[role]
  }

  private createProvider(provider: ProviderName, model: string): LLMProvider | null {
    switch (provider) {
      case "gemini": return createGeminiProvider(model)
      case "groq": return createGroqProvider(model)
      case "anthropic": return createAnthropicProvider(model)
      case "openrouter": return createOpenRouterProvider(model)
      case "openai": return createOpenAIProvider(model)
      default:
        logger.warn(`Unknown provider: ${provider}`)
        return null
    }
  }

  async chat(role: AgentRole, params: ChatParams): Promise<LLMResponse> {
    let primary = this.config.roles[role]
    const guard = this.context.budgetGuard
    const taskId = this.context.taskId

    if (guard && taskId) {
      const spent = await guard.getTaskSpent(taskId)
      if (guard.shouldDowngrade(taskId, spent)) {
        primary = guard.downgradeModel(role, primary.provider, primary.model)
      }
    }

    // Tool loops: OpenAI first, Groq fallback (same message format). Skip Gemini — turn-order fragile.
    const failover =
      role === "executor" && (params.tools?.length ?? 0) > 0
        ? (["openai", "groq"] as ProviderName[])
        : this.config.failover
    const chain = buildChain(role, primary, failover)

    if (chain.length === 0) {
      throw new Error("All LLM providers are on cooldown — wait a few minutes and retry")
    }

    let lastError: unknown
    let budgetBlocked = false
    let maxTokens = params.maxTokens ?? this.config.maxTokens
    if (role === "executor" && params.tools?.length) {
      maxTokens = Math.max(maxTokens, Number(process.env.EXECUTOR_MAX_TOKENS ?? 3072))
    }

    for (const { provider, model } of chain) {
      if (guard && taskId) {
        if (await guard.shouldBlockPaidProvider(taskId, provider)) {
          budgetBlocked = true
          this.context.metrics?.onFailover?.()
          continue
        }
        const est = guard.estimateNextCall(provider, model, estimateHistoryTokens(params), maxTokens)
        await guard.assertCanSpend(taskId, est, provider)
      }

      const instance = this.createProvider(provider, model)
      if (!instance) continue

      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const start = Date.now()
          const response = await instance.chat({ ...params, maxTokens })
          const durationMs = Date.now() - start

          if (guard && taskId) {
            await guard.commitSpend(taskId, response.usage.costUsd, response.provider as ProviderName)
          }

          this.onUsage?.({
            ...response.usage,
            role,
            model: response.model,
            provider: response.provider,
            durationMs,
          })

          return response
        } catch (error) {
          lastError = error
          if (error instanceof BudgetExceededError) throw error

          markCooldown(provider, model, error)

          if (isOutputParseFailed(error) || isAgentRecoverableError(error)) {
            logger.warn(`Recoverable error on ${provider}/${model} — surfacing to agent`, {
              reason: error instanceof Error ? error.message.slice(0, 200) : error,
            })
            throw error
          }

          if (isDailyLimit(error) || isInsufficientCredits(error)) {
            logger.warn(`Provider ${provider}/${model} budget exhausted, failing over`, {
              reason: error instanceof Error ? error.message.slice(0, 200) : error,
            })
            this.context.metrics?.onFailover?.()
            break
          }

          const retryMs = parseRetryAfterMs(error)
          if (isRateLimit(error) && retryMs && retryMs < 5 * 60 * 1000 && attempt < 2) {
            logger.warn(`Rate limited on ${provider}/${model}, waiting ${retryMs}ms`, { attempt: attempt + 1 })
            this.context.metrics?.onRouterRetry?.()
            await sleep(retryMs)
            continue
          }

          if (isToolCallError(error)) {
            logger.warn(`Invalid tool call on ${provider}/${model} — surfacing to agent`, {
              reason: error instanceof Error ? error.message.slice(0, 200) : error,
            })
            throw error
          }

          const reduced = affordableMaxTokens(error, maxTokens)
          if (reduced && reduced < maxTokens) {
            maxTokens = reduced
            logger.warn(`Reducing max_tokens to ${maxTokens} for ${provider}/${model}`)
            this.context.metrics?.onRouterRetry?.()
            continue
          }

          if (isProviderFailover(error)) {
            logger.warn(`Provider ${provider}/${model} failed, trying next`, {
              reason: error instanceof Error ? error.message.slice(0, 150) : error,
            })
            this.context.metrics?.onFailover?.()
            break
          }
          throw error
        }
      }
    }

    if (budgetBlocked && !lastError) {
      const snap = guard && taskId ? await guard.snapshot(taskId) : null
      throw new BudgetExceededError(
        `OpenAI call limit reached (${snap?.openaiCalls ?? "?"}/${guard?.maxOpenaiCallsPerTask ?? "?"} per step) — retry or raise MAX_OPENAI_CALLS_PER_TASK`,
        "task",
        snap?.openaiCalls ?? 0,
        guard?.maxOpenaiCallsPerTask ?? 0,
      )
    }

    throw lastError ?? new Error(`No LLM provider available for role: ${role}`)
  }
}

let defaultRouter: LLMRouter | null = null

export function getLLMRouter(onUsage?: UsageCallback, context?: RouterContext): LLMRouter {
  if (onUsage || context) return new LLMRouter(onUsage, context)
  if (!defaultRouter) defaultRouter = new LLMRouter()
  return defaultRouter
}

export function resetDefaultRouter(): void {
  defaultRouter = null
}

export { isRateLimit, isDailyLimit, isOutputParseFailed, parseRetryAfterMs } from "./errors.js"
