import { describe, it, expect, beforeEach } from "vitest"
import { BudgetGuard, resetBudgetGuardForTests } from "../budgetGuard.js"
import { BudgetExceededError } from "../errors.js"

describe("BudgetGuard", () => {
  let guard: BudgetGuard

  beforeEach(() => {
    resetBudgetGuardForTests()
    process.env.TASK_BUDGET_USD = "0.10"
    process.env.OPENAI_TASK_BUDGET_USD = "0.08"
    process.env.ORG_BUDGET_USD = "5.00"
    guard = new BudgetGuard()
  })

  it("tracks task spend in memory", async () => {
    await guard.commitSpend("task-1", 0.05)
    const spent = await guard.getTaskSpent("task-1")
    expect(spent).toBeCloseTo(0.05, 4)
  })

  it("throws when task budget exceeded", async () => {
    await guard.commitSpend("task-2", 0.09)
    await expect(guard.assertCanSpend("task-2", 0.02)).rejects.toBeInstanceOf(BudgetExceededError)
  })

  it("downgrades openai to groq when ladder exhausted", () => {
    const result = guard.downgradeModel("executor", "openai", "gpt-4.1-nano")
    expect(result.provider).toBe("groq")
  })

  it("shouldDowngrade at 80% threshold", async () => {
    await guard.commitSpend("task-3", 0.06)
    expect(guard.shouldDowngrade("task-3", 0.06)).toBe(true)
  })

  it("snapshot returns limits", async () => {
    const snap = await guard.snapshot("task-4")
    expect(snap.taskLimitUsd).toBe(0.10)
    expect(snap.openaiLimitUsd).toBe(0.08)
    expect(snap.orgLimitUsd).toBe(4.75)
  })

  it("blocks paid provider when openai budget exhausted", async () => {
    await guard.commitSpend("task-5", 0.08, "openai")
    expect(await guard.shouldBlockPaidProvider("task-5", "openai")).toBe(true)
    expect(await guard.shouldBlockPaidProvider("task-5", "groq")).toBe(false)
  })

  it("rejects single call over max estimate", async () => {
    process.env.MAX_SINGLE_CALL_USD = "0.02"
    const g = new BudgetGuard()
    await expect(g.assertCanSpend("t", 0.05, "openai")).rejects.toBeInstanceOf(BudgetExceededError)
  })
})
