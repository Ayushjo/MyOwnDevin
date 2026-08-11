import { describe, it, expect } from "vitest"
import { MetricsCollector } from "../metrics.js"

describe("MetricsCollector", () => {
  it("records LLM calls once", () => {
    const m = new MetricsCollector()
    m.recordLLMCall({
      model: "gpt-4o-mini",
      provider: "openai",
      inputTokens: 1000,
      outputTokens: 200,
      costUsd: 0.001,
      durationMs: 50,
      phase: "executing",
    })
    const snap = m.snapshot()
    expect(snap.llmCalls).toBe(1)
    expect(snap.inputTokens).toBe(1000)
    expect(snap.costUsd).toBeCloseTo(0.001, 4)
  })

  it("merges prior metrics on resume", () => {
    const prior = new MetricsCollector()
    prior.recordLLMCall({
      model: "groq",
      provider: "groq",
      inputTokens: 500,
      outputTokens: 100,
      costUsd: 0,
      durationMs: 10,
    })
    const resumed = MetricsCollector.fromPrior(prior.snapshot())
    resumed.recordLLMCall({
      model: "gpt-4o-mini",
      provider: "openai",
      inputTokens: 300,
      outputTokens: 50,
      costUsd: 0.0005,
      durationMs: 20,
    })
    const snap = resumed.snapshot()
    expect(snap.llmCalls).toBe(2)
    expect(snap.inputTokens).toBe(800)
  })

  it("tracks router retries and failovers", () => {
    const m = new MetricsCollector()
    m.recordRouterRetry()
    m.recordProviderFailover()
    m.recordProviderFailover()
    const snap = m.snapshot()
    expect(snap.routerRetries).toBe(1)
    expect(snap.providerFailovers).toBe(2)
  })

  it("includes budget fields in snapshot", () => {
    const m = new MetricsCollector()
    m.setBudgetFields({
      budgetLimitUsd: 0.25,
      budgetRemainingUsd: 0.20,
      orgBudgetRemainingUsd: 4.5,
    })
    const snap = m.snapshot()
    expect(snap.budgetLimitUsd).toBe(0.25)
    expect(snap.orgBudgetRemainingUsd).toBe(4.5)
  })

  it("records tool calls and retries separately", () => {
    const m = new MetricsCollector()
    m.recordToolCall()
    m.recordToolCall()
    m.recordRetry()
    expect(m.snapshot().toolCalls).toBe(2)
    expect(m.snapshot().retries).toBe(1)
  })
})
