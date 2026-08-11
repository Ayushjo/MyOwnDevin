import type { PhaseMetrics, PhaseName, TaskMetricsSnapshot } from "../events/types.js"
import { computeShadowCost } from "../llm/pricing.js"
import { loadLLMConfig } from "../llm/config.js"

function mergeMetrics(a: TaskMetricsSnapshot, b: TaskMetricsSnapshot): TaskMetricsSnapshot {
  const phases: Partial<Record<PhaseName, PhaseMetrics>> = { ...a.phases }
  for (const [key, pm] of Object.entries(b.phases) as [PhaseName, PhaseMetrics][]) {
    const prev = phases[key]
    if (prev) {
      const merged: PhaseMetrics = {
        durationMs: prev.durationMs + pm.durationMs,
        inputTokens: (prev.inputTokens ?? 0) + (pm.inputTokens ?? 0),
        outputTokens: (prev.outputTokens ?? 0) + (pm.outputTokens ?? 0),
        costUsd: (prev.costUsd ?? 0) + (pm.costUsd ?? 0),
      }
      const model = pm.model ?? prev.model
      const provider = pm.provider ?? prev.provider
      if (model) merged.model = model
      if (provider) merged.provider = provider
      phases[key] = merged
    } else {
      phases[key] = { ...pm }
    }
  }
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    costUsd: a.costUsd + b.costUsd,
    shadowCostUsd: a.shadowCostUsd + b.shadowCostUsd,
    llmCalls: a.llmCalls + b.llmCalls,
    toolCalls: a.toolCalls + b.toolCalls,
    retries: a.retries + b.retries,
    routerRetries: (a.routerRetries ?? 0) + (b.routerRetries ?? 0),
    providerFailovers: (a.providerFailovers ?? 0) + (b.providerFailovers ?? 0),
    durationMs: a.durationMs + b.durationMs,
    phases,
    ...(b.budgetUsedUsd !== undefined || a.budgetUsedUsd !== undefined
      ? { budgetUsedUsd: b.budgetUsedUsd ?? a.budgetUsedUsd }
      : {}),
    ...(b.budgetLimitUsd !== undefined || a.budgetLimitUsd !== undefined
      ? { budgetLimitUsd: b.budgetLimitUsd ?? a.budgetLimitUsd }
      : {}),
    ...(b.budgetRemainingUsd !== undefined || a.budgetRemainingUsd !== undefined
      ? { budgetRemainingUsd: b.budgetRemainingUsd ?? a.budgetRemainingUsd }
      : {}),
    ...(b.orgBudgetRemainingUsd !== undefined || a.orgBudgetRemainingUsd !== undefined
      ? { orgBudgetRemainingUsd: b.orgBudgetRemainingUsd ?? a.orgBudgetRemainingUsd }
      : {}),
  }
}

export class MetricsCollector {
  private prior: TaskMetricsSnapshot | null = null
  private startedAt = Date.now()
  private budgetFields: Partial<TaskMetricsSnapshot> = {}

  static fromPrior(prior: TaskMetricsSnapshot): MetricsCollector {
    const m = new MetricsCollector()
    m.prior = prior
    return m
  }
  private phases: Partial<Record<PhaseName, PhaseMetrics>> = {}
  private phaseStarts = new Map<PhaseName, number>()
  private inputTokens = 0
  private outputTokens = 0
  private costUsd = 0
  private shadowCostUsd = 0
  private llmCalls = 0
  private toolCalls = 0
  private retries = 0
  private routerRetries = 0
  private providerFailovers = 0

  setBudgetFields(fields: Partial<TaskMetricsSnapshot>) {
    this.budgetFields = { ...this.budgetFields, ...fields }
  }

  startPhase(phase: PhaseName) {
    this.phaseStarts.set(phase, Date.now())
  }

  endPhase(phase: PhaseName, extra?: Partial<PhaseMetrics>) {
    const start = this.phaseStarts.get(phase) ?? Date.now()
    this.phases[phase] = {
      durationMs: Date.now() - start,
      ...extra,
    }
  }

  recordLLMCall(params: {
    model: string
    provider: string
    inputTokens: number
    outputTokens: number
    costUsd: number
    durationMs: number
    phase?: PhaseName
  }) {
    this.llmCalls++
    this.inputTokens += params.inputTokens
    this.outputTokens += params.outputTokens
    this.costUsd += params.costUsd
    this.shadowCostUsd += computeShadowCost(params.model, params.inputTokens, params.outputTokens)
    this.budgetFields.budgetUsedUsd = this.costUsd

    if (params.phase) {
      const existing = this.phases[params.phase] ?? { durationMs: 0 }
      this.phases[params.phase] = {
        ...existing,
        model: params.model,
        provider: params.provider,
        inputTokens: (existing.inputTokens ?? 0) + params.inputTokens,
        outputTokens: (existing.outputTokens ?? 0) + params.outputTokens,
        costUsd: (existing.costUsd ?? 0) + params.costUsd,
      }
    }
  }

  recordToolCall() {
    this.toolCalls++
  }

  recordRetry() {
    this.retries++
  }

  recordRouterRetry() {
    this.routerRetries++
  }

  recordProviderFailover() {
    this.providerFailovers++
  }

  private currentSnapshot(): TaskMetricsSnapshot {
    const config = loadLLMConfig()
    const budgetLimit = this.budgetFields.budgetLimitUsd ?? config.taskBudgetUsd
    const base: TaskMetricsSnapshot = {
      inputTokens: this.inputTokens,
      outputTokens: this.outputTokens,
      costUsd: this.costUsd,
      shadowCostUsd: this.shadowCostUsd,
      llmCalls: this.llmCalls,
      toolCalls: this.toolCalls,
      retries: this.retries,
      routerRetries: this.routerRetries,
      providerFailovers: this.providerFailovers,
      durationMs: Date.now() - this.startedAt,
      phases: { ...this.phases },
      budgetUsedUsd: this.budgetFields.budgetUsedUsd ?? this.costUsd,
      budgetLimitUsd: budgetLimit,
      budgetRemainingUsd: this.budgetFields.budgetRemainingUsd ??
        Math.max(0, budgetLimit - this.costUsd),
    }
    if (this.budgetFields.orgBudgetRemainingUsd !== undefined) {
      base.orgBudgetRemainingUsd = this.budgetFields.orgBudgetRemainingUsd
    }
    return base
  }

  snapshot(): TaskMetricsSnapshot {
    const current = this.currentSnapshot()
    return this.prior ? mergeMetrics(this.prior, current) : current
  }
}
