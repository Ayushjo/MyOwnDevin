import { Redis } from "ioredis";

export type TaskStatus = "pending" | "running" | "completed" | "failed";

export type Task = {
  taskId: string;
  issueUrl: string;
  status: TaskStatus;
  createdAt: number;
  updatedAt: number;
};

export type ListOptions = {
  limit?: number;
  offset?: number;
  status?: TaskStatus;
};

export type ListResult = {
  tasks: Task[];
  total: number;
  limit: number;
  offset: number;
};

export class TaskRegistry {
  private redis: Redis;
  private TTL = 60 * 60 * 24 * 7; // 7 days

  constructor() {
    this.redis = new Redis(process.env.REDIS_URL ?? "redis://127.0.0.1:6379", {
      maxRetriesPerRequest: null,
    });
  }

  /**
   * Save a task to the registry
   */
  async save(task: Task): Promise<void> {
    const taskKey = `task:${task.taskId}`;
    await this.redis.set(taskKey, JSON.stringify(task), "EX", this.TTL);

    // Add to sorted set index by creation time (score = createdAt)
    await this.redis.zadd("tasks:index", task.createdAt, task.taskId);

    // Add to status-specific sorted sets for filtering
    await this.redis.zadd(`tasks:status:${task.status}`, task.createdAt, task.taskId);
  }

  /**
   * Update a task's status
   */
  async updateStatus(taskId: string, newStatus: TaskStatus): Promise<void> {
    const taskKey = `task:${taskId}`;
    const taskData = await this.redis.get(taskKey);

    if (!taskData) {
      throw new Error(`Task ${taskId} not found`);
    }

    const task = JSON.parse(taskData) as Task;
    const oldStatus = task.status;

    // Update task
    task.status = newStatus;
    task.updatedAt = Date.now();

    await this.redis.set(taskKey, JSON.stringify(task), "EX", this.TTL);

    // Remove from old status set and add to new status set
    await this.redis.zrem(`tasks:status:${oldStatus}`, taskId);
    await this.redis.zadd(`tasks:status:${newStatus}`, task.createdAt, taskId);
  }

  /**
   * Retrieve a task by ID
   */
  async get(taskId: string): Promise<Task | null> {
    const taskKey = `task:${taskId}`;
    const data = await this.redis.get(taskKey);
    return data ? (JSON.parse(data) as Task) : null;
  }

  /**
   * Count total tasks, optionally filtered by status
   */
  async count(status?: TaskStatus): Promise<number> {
    if (status) {
      const count = await this.redis.zcard(`tasks:status:${status}`);
      return count;
    } else {
      const count = await this.redis.zcard("tasks:index");
      return count;
    }
  }

  /**
   * List tasks with pagination and optional status filtering
   */
  async list(opts?: ListOptions): Promise<ListResult> {
    const limit = Math.min(opts?.limit ?? 50, 100);
    const offset = Math.max(opts?.offset ?? 0, 0);
    const status = opts?.status;

    // Determine which sorted set to query
    const indexKey = status ? `tasks:status:${status}` : "tasks:index";

    // Get total count
    const total = await this.count(status);

    // Get task IDs from the sorted set in reverse order (newest first)
    const taskIds = await this.redis.zrevrange(indexKey, offset, offset + limit - 1);

    // Fetch full task data for each ID
    const tasks: Task[] = [];
    for (const taskId of taskIds) {
      const task = await this.get(taskId);
      if (task) {
        tasks.push(task);
      }
    }

    return {
      tasks,
      total,
      limit,
      offset,
    };
  }

  /**
   * Delete a task
   */
  async delete(taskId: string): Promise<void> {
    const task = await this.get(taskId);
    if (!task) return;

    const taskKey = `task:${taskId}`;
    await this.redis.del(taskKey);
    await this.redis.zrem("tasks:index", taskId);
    await this.redis.zrem(`tasks:status:${task.status}`, taskId);
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    await this.redis.quit();
  }
}
