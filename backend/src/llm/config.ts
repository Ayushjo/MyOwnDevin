import type { AgentRole, ProviderName } from "./types.js"
import { DEFAULT_FAILOVER, ROLE_MODELS } from "./models.js"

export type ModelConfig = {
  provider: ProviderName
  model: string
}

export type LLMConfig = {
  roles: Record<AgentRole, ModelConfig>
  failover: ProviderName[]
  maxTokens: number
  isFreeTier: boolean
  taskBudgetUsd: number
  orgBudgetUsd: number
}

function parseRoleModel(envKey: string, fallback: ModelConfig): ModelConfig {
  const val = process.env[envKey]
  if (!val) return fallback
  const [provider, ...modelParts] = val.split(":")
  if (!provider || modelParts.length === 0) return fallback
  return { provider: provider as ProviderName, model: modelParts.join(":") }
}

export function loadLLMConfig(): LLMConfig {
  return {
    roles: {
      planner: parseRoleModel("PLANNER_MODEL", ROLE_MODELS.planner),
      executor: parseRoleModel("EXECUTOR_MODEL", ROLE_MODELS.executor),
      verifier: parseRoleModel("VERIFIER_MODEL", ROLE_MODELS.verifier),
      replan: parseRoleModel("REPLAN_MODEL", ROLE_MODELS.replan),
    },
    failover: (process.env.LLM_FAILOVER ?? DEFAULT_FAILOVER.join(","))
      .split(",")
      .map((p) => p.trim() as ProviderName)
      .filter(Boolean),
    maxTokens: Number(process.env.LLM_MAX_TOKENS ?? 4096),
    isFreeTier: process.env.LLM_FREE_TIER !== "false",
    taskBudgetUsd: Number(process.env.TASK_BUDGET_USD ?? 0.25),
    orgBudgetUsd: Number(process.env.ORG_BUDGET_USD ?? 5.0),
  }
}
