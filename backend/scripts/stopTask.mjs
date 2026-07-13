#!/usr/bin/env node
/**
 * Manually stop a Pullwright task (no cancel API yet).
 *
 * Usage:
 *   node scripts/stopTask.mjs <taskId>
 */
import { readFileSync } from "fs"
import { fileURLToPath } from "url"
import path from "path"
import { Redis } from "ioredis"
import { Queue } from "bullmq"
import Docker from "dockerode"

const taskId = process.argv[2]
if (!taskId) {
  console.error("Usage: node scripts/stopTask.mjs <taskId>")
  process.exit(1)
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.join(__dirname, "../.env")
const env = Object.fromEntries(
  readFileSync(envPath, "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=")
      return [l.slice(0, i), l.slice(i + 1)]
    }),
)

const redisUrl = env.REDIS_URL
if (!redisUrl) {
  console.error("REDIS_URL missing in backend/.env")
  process.exit(1)
}

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

const redisOpts = redisOptsFromUrl(redisUrl)
const redis = new Redis(redisOpts)
const queue = new Queue("tasks", { connection: redisOpts })

const docker = new Docker(
  process.env.DOCKER_HOST
    ? { socketPath: process.env.DOCKER_HOST }
    : { socketPath: "/var/run/docker.sock" },
)

async function killContainers() {
  const containers = await docker.listContainers({
    all: true,
    filters: { label: [`taskId=${taskId}`] },
  })
  for (const c of containers) {
    const container = docker.getContainer(c.Id)
    try {
      await container.kill()
      console.log(`Killed container ${c.Id.slice(0, 12)}`)
    } catch {
      /* already stopped */
    }
    try {
      await container.remove({ force: true })
      console.log(`Removed container ${c.Id.slice(0, 12)}`)
    } catch (e) {
      console.warn(`Could not remove container ${c.Id.slice(0, 12)}:`, e.message)
    }
  }
  if (containers.length === 0) console.log("No Docker containers found for this task")
}

const PREFIX = "bull:tasks"

async function forceRemoveJob(job) {
  const id = job.id
  try {
    await job.remove()
    console.log(`Removed job ${id}`)
    return
  } catch {
    /* locked — manual redis cleanup */
  }
  await redis.del(`${PREFIX}:${id}:lock`)
  await redis.lrem(`${PREFIX}:active`, 0, id)
  await redis.zrem(`${PREFIX}:stalled`, id)
  await redis.del(`${PREFIX}:${id}`)
  await redis.del(`${PREFIX}:${id}:logs`)
  console.log(`Force-purged locked job ${id}`)
}

async function removeQueueJobs() {
  const states = ["waiting", "delayed", "active", "paused"]
  let removed = 0
  for (const state of states) {
    const jobs = await queue.getJobs([state], 0, 200)
    for (const job of jobs) {
      if (job.data?.taskId !== taskId) continue
      await forceRemoveJob(job)
      removed++
    }
  }
  if (removed === 0) console.log("No BullMQ jobs found for this task")
}

async function updateRegistry() {
  const key = `task:${taskId}`
  const raw = await redis.get(key)
  if (!raw) {
    console.warn("Task not found in Redis registry")
    return
  }
  const entry = JSON.parse(raw)
  entry.status = "failed"
  entry.updatedAt = new Date().toISOString()
  await redis.set(key, JSON.stringify(entry), "EX", 60 * 60 * 24 * 7)
  console.log(`Registry updated: ${entry.status} (was ${entry.issueTitle ?? taskId})`)
}

async function main() {
  console.log(`Stopping task ${taskId}...\n`)
  await killContainers().catch((e) => console.warn("Docker:", e.message))
  await removeQueueJobs().catch((e) => console.warn("BullMQ:", e.message))
  await updateRegistry()
  await queue.close()
  await redis.quit()
  console.log("\nDone. Registry set to failed.")
  console.log("If another task was queued behind this one, restart the backend:")
  console.log("  lsof -ti:3500 | xargs kill -9; cd backend && node --env-file=.env dist/index.js")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
