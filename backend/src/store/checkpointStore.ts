import type { Step } from "../Agents/plannerAgent.js"

export type CheckpointState = {
    steps: Step[]
    completedStepIds: number[]
    taskPath: string
    issueUrl: string
    issueTitle: string
    issueNumber: number
}

// In-memory store for now. Phase 5 will swap this for Redis.
export class CheckpointStore {
    private store = new Map<string, CheckpointState>()

    async save(taskId: string, state: CheckpointState): Promise<void> {
        this.store.set(taskId, state)
    }

    async load(taskId: string): Promise<CheckpointState | null> {
        return this.store.get(taskId) ?? null
    }

    async delete(taskId: string): Promise<void> {
        this.store.delete(taskId)
    }
}
