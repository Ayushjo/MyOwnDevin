import type { AgentRole, ProviderName } from "./types.js"

/** Hybrid routing — cheap free models for planner/verifier, OpenAI mini for executor tool loops. */
const GROQ_8B = "llama-3.1-8b-instant"
const GROQ_20B = "openai/gpt-oss-20b"
const GROQ_120B = "openai/gpt-oss-120b"
const GEMINI_FLASH = "gemini-2.5-flash"
const LLAMA_70B = "meta-llama/llama-3.3-70b-instruct"
const GPT4O_MINI = "gpt-4o-mini"
const GPT41_NANO = "gpt-4.1-nano"

export const ROLE_MODELS: Record<AgentRole, { provider: ProviderName; model: string }> = {
  planner:  { provider: "groq", model: GROQ_8B },
  executor: { provider: "openai", model: GPT4O_MINI },
  verifier: { provider: "groq", model: GROQ_8B },
  replan:   { provider: "openai", model: GPT41_NANO },
}

export const ROLE_FAILOVER_MODELS: Record<AgentRole, Partial<Record<ProviderName, string>>> = {
  planner: {
    openai: GPT41_NANO,
    gemini: GEMINI_FLASH,
    openrouter: LLAMA_70B,
  },
  executor: {
    groq: GROQ_20B,
    gemini: GEMINI_FLASH,
    openrouter: LLAMA_70B,
  },
  verifier: {
    openai: GPT41_NANO,
    gemini: GEMINI_FLASH,
  },
  replan: {
    groq: GROQ_20B,
    gemini: GEMINI_FLASH,
  },
}

export const EXTRA_MODELS: Partial<Record<ProviderName, string[]>> = {
  groq: [GROQ_8B, GROQ_20B, GROQ_120B],
  openai: [GPT4O_MINI, GPT41_NANO],
  gemini: [GEMINI_FLASH],
  openrouter: [LLAMA_70B],
}

/** Downgrade ladder when task budget is tight (most expensive first). */
export const DOWNGRADE_LADDER: Partial<Record<ProviderName, string[]>> = {
  openai: [GPT4O_MINI, GPT41_NANO],
  groq: [GROQ_20B, GROQ_8B],
  gemini: [GEMINI_FLASH],
}

export const DEFAULT_FAILOVER: ProviderName[] = ["groq", "gemini", "openai"]

export function failoverModelFor(role: AgentRole, provider: ProviderName): string {
  return ROLE_FAILOVER_MODELS[role][provider]
    ?? ROLE_FAILOVER_MODELS.executor[provider]
    ?? ROLE_MODELS[role].model
}
