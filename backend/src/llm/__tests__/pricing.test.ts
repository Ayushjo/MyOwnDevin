import { describe, it, expect } from "vitest"
import { computeProviderCost, computeShadowCost, rawCost, estimateCallCost } from "../pricing.js"

describe("pricing", () => {
  it("computes shadow cost for gpt-4o-mini", () => {
    const cost = computeShadowCost("gpt-4o-mini", 100_000, 5_000)
    expect(cost).toBeCloseTo(0.015 + 0.003, 4)
  })

  it("returns zero for free-tier groq", () => {
    expect(computeProviderCost("groq", "llama-3.1-8b-instant", 50_000, 2_000, true)).toBe(0)
  })

  it("bills openai even on free tier flag", () => {
    const cost = computeProviderCost("openai", "gpt-4o-mini", 10_000, 1_000, true)
    expect(cost).toBeGreaterThan(0)
  })

  it("estimates call cost", () => {
    const est = estimateCallCost("gpt-4.1-nano", "openai", 8000, 2048, false)
    expect(est).toBeGreaterThan(0)
    expect(est).toBeLessThan(0.01)
  })

  it("uses fallback pricing for unknown models", () => {
    const cost = rawCost("unknown-model", 1_000_000, 1_000_000)
    expect(cost).toBeGreaterThan(0)
  })
})
