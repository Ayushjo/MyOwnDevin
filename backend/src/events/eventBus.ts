import { EventEmitter } from "events"
import type { TaskEvent } from "./types.js"
import { timestamp } from "./types.js"
import type { EventLog } from "./eventLog.js"

export class EventBus {
  private emitters = new Map<string, EventEmitter>()

  constructor(private eventLog: EventLog) {}

  async emit(taskId: string, event: TaskEvent): Promise<void> {
    const fullEvent = { ...event, timestamp: event.timestamp ?? timestamp() } as TaskEvent
    await this.eventLog.append(taskId, fullEvent)
    this.emitters.get(taskId)?.emit("event", fullEvent)
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

export type { TaskEvent } from "./types.js"
