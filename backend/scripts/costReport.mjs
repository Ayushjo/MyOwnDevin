#!/usr/bin/env node
/** Summarize org LLM spend from Redis budget keys. */
import { getBudgetGuard } from "../dist/llm/budgetGuard.js"

const guard = getBudgetGuard()
const snap = await guard.snapshot()
console.log(JSON.stringify({
  orgSpentUsd: snap.orgSpentUsd,
  orgLimitUsd: snap.orgLimitUsd,
  orgRemainingUsd: snap.orgRemainingUsd,
  taskBudgetUsd: snap.taskLimitUsd,
}, null, 2))
