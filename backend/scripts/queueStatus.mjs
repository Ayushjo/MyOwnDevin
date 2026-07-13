#!/usr/bin/env node
import { readFileSync } from "fs"
import { fileURLToPath } from "url"
import path from "path"
import { Redis } from "ioredis"
import { Queue } from "bullmq"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const env = Object.fromEntries(
  readFileSync(path.join(__dirname, "../.env"), "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=")
      return [l.slice(0, i), l.slice(i + 1)]
    }),
)

function redisOptsFromUrl(urlStr) {
  const url = new URL(urlStr)
  const opts = {
    host: url.hostname,
    port: Number(url.port) || 6379,
    maxRetriesPerRequest: null,
  }
  if (url.username) opts.username = decodeURIComponent(url.username)
  if (url.password) opts.password = decodeURIComponent(url.password)
  if (url.protocol === "rediss:") opts.tls = {}
  return opts
}

const redisOpts = redisOptsFromUrl(env.REDIS_URL)
const queue = new Queue("tasks", { connection: redisOpts })
const redis = new Redis(redisOpts)

async function main() {
  for (const state of ["active", "waiting", "delayed", "failed", "completed"]) {
    const jobs = await queue.getJobs([state], 0, 50)
    console.log(`\n=== ${state.toUpperCase()} (${jobs.length}) ===`)
    for (const j of jobs) {
      console.log(`  job ${j.id} taskId=${j.data?.taskId} name=${j.name}`)
    }
  }

  const keys = await redis.keys("task:*")
  const running = []
  for (const k of keys) {
    const raw = await redis.get(k)
    if (!raw) continue
    try {
      const t = JSON.parse(raw)
      if (t.status === "running" || t.status === "queued") {
        running.push({ key: k, ...t })
      }
    } catch {}
  }
  console.log(`\n=== REGISTRY running/queued (${running.length}) ===`)
  for (const t of running) {
    console.log(`  ${t.taskId} status=${t.status} title=${t.issueTitle?.slice(0, 50)}`)
  }

  await queue.close()
  await redis.quit()
}

main().catch(console.error)
