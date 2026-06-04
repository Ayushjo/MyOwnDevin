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
import logger from "../logger.js"

export class AgentOrchestrator {
    private githubApi = new GithubApi()
    private gitManager = new GitManager()
    private sandboxManager = new SandboxManager()

    constructor(
        private eventBus: EventBus,
        private checkpointStore: CheckpointStore
    ) {
        
    }

    async run(taskId: string, issueUrl: string): Promise<void> {
        const branchName = `devin/task-${taskId}`
        let containerId: string | null = null

        try {
            // --- resolve state: fresh task or checkpoint resume ---
            const checkpoint = await this.checkpointStore.load(taskId)

            let steps = checkpoint?.steps ?? []
            let completedStepIds = checkpoint?.completedStepIds ?? []
            let taskPath = checkpoint?.taskPath ?? ""
            let issueTitle = checkpoint?.issueTitle ?? ""
            let issueNumber = checkpoint?.issueNumber ?? 0

            if (!checkpoint) {
                logger.info("Starting fresh task", { taskId })

                // fetch issue
                const issue = await this.githubApi.getIssue(issueUrl)
                issueTitle = issue.title
                issueNumber = this.githubApi.parseIssueUrl(issueUrl).issueNumber

                const { owner, repo } = this.githubApi.parseIssueUrl(issueUrl)
                const repoUrl = `https://github.com/${owner}/${repo}.git`

                // create remote branch then clone
                await this.githubApi.createBranch(issueUrl, branchName)
                taskPath = await this.gitManager.clone(repoUrl, taskId)

                // checkout branch locally so commits go to the right branch
                await simpleGit(taskPath).checkoutLocalBranch(branchName)

                // plan
                const planner = new PlannerAgent()
                steps = await planner.plan(issue.body ?? issue.title)

                // save initial checkpoint
                await this.checkpointStore.save(taskId, {
                    steps,
                    completedStepIds,
                    taskPath,
                    issueUrl,
                    issueTitle,
                    issueNumber,
                })
            } else {
                logger.info("Resuming task from checkpoint", { taskId, completedStepIds })
            }

            // always create a fresh container (old one is gone after a crash)
            const container = await this.sandboxManager.createContainer(taskId)
            containerId = container.id
            const toolExecutor = new ToolExecutor(containerId)
            const verifier = new VerifierAgent()

            // --- step loop ---
            for (const step of steps) {
                if (completedStepIds.includes(step.id)) {
                    logger.info(`Skipping completed step ${step.id}`, { taskId })
                    continue
                }

                this.eventBus.emit(taskId, { type: "step_start", step })
                logger.info(`Step ${step.id} started: ${step.description}`, { taskId })

                const executor = new ExecutorAgent(toolExecutor)

                // first attempt
                let stepResult = await executor.execute(step)
                let verification = await verifier.verify(step, stepResult.output)

                // one retry on failure
                if (!verification.passed) {
                    logger.warn(`Step ${step.id} failed verification, retrying`, {
                        taskId,
                        reason: verification.reason,
                    })
                    stepResult = await executor.execute(step)
                    verification = await verifier.verify(step, stepResult.output)
                }

                if (!verification.passed) {
                    const reason = `Step ${step.id} failed after retry: ${verification.reason}`
                    logger.error(reason, { taskId })
                    this.eventBus.emit(taskId, { type: "task_failed", reason })
                    return
                }

                // step passed — checkpoint and emit
                completedStepIds.push(step.id)
                await this.checkpointStore.save(taskId, {
                    steps,
                    completedStepIds,
                    taskPath,
                    issueUrl,
                    issueTitle,
                    issueNumber,
                })
                this.eventBus.emit(taskId, { type: "step_done", result: stepResult })
                logger.info(`Step ${step.id} complete`, { taskId })
            }

            // --- all steps done: push + PR ---
            await simpleGit(taskPath).push(["--set-upstream", "origin", branchName])
            logger.info("Branch pushed", { taskId, branchName })

            await this.githubApi.openPR(
                issueUrl,
                branchName,
                `fix: ${issueTitle}`,
                `Automated fix by Devin agent.\n\nCloses #${issueNumber}`
            )
            logger.info("PR opened", { taskId })

            // --- cleanup ---
            await this.sandboxManager.cleanup(containerId)
            containerId = null  // tells finally block: already cleaned up
            await this.checkpointStore.delete(taskId)
            this.eventBus.emit(taskId, { type: "task_complete" })
            logger.info("Task complete", { taskId })

        } catch (error) {
            logger.error(`Task failed: ${error}`, { taskId })
            this.eventBus.emit(taskId, { type: "task_failed", reason: String(error) })
            throw error
        } finally {
            // runs on normal return, early return (failed step), AND thrown errors
            if (containerId) {
                await this.sandboxManager.cleanup(containerId).catch(() => {})
            }
        }
    }
}
