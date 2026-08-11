import { simpleGit } from "simple-git"
import { GithubApi } from "../GithubApi/index.js"
import { GitManager } from "../GitManager/index.js"
import { SandboxManager } from "../sandbox/index.js"
import ToolExecutor from "../tools/index.js"
import { PlannerAgent } from "../Agents/plannerAgent.js"
import { ExecutorAgent } from "../Agents/executorAgent.js"
import { VerifierAgent } from "../Agents/verifierAgent.js"
import type { EventBus } from "../events/eventBus.js"
import type { CheckpointStore } from "../store/checkpointStore.js"
import type { TaskRegistry } from "../store/taskRegistry.js"
import { MetricsCollector } from "../metrics/metrics.js"
import { getLLMRouter } from "../llm/router.js"
import { getBudgetGuard } from "../llm/budgetGuard.js"
import { BudgetExceededError } from "../llm/errors.js"
import { createEmptyContext, toPrompt, summarizeOutput } from "../context/taskContext.js"
import logger from "../logger.js"
import { rm } from "fs/promises"

/** Recover the pre-agent baseline SHA for checkpoints saved before baselineSha existed. */
async function recoverBaselineSha(taskPath: string): Promise<string | undefined> {
    try {
        const git = simpleGit(taskPath)
        const log = await git.log({ maxCount: 40 })
        const setup = log.all.find((c) => c.message.toLowerCase().includes("sandbox setup"))
        if (setup?.hash) {
            const parent = (await git.raw(["rev-parse", `${setup.hash}^`])).trim()
            if (parent) return parent
        }
        // Fallback: oldest commit on this branch (start of agent work)
        const oldest = log.all[log.all.length - 1]
        return oldest?.hash
    } catch {
        return undefined
    }
}

function parseIssueNumber(issueUrl: string): number {
    const m = issueUrl.match(/\/issues\/(\d+)/)
    return m ? parseInt(m[1]!, 10) : 0
}

export class AgentOrchestrator {
    private gitManager = new GitManager()
    private sandboxManager = new SandboxManager()

    constructor(
        private eventBus: EventBus,
        private checkpointStore: CheckpointStore,
        private taskRegistry: TaskRegistry,
    ) {}

    async run(taskId: string, issueUrl: string, githubToken?: string): Promise<void> {
        const branchName = `devin/task-${taskId}`
        // Prefer the signed-in user's OAuth token; fall back to global GITHUB_TOKEN.
        const githubApi = new GithubApi(githubToken)
        const pushToken = githubApi.token
        let containerId: string | null = null
        let issueTitle = ""
        let issueNumber = parseIssueNumber(issueUrl)
        const checkpoint = await this.checkpointStore.load(taskId)
        const priorMetrics =
            checkpoint?.metrics ??
            (checkpoint ? await this.taskRegistry.getMetrics(taskId).catch(() => null) : null) ??
            undefined
        const metrics = priorMetrics ? MetricsCollector.fromPrior(priorMetrics) : new MetricsCollector()
        if (priorMetrics) {
            logger.info("Restoring cumulative metrics from prior attempt(s)", {
                taskId,
                priorDurationMs: priorMetrics.durationMs,
                priorLlmCalls: priorMetrics.llmCalls,
            })
        }
        const budgetGuard = getBudgetGuard()
        const router = getLLMRouter((usage) => {
            void this.eventBus.emit(taskId, {
                type: "llm_call",
                agent: usage.role,
                model: usage.model,
                provider: usage.provider,
                tokens: { in: usage.inputTokens, out: usage.outputTokens },
                costUsd: usage.costUsd,
                durationMs: usage.durationMs,
            })
            metrics.recordLLMCall({
                model: usage.model,
                provider: usage.provider,
                inputTokens: usage.inputTokens,
                outputTokens: usage.outputTokens,
                costUsd: usage.costUsd,
                durationMs: usage.durationMs,
                ...(usage.role === "planner" ? { phase: "planning" as const }
                    : usage.role === "verifier" ? { phase: "verifying" as const }
                    : usage.role === "executor" ? { phase: "executing" as const }
                    : {}),
            })
            void budgetGuard.snapshot(taskId).then((snap) => {
                metrics.setBudgetFields({
                    budgetUsedUsd: snap.taskSpentUsd,
                    budgetLimitUsd: snap.taskLimitUsd,
                    budgetRemainingUsd: snap.taskRemainingUsd,
                    orgBudgetRemainingUsd: snap.orgRemainingUsd,
                })
            })
        }, {
            taskId,
            budgetGuard,
            metrics: {
                onFailover: () => metrics.recordProviderFailover(),
                onRouterRetry: () => metrics.recordRouterRetry(),
            },
        })

        try {
            let steps = checkpoint?.steps ?? []
            let completedStepIds = checkpoint?.completedStepIds ?? []
            let taskPath = checkpoint?.taskPath ?? ""
            issueTitle = checkpoint?.issueTitle ?? ""
            issueNumber = checkpoint?.issueNumber ?? issueNumber
            let defaultBranch = checkpoint?.defaultBranch ?? "main"
            let context = checkpoint?.context ?? createEmptyContext("", "", branchName)

            if (!checkpoint) {
                logger.info("Starting fresh task", { taskId })

                await this.eventBus.emit(taskId, { type: "phase_start", phase: "planning" })
                metrics.startPhase("planning")

                // Fail fast if Docker isn't available — sandbox is required
                await this.sandboxManager.verifyDocker()

                const issue = await githubApi.getIssue(issueUrl)
                issueTitle = issue.title
                issueNumber = githubApi.parseIssueUrl(issueUrl).issueNumber
                defaultBranch = await githubApi.getDefaultBranch(issueUrl)

                const { owner, repo } = githubApi.parseIssueUrl(issueUrl)
                // Embed the token so the clone's origin remote can push without prompting.
                const repoUrl = pushToken
                    ? `https://x-access-token:${pushToken}@github.com/${owner}/${repo}.git`
                    : `https://github.com/${owner}/${repo}.git`

                await githubApi.createBranch(issueUrl, branchName, defaultBranch)
                taskPath = await this.gitManager.clone(repoUrl, taskId)
                await simpleGit(taskPath).checkoutLocalBranch(branchName)
                const headSha = (await simpleGit(taskPath).revparse(['HEAD'])).trim()

                context = createEmptyContext(issueTitle, issue.body ?? issue.title, branchName)
                context.baselineSha = headSha

                await this.taskRegistry.register({
                    taskId,
                    issueUrl,
                    issueTitle,
                    issueNumber,
                    status: "running",
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                })

                // Repo recon
                metrics.startPhase("recon")
                await this.eventBus.emit(taskId, { type: "phase_start", phase: "recon" })
                const container = await this.sandboxManager.createContainer(taskId)
                containerId = container.id
                const reconExecutor = new ToolExecutor(containerId)

                const treeResult = await reconExecutor.run_shell("find /workspace -maxdepth 3 -not -path '*/.git/*' | head -80")
                const keywords = (issue.body ?? issue.title).match(/\b[a-zA-Z_]{4,}\b/g)?.slice(0, 5) ?? []
                let searchResults = ""
                for (const kw of keywords) {
                    const sr = await reconExecutor.search_code(kw)
                    if (sr.output) searchResults += `\n${kw}: ${sr.output.split("\n").slice(0, 5).join(", ")}`
                }
                context.repoStructure = `${treeResult.output}\n${searchResults}`.slice(0, 3000)
                metrics.endPhase("recon")
                await this.eventBus.emit(taskId, { type: "phase_end", phase: "recon", metrics: { durationMs: 0 } })

                // Pre-install backend deps so executor doesn't waste iterations on npm install
                await reconExecutor.run_shell(
                    "cd /workspace/backend && npm install --prefer-offline 2>&1 | tail -3",
                    180_000,
                )
                // Pin baseline tag at pre-agent HEAD before sandbox commit moves HEAD forward.
                await reconExecutor.run_shell(`cd /workspace && git tag -f devin-baseline ${headSha}`, 15_000)
                await reconExecutor.run_shell(
                    "cd /workspace && git add -A && git -c user.email=agent@devin.local -c user.name='Devin Agent' commit -m 'chore: sandbox setup' --allow-empty 2>/dev/null || git add -A && git commit -m 'chore: sandbox setup' --allow-empty",
                    30_000,
                )

                const redisHint = await reconExecutor.search_code("ioredis|Redis", "/workspace/backend")
                if (redisHint.output) {
                    context.repoStructure += `\n\n# Redis-related files\n${redisHint.output.slice(0, 800)}`
                }

                const keyFiles = [
                    "/workspace/backend/src/store/checkpointStore.ts",
                    "/workspace/backend/src/api/router.ts",
                ]
                for (const fp of keyFiles) {
                    const snippet = await reconExecutor.view_file(fp, 1, 45)
                    if (snippet.output && !snippet.output.includes("No such file")) {
                        context.repoStructure += `\n\n# ${fp}\n${snippet.output.slice(0, 1200)}`
                    }
                }

                const planner = new PlannerAgent(router, metrics, this.eventBus, taskId)
                steps = await planner.plan(issue.body ?? issue.title, context.repoStructure)
                context.planSummary = steps.map((s) => `${s.id}. ${s.description}`).join("\n")

                metrics.endPhase("planning")
                await this.eventBus.emit(taskId, { type: "phase_end", phase: "planning", metrics: { durationMs: 0 } })

                await this.checkpointStore.save(taskId, {
                    steps, completedStepIds, taskPath, issueUrl,
                    issueTitle, issueNumber, defaultBranch, context,
                })
            } else {
                logger.info("Resuming task from checkpoint", { taskId, completedStepIds })
                await this.taskRegistry.update(taskId, { status: "running" })
                if (priorMetrics) {
                    await this.eventBus.emit(taskId, { type: "metrics_update", metrics: priorMetrics })
                }
                // Backfill baselineSha for checkpoints created before it was persisted
                if (!context.baselineSha && taskPath) {
                    const recovered = await recoverBaselineSha(taskPath)
                    if (recovered) {
                        context.baselineSha = recovered
                        logger.info("Recovered baselineSha for resumed task", { taskId, recovered })
                        await this.checkpointStore.save(taskId, {
                            steps, completedStepIds, taskPath, issueUrl,
                            issueTitle, issueNumber, defaultBranch, context,
                        })
                    }
                }
            }

            if (!containerId) {
                const container = await this.sandboxManager.createContainer(taskId)
                containerId = container.id
            }

            const toolExecutor = new ToolExecutor(containerId)
            if (context.baselineSha) {
                toolExecutor.setBaseline(context.baselineSha)
            }
            const verifier = new VerifierAgent(router, metrics)

            for (const step of steps) {
                if (completedStepIds.includes(step.id)) {
                    logger.info(`Skipping completed step ${step.id}`, { taskId })
                    continue
                }

                await budgetGuard.resetCallCounters(taskId)
                await budgetGuard.assertTaskCanContinue(taskId)

                metrics.startPhase("executing")
                await this.eventBus.emit(taskId, { type: "phase_start", phase: "executing" })
                await this.eventBus.emit(taskId, { type: "step_start", step })
                logger.info(`Step ${step.id} started: ${step.description}`, { taskId })

                // Skip execution when the repo already satisfies this step (common on retry).
                const alreadyDone = await verifier.isAlreadySatisfied(step, toolExecutor)
                if (alreadyDone.passed) {
                    logger.info(`Step ${step.id} preflight: already satisfied`, { reason: alreadyDone.reason, taskId })
                    const filesChanged = await toolExecutor.gitDiffNames()
                    context.completedSteps.push({
                        stepId: step.id,
                        description: step.description,
                        filesChanged,
                        outputSummary: alreadyDone.reason,
                    })
                    context.filesModified = [...new Set([...context.filesModified, ...filesChanged])]
                    completedStepIds.push(step.id)
                    await this.checkpointStore.save(taskId, {
                        steps, completedStepIds, taskPath, issueUrl,
                        issueTitle, issueNumber, defaultBranch, context,
                    })
                    await this.eventBus.emit(taskId, {
                        type: "step_done",
                        result: { success: true, output: alreadyDone.reason },
                        verification: { passed: true, reason: alreadyDone.reason, layer: "deterministic", signals: ["preflight_skip"] },
                    })
                    logger.info(`Step ${step.id} complete (preflight skip)`, { taskId })
                    continue
                }

                const contextPrompt = toPrompt(context)
                const executor = new ExecutorAgent(
                    toolExecutor, router, this.eventBus, taskId, metrics, step.id
                )

                const { stepResult, verification } = await executor.executeWithVerification(
                    step, contextPrompt, verifier,
                )

                metrics.endPhase("executing")
                await this.eventBus.emit(taskId, { type: "phase_end", phase: "executing", metrics: { durationMs: 0 } })

                if (!verification.passed) {
                    const reason = `Step ${step.id} failed after ${Number(process.env.MAX_STEP_VERIFY_ATTEMPTS ?? 5)} attempts: ${verification.reason}`
                    logger.error(reason, { taskId })
                    const snapshot = metrics.snapshot()
                    await this.taskRegistry.saveMetrics(taskId, snapshot)
                    await this.checkpointStore.save(taskId, {
                        steps, completedStepIds, taskPath, issueUrl,
                        issueTitle, issueNumber, defaultBranch, context,
                        metrics: snapshot,
                    })
                    await this.taskRegistry.update(taskId, { status: "failed" })
                    await this.eventBus.emit(taskId, { type: "task_failed", reason, metrics: snapshot })
                    return
                }

                const filesChanged = await toolExecutor.gitDiffNames()
                context.completedSteps.push({
                    stepId: step.id,
                    description: step.description,
                    filesChanged,
                    outputSummary: summarizeOutput(stepResult.output),
                })
                context.filesModified = [...new Set([...context.filesModified, ...filesChanged])]

                completedStepIds.push(step.id)
                await this.checkpointStore.save(taskId, {
                    steps, completedStepIds, taskPath, issueUrl,
                    issueTitle, issueNumber, defaultBranch, context,
                })
                await this.eventBus.emit(taskId, {
                    type: "step_done",
                    result: stepResult,
                    verification,
                })
                await this.eventBus.emit(taskId, { type: "metrics_update", metrics: metrics.snapshot() })
                logger.info(`Step ${step.id} complete`, { taskId })
            }

            metrics.startPhase("pushing")
            await this.eventBus.emit(taskId, { type: "phase_start", phase: "pushing" })

            // Agent changes live on disk (bind-mounted sandbox) but are often never git-committed.
            const commitMsg = `fix: ${issueTitle}`
            const { committed, files: committedFiles } = await this.gitManager.commitAll(taskPath, commitMsg)
            logger.info("Pre-push git commit", { taskId, committed, committedFiles })

            const changedVsBase = await this.gitManager.changedFilesVs(taskPath, defaultBranch)
            logger.info("Branch diff vs base", { taskId, base: defaultBranch, changedVsBase })

            if (changedVsBase.length === 0) {
                throw new Error(
                    `No file changes on branch vs ${defaultBranch} — PR would be empty. ` +
                    `Committed this run: ${committed ? committedFiles.join(", ") : "(none)"}`,
                )
            }

            await this.gitManager.push(taskPath, branchName)
            metrics.endPhase("pushing")
            await this.eventBus.emit(taskId, { type: "phase_end", phase: "pushing", metrics: { durationMs: 0 } })

            metrics.startPhase("pr")
            await this.eventBus.emit(taskId, { type: "phase_start", phase: "pr" })
            const data = await githubApi.openPR(
                issueUrl, branchName, defaultBranch,
                `fix: ${issueTitle}`,
                `Automated fix by Devin agent.\n\nCloses #${issueNumber}`
            )
            metrics.endPhase("pr")
            await this.eventBus.emit(taskId, { type: "phase_end", phase: "pr", metrics: { durationMs: 0 } })

            await this.sandboxManager.cleanup(containerId)
            containerId = null
            await this.checkpointStore.delete(taskId)
            await rm(taskPath, { recursive: true, force: true }).catch(() => {})

            const snapshot = metrics.snapshot()
            await this.taskRegistry.saveMetrics(taskId, snapshot)
            await this.taskRegistry.update(taskId, { status: "done", prUrl: data.html_url })
            await this.eventBus.emit(taskId, { type: "task_complete", prUrl: data.html_url, metrics: snapshot })
            logger.info("Task complete", { taskId })

        } catch (error) {
            const reason = error instanceof BudgetExceededError
                ? `Budget exceeded (${error.scope}): ${error.message}`
                : error instanceof Error ? error.message : String(error)
            logger.error(`Task failed: ${reason}`, { taskId })
            const snapshot = metrics.snapshot()
            await this.taskRegistry.saveMetrics(taskId, snapshot).catch(() => {})
            if (checkpoint) {
                await this.checkpointStore.save(taskId, {
                    steps: checkpoint.steps,
                    completedStepIds: checkpoint.completedStepIds,
                    taskPath: checkpoint.taskPath,
                    issueUrl: checkpoint.issueUrl,
                    issueTitle: checkpoint.issueTitle,
                    issueNumber: checkpoint.issueNumber,
                    defaultBranch: checkpoint.defaultBranch,
                    context: checkpoint.context,
                    metrics: snapshot,
                }).catch(() => {})
            }
            await this.taskRegistry.registerOrUpdate(taskId, {
                issueUrl,
                issueTitle: issueTitle || `Issue #${issueNumber}`,
                issueNumber,
                status: "failed",
            }).catch(() => {})
            await this.eventBus.emit(taskId, { type: "task_failed", reason, metrics: snapshot })
            // Don't rethrow — prevents BullMQ from crashing the worker process
        } finally {
            if (containerId) {
                await this.sandboxManager.cleanup(containerId).catch(() => {})
            }
        }
    }
}
