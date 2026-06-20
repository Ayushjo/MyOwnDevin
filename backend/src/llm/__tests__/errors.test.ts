import { describe, it, expect } from "vitest"
import {
  isRateLimit,
  isDailyLimit,
  isInsufficientCredits,
  isToolCallError,
  isOutputParseFailed,
  parseRetryAfterMs,
  providerKey,
  BudgetExceededError,
} from "../errors.js"

describe("errors", () => {
  it("detects rate limits", () => {
    expect(isRateLimit(new Error("429 Rate limit reached"))).toBe(true)
    expect(isRateLimit(new Error("quota exceeded"))).toBe(true)
    expect(isRateLimit(new Error("something else"))).toBe(false)
  })

  it("detects daily token limits", () => {
    expect(isDailyLimit(new Error("tokens per day (TPD): Limit 200000"))).toBe(true)
  })

  it("detects insufficient credits", () => {
    expect(isInsufficientCredits(new Error("402 insufficient credits"))).toBe(true)
    expect(isInsufficientCredits(new Error("prompt tokens limit exceeded"))).toBe(true)
  })

  it("detects tool call errors", () => {
    expect(isToolCallError(new Error("tool_use_failed: validation"))).toBe(true)
  })

  it("detects output parse failures", () => {
    expect(isOutputParseFailed(new Error("400 Parsing failed. The model generated output that could not be parsed."))).toBe(true)
    expect(isOutputParseFailed(new Error("output_parse_failed"))).toBe(true)
    expect(isOutputParseFailed(new Error("failed_generation"))).toBe(true)
  })

  it("parses retry-after from Groq message", () => {
    const ms = parseRetryAfterMs(new Error("try again in 22.5s"))
    expect(ms).toBeGreaterThan(22000)
    expect(ms).toBeLessThan(24000)
  })

  it("builds provider keys", () => {
    expect(providerKey("groq", "openai/gpt-oss-20b")).toBe("groq:openai/gpt-oss-20b")
  })

  it("BudgetExceededError carries scope", () => {
    const err = new BudgetExceededError("over", "task", 0.26, 0.25)
    expect(err.scope).toBe("task")
    expect(err.spentUsd).toBe(0.26)
  })
})
