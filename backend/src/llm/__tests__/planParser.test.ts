import { describe, it, expect } from "vitest"
import { parsePlanSteps, extractPlanJson, fallbackPlan } from "../../Agents/planParser.js"

const VALID_PLAN = `[
  {"id": 1, "description": "Update backend/src/api/router.ts to add cancel route"},
  {"id": 2, "description": "Update frontend/src/api/client.ts with cancelTask method"}
]`

describe("planParser", () => {
  it("parses raw JSON array", () => {
    const steps = parsePlanSteps(VALID_PLAN)
    expect(steps).toHaveLength(2)
    expect(steps[0]!.id).toBe(1)
    expect(steps[0]!.title).toBeTruthy()
  })

  it("parses fenced JSON", () => {
    const steps = parsePlanSteps("```json\n" + VALID_PLAN + "\n```")
    expect(steps).toHaveLength(2)
  })

  it("deduplicates identical steps", () => {
    const dup = `[{"id":1,"description":"Do X"},{"id":2,"description":"Do X"}]`
    expect(parsePlanSteps(dup)).toHaveLength(1)
  })

  it("extractPlanJson throws on empty", () => {
    expect(() => extractPlanJson("")).toThrow()
  })

  it("fallbackPlan returns steps for health issue", () => {
    const steps = fallbackPlan("Add health endpoint with redis ping")
    expect(steps.length).toBeGreaterThanOrEqual(2)
  })
})
