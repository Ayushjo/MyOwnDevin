import { Redis, type RedisOptions } from "ioredis"

export function getRedisUrl(): string {
  return process.env.REDIS_URL ?? "redis://127.0.0.1:6379"
}

/** Shared ioredis options — family=0 required for Railway private networking (IPv6). */
export function getRedisOptions(overrides: Partial<RedisOptions> = {}): RedisOptions {
  const url = new URL(getRedisUrl())
  const opts: RedisOptions = {
    host: url.hostname,
    port: Number(url.port) || 6379,
    maxRetriesPerRequest: null,
    // Railway *.railway.internal resolves via IPv6; ioredis defaults to IPv4-only.
    family: 0,
    ...overrides,
  }

  if (url.username) {
    opts.username = decodeURIComponent(url.username)
  }
  if (url.password) {
    opts.password = decodeURIComponent(url.password)
  }
  if (url.protocol === "rediss:") {
    opts.tls = {}
  }

  return opts
}

export function createRedisClient(overrides: Partial<RedisOptions> = {}): Redis {
  return new Redis(getRedisOptions(overrides))
}
