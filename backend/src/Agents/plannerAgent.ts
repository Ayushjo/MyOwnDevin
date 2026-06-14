import { AgentBrain } from "../AgentLayer/index.js"
import logger from "../logger.js"
import { PLANNER_PROMPT } from "../utils/prompts.js"
import { getLLMRouter } from "../llm/router.js"
import type { LLMRouter } from "../llm/router.js"
import type { MetricsCollector } from "../metrics/metrics.js"
import type { EventBus } from "../events/eventBus.js"
import { fallbackPlan, parsePlanSteps } from "./planParser.js"

export type Step = {
    id: number
    title: string
    description: string
}

const MAX_ATTEMPTS = 4

export class PlannerAgent {
    private router: LLMRouter
    private metrics?: MetricsCollector | undefined

    constructor(
        router?: LLMRouter,
        metrics?: MetricsCollector,
        private eventBus?: EventBus,
        private taskId?: string,
    ) {
        this.router = router ?? getLLMRouter()
        this.metrics = metrics
    }

    async plan(issueBody: string, repoStructure = ""): Promise<Step[]> {
        const basePrompt = repoStructure
            ? `${issueBody}\n\n---\nRepo structure:\n${repoStructure}`
            : issueBody

        let lastError: unknown

        for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
            try {
                const retryHint = attempt > 0
                    ? `\n\nIMPORTANT: Your previous response was invalid. Reply with ONLY a raw JSON array like [{"id":1,"description":"..."}] — no markdown, no explanation.`
                    : ""

                const brain = new AgentBrain({
                    systemPrompt: PLANNER_PROMPT,
                    role: "planner",
                    router: this.router,
                    onThought: (ev) => {
                        if (!this.eventBus || !this.taskId) return
                        // Skip the planner's "reasoning" event — it's the raw plan JSON,
                        // which is noisy in the terminal and already shown in the sidebar.
                        if (ev.status === "reasoning") return
                        void this.eventBus.emit(this.taskId, {
                            type: "agent_thought",
                            agent: ev.agent,
                            status: ev.status,
                            text: ev.text,
                            ...(ev.model ? { model: ev.model } : {}),
                            ...(ev.provider ? { provider: ev.provider } : {}),
                        })
                    },
                })

                const result = await brain.run(basePrompt + retryHint)
                const steps = parsePlanSteps(result.text)
                logger.info("Steps: " + JSON.stringify(steps))
                return steps
            } catch (error) {
                lastError = error
                logger.warn(`Planner attempt ${attempt + 1} failed: ${error}`)
            }
        }

        logger.warn(`Planner failed after ${MAX_ATTEMPTS} attempts, using fallback plan: ${lastError}`)
        const steps = fallbackPlan(issueBody)
        logger.info("Fallback steps: " + JSON.stringify(steps))
        return steps
    }
}
