import type { ModelPricing, ProviderName } from "./types.js"

export const MODEL_PRICING: Record<string, ModelPricing> = {
  "gemini-2.0-flash": { inputPer1M: 0.10, outputPer1M: 0.40 },
  "gemini-2.5-flash": { inputPer1M: 0.15, outputPer1M: 0.60 },
  "gemini-2.5-pro": { inputPer1M: 1.25, outputPer1M: 10.0 },
  "gpt-4o-mini": { inputPer1M: 0.15, outputPer1M: 0.60 },
  "gpt-4.1-nano": { inputPer1M: 0.10, outputPer1M: 0.40 },
  "llama-3.1-8b-instant": { inputPer1M: 0.05, outputPer1M: 0.08 },
  "openai/gpt-oss-20b": { inputPer1M: 0.10, outputPer1M: 0.50 },
  "openai/gpt-oss-120b": { inputPer1M: 0.15, outputPer1M: 0.60 },
  "google/gemini-3.5-flash": { inputPer1M: 0.15, outputPer1M: 0.60 },
  "qwen/qwen-2.5-coder-32b-instruct": { inputPer1M: 0.07, outputPer1M: 0.16 },
  "meta-llama/llama-3.3-70b-instruct": { inputPer1M: 0.10, outputPer1M: 0.25 },
  "llama-3.3-70b-versatile": { inputPer1M: 0.59, outputPer1M: 0.79 },
  "claude-haiku-4-5-20251001": { inputPer1M: 1.0, outputPer1M: 5.0 },
  "claude-sonnet-5": { inputPer1M: 2.0, outputPer1M: 10.0 },
  "claude-opus-5": { inputPer1M: 5.0, outputPer1M: 25.0 },
}

const PAID_PROVIDERS = new Set<ProviderName>(["openai", "anthropic"])

export function rawCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = MODEL_PRICING[model] ?? { inputPer1M: 1.0, outputPer1M: 3.0 }
  return (
    (inputTokens / 1_000_000) * pricing.inputPer1M +
    (outputTokens / 1_000_000) * pricing.outputPer1M
  )
}

export function computeProviderCost(
  provider: ProviderName,
  model: string,
  inputTokens: number,
  outputTokens: number,
  isFreeTier = true,
): number {
  if (isFreeTier && !PAID_PROVIDERS.has(provider)) return 0
  return rawCost(model, inputTokens, outputTokens)
}

export function computeCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
  isFreeTier = true,
): number {
  if (isFreeTier) return 0
  return rawCost(model, inputTokens, outputTokens)
}

export function computeShadowCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  return rawCost(model, inputTokens, outputTokens)
}

/** Rough pre-call estimate for budget reservation. */
export function estimateCallCost(
  model: string,
  provider: ProviderName,
  inputTokens: number,
  maxOutputTokens: number,
  isFreeTier: boolean,
): number {
  return computeProviderCost(provider, model, inputTokens, maxOutputTokens, isFreeTier)
}
