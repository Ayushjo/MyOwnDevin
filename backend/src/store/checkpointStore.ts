import type { Step } from "../Agents/plannerAgent.js"
import {Redis} from "ioredis"
export type CheckpointState = {
    steps: Step[]
    completedStepIds: number[]
    taskPath: string
    issueUrl: string
    issueTitle: string
    issueNumber: number
}

export class CheckpointStore {
    private redis:Redis
    private TTL=60*60*24 // 24 hours
    constructor(){
        this.redis = new Redis(process.env.REDIS_URL ?? "",{
            maxRetriesPerRequest:null,
        })

    }

    async save(taskId: string, state: CheckpointState): Promise<void> {
        await this.redis.set(`checkpoint:${taskId}`,
            JSON.stringify(state),
            "EX",
            this.TTL)
    }
    async load(taskId: string): Promise<CheckpointState | null> {
        const data = await this.redis.get(`checkpoint:${taskId}`)
        return data ? JSON.parse(data) : null
    }
    async delete(taskId: string): Promise<void> {
        await this.redis.del(`checkpoint:${taskId}`)
    }
}
