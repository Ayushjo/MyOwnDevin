import { createRedisClient } from "./redis.js"
import logger from "../logger.js"

export async function verifyRedisConnection(): Promise<boolean> {
  const redis = createRedisClient({
    maxRetriesPerRequest: 1,
    connectTimeout: 10_000,
    lazyConnect: true,
  })

  try {
    await redis.connect()
    const pong = await redis.ping()
    logger.info(`Redis connected: ${pong}`)
    await redis.quit()
    return true
  } catch (error) {
    logger.error(`Redis connection failed: ${error}`)
    logger.error(
      "On Railway use REDIS_PRIVATE_URL (or REDIS_URL) from the Redis service — not REDIS_PUBLIC_URL.",
    )
    try { await redis.quit() } catch { /* ignore */ }
    return false
  }
}
