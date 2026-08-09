import { describe, it, expect } from "vitest"
import { readFileSync } from "fs"
import path from "path"
import { fileURLToPath } from "url"
import {
  isOutputParseFailed,
  isDailyLimit,
  isInsufficientCredits,
  isRateLimit,
} from "../llm/errors.js"
import { parsePlanSteps } from "../Agents/planParser.js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fixturesDir = path.join(__dirname, "fixtures")

function loadFixture(name: string): { error: { message: string }; status: number } {
  return JSON.parse(readFileSync(path.join(fixturesDir, name), "utf-8"))
}

describe("error classification evals", () => {
  it("classifies groq parse failure as immediate failover", () => {
    const fx = loadFixture("groq-parse-failed.json")
    const err = new Error(`${fx.status} ${fx.error.message}`)
    expect(isOutputParseFailed(err)).toBe(true)
    expect(isRateLimit(err)).toBe(false)
  })

  it("classifies groq TPD as daily limit", () => {
    const fx = loadFixture("groq-tpd-exhausted.json")
    const err = new Error(`${fx.status} ${fx.error.message}`)
    expect(isDailyLimit(err)).toBe(true)
    expect(isRateLimit(err)).toBe(true)
  })

  it("classifies openrouter 402 as insufficient credits", () => {
    const fx = loadFixture("openrouter-402.json")
    const err = new Error(`${fx.status} ${fx.error.message}`)
    expect(isInsufficientCredits(err)).toBe(true)
  })
})

describe("planner golden evals", () => {
  it("parses valid 8-step plan within 4 attempts rule (single shot)", () => {
    const plan = `[
      {"id":1,"description":"Add cancel flag to task registry"},
      {"id":2,"description":"Implement POST /api/task/:id/cancel route"},
      {"id":3,"description":"Create run history store"},
      {"id":4,"description":"Extend task API"},
      {"id":5,"description":"Update task registry"},
      {"id":6,"description":"Update frontend API client"},
      {"id":7,"description":"Update task view"},
      {"id":8,"description":"Update dashboard"}
    ]`
    const steps = parsePlanSteps(plan)
    expect(steps).toHaveLength(8)
    expect(steps[5]!.description).toContain("frontend")
  })
})
