import { describe, it, expect } from "vitest"
import { ROLE_MODELS, failoverModelFor, DEFAULT_FAILOVER } from "../models.js"

describe("models", () => {
  it("uses groq for planner", () => {
    expect(ROLE_MODELS.planner.provider).toBe("groq")
    expect(ROLE_MODELS.planner.model).toBe("llama-3.1-8b-instant")
  })

  it("uses openai for executor", () => {
    expect(ROLE_MODELS.executor.provider).toBe("openai")
    expect(ROLE_MODELS.executor.model).toBe("gpt-4o-mini")
  })

  it("failover executor to groq 20b", () => {
    expect(failoverModelFor("executor", "groq")).toBe("openai/gpt-oss-20b")
  })

  it("includes openai in default failover", () => {
    expect(DEFAULT_FAILOVER).toContain("openai")
  })
})
