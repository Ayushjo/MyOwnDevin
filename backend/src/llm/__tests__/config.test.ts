import { describe, it, expect } from "vitest"
import { loadLLMConfig } from "../config.js"

describe("loadLLMConfig", () => {
  it("loads hybrid role models from env or defaults", () => {
    const config = loadLLMConfig()
    expect(config.roles.executor.provider).toBe("openai")
    expect(config.roles.planner.provider).toBe("groq")
    expect(config.failover).toContain("openai")
  })

  it("includes budget settings", () => {
    const config = loadLLMConfig()
    expect(config.taskBudgetUsd).toBeGreaterThan(0)
    expect(config.orgBudgetUsd).toBeGreaterThan(0)
  })

  it("respects LLM_MAX_TOKENS", () => {
    const config = loadLLMConfig()
    expect(config.maxTokens).toBeGreaterThan(0)
  })
})
