import { AgentBrain } from "../AgentLayer/index.js"
import logger from "../logger.js"
import type ToolExecutor from "../tools/index.js"
import { EXECUTOR_PROMPT } from "../utils/prompts.js"
import type { Step } from "./plannerAgent.js"
import type { VerifierAgent } from "./verifierAgent.js"
import type { LLMRouter } from "../llm/router.js"
import { getLLMRouter } from "../llm/router.js"
import { isDailyLimit, isOutputParseFailed, isRateLimit, parseRetryAfterMs } from "../llm/errors.js"
import { loadLLMConfig } from "../llm/config.js"

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms))
}
import type { MetricsCollector } from "../metrics/metrics.js"
import type { EventBus } from "../events/eventBus.js"
import type { ToolEventCallback } from "../llm/types.js"
import type { VerificationResult } from "../events/types.js"

type StepResult = {
    success: boolean
    output: string
    usage: { inputTokens: number; outputTokens: number; costUsd: number }
    toolCalls: number
}

export class ExecutorAgent {
    private router: LLMRouter

    constructor(
        private toolExecutor: ToolExecutor,
        router?: LLMRouter,
        private eventBus?: EventBus,
        private taskId?: string,
        private metrics?: MetricsCollector,
        private stepId?: number,
    ) {
        this.router = router ?? getLLMRouter()
    }

    /**
     * Observe → act → verify → feedback loop (up to MAX_STEP_VERIFY_ATTEMPTS).
     * Keeps one AgentBrain conversation so the LLM sees prior tool results and errors.
     */
    async executeWithVerification(
        step: Step,
        contextPrompt: string,
        verifier: VerifierAgent,
    ): Promise<{ stepResult: StepResult; verification: VerificationResult }> {
        const config = loadLLMConfig()
        const budgetTight = (this.metrics?.snapshot().costUsd ?? 0) > config.taskBudgetUsd * 0.5
        const maxAttempts = budgetTight
            ? Math.min(Number(process.env.MAX_STEP_VERIFY_ATTEMPTS ?? 5), 3)
            : Number(process.env.MAX_STEP_VERIFY_ATTEMPTS ?? 5)
        this.toolExecutor.resetCommandCache()

        const onToolEvent: ToolEventCallback = (event) => {
            if (!this.eventBus || !this.taskId) return
            if (event.type === "tool_call") {
                void this.eventBus.emit(this.taskId, {
                    type: "tool_call",
                    tool: event.tool,
                    args: event.args,
                    ...(this.stepId !== undefined ? { stepId: this.stepId } : {}),
                })
                this.metrics?.recordToolCall()
            } else {
                void this.eventBus.emit(this.taskId, {
                    type: "tool_result",
                    tool: event.tool,
                    success: event.success,
                    output: event.output.slice(0, 500),
                    durationMs: event.durationMs,
                    ...(this.stepId !== undefined ? { stepId: this.stepId } : {}),
                })
            }
        }

        const onThought = (ev: { status: "thinking" | "reasoning"; agent: string; text: string; model?: string; provider?: string }) => {
            if (!this.eventBus || !this.taskId) return
            void this.eventBus.emit(this.taskId, {
                type: "agent_thought",
                agent: ev.agent,
                status: ev.status,
                text: ev.text,
                ...(ev.model ? { model: ev.model } : {}),
                ...(ev.provider ? { provider: ev.provider } : {}),
            })
        }

        const brain = new AgentBrain({
            systemPrompt: EXECUTOR_PROMPT,
            role: "executor",
            router: this.router,
            toolExecutor: this.toolExecutor,
            onToolEvent,
            onThought,
            stepId: this.stepId,
        })

        const initialMessage = contextPrompt
            ? `${contextPrompt}\n\n---\nComplete this step: ${step.description}`
            : `Complete this step: ${step.description}`

        let lastResult = await this.safeBrainRun(brain, initialMessage, maxAttempts, step.description)
        let verification = await verifier.verify(step, lastResult.text, this.toolExecutor)

        for (let attempt = 1; attempt < maxAttempts && !verification.passed; attempt++) {
            logger.warn(`Step ${step.id} verification failed — feeding error back to LLM`, {
                attempt,
                reason: verification.reason,
            })
            this.metrics?.recordRetry()

            const changedNow = await this.toolExecutor.gitDiffNames()
            const diffHint = changedNow.length === 0
                ? "No file changes detected yet — call write_file to apply the fix."
                : `Files changed so far: ${changedNow.join(", ")}`

            const feedback =
                `# VERIFICATION FAILED (attempt ${attempt}/${maxAttempts - 1})\n` +
                `Reason: ${verification.reason}\n` +
                `${diffHint}\n\n` +
                "Read the target file(s), fix the issue, and use write_file. " +
                "Do not say STEP COMPLETE until the requirement is actually satisfied."

            lastResult = await this.safeBrainRun(brain, feedback, maxAttempts - attempt, step.description)
            verification = await verifier.verify(step, lastResult.text, this.toolExecutor)
        }

        logger.info(`Output: ${lastResult.text.slice(0, 500)}`)

        return {
            stepResult: {
                success: verification.passed,
                output: lastResult.text,
                usage: lastResult.usage,
                toolCalls: lastResult.llmCalls,
            },
            verification,
        }
    }

    /** Simple execute without verification loop (rarely used). */
    async execute(step: Step, contextPrompt = "", verifier?: VerifierAgent): Promise<StepResult> {
        if (verifier) {
            const { stepResult } = await this.executeWithVerification(step, contextPrompt, verifier)
            return stepResult
        }
        this.toolExecutor.resetCommandCache()
        const brain = new AgentBrain({
            systemPrompt: EXECUTOR_PROMPT,
            role: "executor",
            router: this.router,
            toolExecutor: this.toolExecutor,
            stepId: this.stepId,
        })
        const message = contextPrompt
            ? `${contextPrompt}\n\n---\nComplete this step: ${step.description}`
            : `Complete this step: ${step.description}`
        const result = await brain.run(message)
        return { success: true, output: result.text, usage: result.usage, toolCalls: result.llmCalls }
    }

    private async safeBrainRun(
        brain: AgentBrain,
        message: string,
        retriesLeft: number,
        stepDescription?: string,
    ) {
        const maxRateRetries = 3
        const maxErrorRecovery = Number(process.env.EXECUTOR_ERROR_RECOVERY_ATTEMPTS ?? 3)
        let errorRecoveryUsed = 0

        for (let rateAttempt = 0; rateAttempt <= maxRateRetries; rateAttempt++) {
            try {
                const historyLen = brain.getHistory().length
                if (historyLen === 0) {
                    return await brain.run(message)
                }
                return await brain.continue(message)
            } catch (error) {
                const errMsg = error instanceof Error ? error.message : String(error)
                const waitMs = parseRetryAfterMs(error)
                if (
                    isRateLimit(error) &&
                    !isDailyLimit(error) &&
                    !isOutputParseFailed(error) &&
                    waitMs &&
                    waitMs < 5 * 60 * 1000 &&
                    rateAttempt < maxRateRetries
                ) {
                    logger.warn(`Executor rate limited — waiting ${waitMs}ms`, { rateAttempt: rateAttempt + 1 })
                    await sleep(waitMs)
                    continue
                }

                logger.error("Executor brain error: " + errMsg)

                if (errorRecoveryUsed >= maxErrorRecovery || retriesLeft <= 1) {
                    throw new Error(errMsg)
                }

                errorRecoveryUsed++
                this.metrics?.recordRetry()

                const changed = await this.toolExecutor.gitDiffNames()
                const feedback =
                    `# SYSTEM ERROR (outer recovery ${errorRecoveryUsed}/${maxErrorRecovery})\n` +
                    `Error: ${errMsg.slice(0, 500)}\n\n` +
                    (stepDescription ? `Step: ${stepDescription}\n` : "") +
                    (changed.length > 0
                        ? `Files changed so far: ${changed.join(", ")}\n`
                        : "No file changes yet — you must call write_file.\n") +
                    "\nUse view_file on the target, then write_file with valid JSON. " +
                    "Tools: search_code, read_file, view_file, write_file, run_shell, list_dir, print_tree."

                return await brain.continue(feedback)
            }
        }
        throw new Error("Executor rate limit retries exhausted")
    }
}
