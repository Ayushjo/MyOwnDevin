import { EventEmitter } from "events"
import type { Step } from "../Agents/plannerAgent.js"

export type TaskEvent =
  | { type: "step_start"; step: Step }
  | { type: "step_done"; result: { success: boolean; output: string } }
  | { type: "task_complete" }
  | { type: "task_failed"; reason: string }

export class EventBus {
    private emitters = new Map<string, EventEmitter>()

    emit(taskId: string, event: TaskEvent): void {
        this.emitters.get(taskId)?.emit("event", event)
    }

    subscribe(taskId: string): EventEmitter {
        if (!this.emitters.has(taskId)) {
            this.emitters.set(taskId, new EventEmitter())
        }
        return this.emitters.get(taskId)!
    }

    cleanup(taskId: string): void {
        this.emitters.get(taskId)?.removeAllListeners()
        this.emitters.delete(taskId)
    }
}
