import { Worker, Queue } from "bullmq";
import { AgentOrchestrator } from "../Orchestrator/index.js";
import type { EventBus } from "../events/eventBus.js";
import { CheckpointStore } from "../store/checkpointStore.js";
import type { TaskRegistry } from "../store/taskRegistry.js";
import { getRedisOptions } from "../config/redis.js";

export const redisConnection = getRedisOptions() as Record<string, unknown>

export const taskQueue = new Queue("tasks", { connection: redisConnection })

export const startWorker = (
    eventBus: EventBus,
    checkpointStore: CheckpointStore,
    taskRegistry: TaskRegistry,
) => {
    taskQueue.clean(0, 1000, 'failed').catch(() => {})
    taskQueue.clean(0, 1000, 'delayed').catch(() => {})

    const orchestrator = new AgentOrchestrator(eventBus, checkpointStore, taskRegistry)
    const worker = new Worker("tasks", async (job) => {
        const { taskId, issueUrl, githubToken } = job.data
        await orchestrator.run(taskId, issueUrl, githubToken)
    }, { connection: redisConnection })

    worker.on("failed", async (job, err) => {
        const taskId = job?.data?.taskId ?? "unknown"
        const reason = err?.message ?? "Job failed"
        console.error(`Job failed [taskId=${taskId}]:`, reason)
        await eventBus.emit(taskId, {
            type: "task_failed",
            reason,
            metrics: { inputTokens: 0, outputTokens: 0, costUsd: 0, shadowCostUsd: 0, llmCalls: 0, toolCalls: 0, retries: 0, durationMs: 0, phases: {} },
        }).catch(() => {})
        await taskRegistry.update(taskId, { status: "failed" }).catch(() => {})
    })

    return worker
}
