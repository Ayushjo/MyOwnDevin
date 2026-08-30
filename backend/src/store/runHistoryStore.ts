import { Redis } from "ioredis";

const redis = new Redis();

const runHistoryStore = {
  async addAttempt(taskId, attempt) {
    await redis.rpush(`attempts:${taskId}`, JSON.stringify(attempt));
  },
  async getAttempts(taskId) {
    const attempts = await redis.lrange(`attempts:${taskId}`, 0, -1);
    return attempts.map((attempt) => JSON.parse(attempt));
  },
};

export default runHistoryStore;