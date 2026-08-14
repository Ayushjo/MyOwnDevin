import { Redis } from "ioredis"
import type { TaskEvent } from "./types.js"
import { createRedisClient } from "../config/redis.js"

export class EventLog {
  private redis: Redis
  private TTL = 60 * 60 * 24 // 24 hours

  constructor() {
    this.redis = createRedisClient()
  }

  private key(taskId: string) {
    return `events:${taskId}`
  }

  async append(taskId: string, event: TaskEvent): Promise<number> {
    const len = await this.redis.rpush(this.key(taskId), JSON.stringify(event))
    await this.redis.expire(this.key(taskId), this.TTL)
    return len - 1 // 0-indexed position
  }

  async range(taskId: string, from = 0): Promise<TaskEvent[]> {
    const items = await this.redis.lrange(this.key(taskId), from, -1)
    return items.map((item) => JSON.parse(item) as TaskEvent)
  }

  async length(taskId: string): Promise<number> {
    return this.redis.llen(this.key(taskId))
  }

  async clear(taskId: string): Promise<void> {
    await this.redis.del(this.key(taskId))
  }
}
