import { Worker,Queue } from "bullmq";
import { AgentOrchestrator } from "../Orchestrator/index.js";
import { EventBus } from "../events/eventBus.js";
import { CheckpointStore } from "../store/checkpointStore.js";

const redisUrl = new URL(process.env.REDIS_URL ?? "redis://127.0.0.1:6379");

export const redisConnection = {
    host: redisUrl.hostname,
    port: Number(redisUrl.port) || 6379,
    ...(redisUrl.password && { password: decodeURIComponent(redisUrl.password) }),
    maxRetriesPerRequest: null as null,
}


export const taskQueue = new Queue("tasks",{connection:redisConnection})

export const startWorker = (eventBus:EventBus,checkpointStore:CheckpointStore)=>{
    
    const orchestrator = new AgentOrchestrator(eventBus,checkpointStore)
    const worker = new Worker("tasks",async (job)=>{
        const {taskId,issueUrl} = job.data
        await orchestrator.run(taskId,issueUrl)
    },{connection:redisConnection})

    worker.on("failed", (job, err) => {
        const taskId = job?.data?.taskId ?? "unknown"
        console.error(`Job failed [taskId=${taskId}]:`, err.message)
    })

    return worker
}