import { Router } from "express";
import logger from "../logger.js";
import { v4 as uuidv4 } from "uuid";
import { taskQueue } from "../BullMQ/worker.js";
import type { EventBus } from "../events/eventBus.js";
import type { CheckpointStore } from "../store/checkpointStore.js";
import type { TaskRegistry } from "../store/taskRegistry.js";
import type { EventLog } from "../events/eventLog.js";
import { requireAuth } from "./auth.js";
import { getBudgetGuard } from "../llm/budgetGuard.js";

function parseIssueNumber(issueUrl: string): number {
  const m = issueUrl.match(/\/issues\/(\d+)/)
  return m ? parseInt(m[1]!, 10) : 0
}

export const createRouter = (
  eventBus: EventBus,
  checkpointStore: CheckpointStore,
  taskRegistry: TaskRegistry,
  eventLog: EventLog,
) => {
  const router = Router();
  router.use(requireAuth);

  router.post("/task", async (req, res) => {
    try {
      const { issueUrl } = req.body;
      if (!issueUrl) {
        return res.status(400).json({ error: "Issue URL is required" })
      }
      const taskId = uuidv4();
      const issueNumber = parseIssueNumber(issueUrl)
      // Thread the signed-in user's GitHub token so branches/PRs are pushed
      // under their identity (fixes the shared-token 403).
      const githubToken = req.session?.accessToken
      const githubLogin = req.session?.login

      eventBus.subscribe(taskId)
      const now = new Date().toISOString()
      await taskRegistry.register({
        taskId,
        issueUrl,
        issueTitle: `Issue #${issueNumber}`,
        issueNumber,
        status: "queued",
        createdAt: now,
        updatedAt: now,
      })
      await taskQueue.add("tasks", { taskId, issueUrl, githubToken, githubLogin })
      logger.info("Task created: " + taskId + (githubLogin ? ` (as ${githubLogin})` : ""))
      res.status(200).json({
        taskId,
        issueUrl,
        issueNumber,
        status: "queued",
        createdAt: new Date().toISOString(),
      })
    } catch (error) {
      logger.error("Error creating task: " + error)
      res.status(500).json({ error: "Internal server error" })
    }
  })

  router.get("/task/:taskId/stream", async (req, res) => {
    const { taskId } = req.params;

    res.setHeader("Content-Type", "text/event-stream")
    res.setHeader("Cache-Control", "no-cache")
    res.setHeader("Connection", "keep-alive")
    res.flushHeaders()

    // Replay stored events first
    const stored = await eventLog.range(taskId, 0)
    for (const event of stored) {
      res.write(`data: ${JSON.stringify(event)}\n\n`)
    }

    const emitter = eventBus.subscribe(taskId)

    const onEvent = (event: unknown) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`)
      const ev = event as { type: string }
      if (ev.type === "task_complete" || ev.type === "task_failed") {
        eventBus.cleanup(taskId)
        res.end()
      }
    }

    emitter.on("event", onEvent)

    req.on("close", () => {
      emitter.off("event", onEvent)
    })
  })

  router.get("/task/:taskId/events", async (req, res) => {
    const { taskId } = req.params
    const events = await eventLog.range(taskId, 0)
    res.status(200).json(events)
  })

  router.get("/task/:taskId", async (req, res) => {
    const { taskId } = req.params
    try {
      const registry = await taskRegistry.get(taskId)
      const state = await checkpointStore.load(taskId)
      if (!state && !registry) {
        return res.status(404).json({ error: "Task not found" })
      }
      if (state && registry) {
        return res.status(200).json({ ...state, status: registry.status, prUrl: registry.prUrl })
      }
      if (state) return res.status(200).json(state)
      return res.status(200).json(registry)
    } catch (error) {
      logger.error("Error fetching task state: " + error)
      res.status(500).json({ error: "Internal server error" })
    }
  })

  router.get("/task/:taskId/metrics", async (req, res) => {
    const { taskId } = req.params
    const metrics = await taskRegistry.getMetrics(taskId)
    if (!metrics) return res.status(404).json({ error: "Metrics not found" })
    res.status(200).json(metrics)
  })

  router.post("/task/:taskId/retry", async (req, res) => {
    const { taskId } = req.params
    const bodyIssueUrl = typeof req.body?.issueUrl === "string" ? req.body.issueUrl : undefined
    const checkpoint = await checkpointStore.load(taskId)
    let registry = await taskRegistry.get(taskId)
    if (!checkpoint && !registry && bodyIssueUrl) {
      await taskRegistry.registerOrUpdate(taskId, {
        issueUrl: bodyIssueUrl,
        issueNumber: parseIssueNumber(bodyIssueUrl),
        status: "failed",
      })
      registry = await taskRegistry.get(taskId)
    }
    if (!checkpoint && !registry) {
      return res.status(404).json({ error: "Task not found" })
    }
    const issueUrl = checkpoint?.issueUrl ?? registry?.issueUrl
    if (!issueUrl) return res.status(400).json({ error: "No issue URL" })

    const githubToken = req.session?.accessToken
    const githubLogin = req.session?.login
    // Clear the stale event log so the previous failure/metrics don't replay
    // into the UI when the client reconnects to the stream.
    await eventLog.clear(taskId)
    eventBus.cleanup(taskId)
    eventBus.subscribe(taskId)
    await getBudgetGuard().resetCallCounters(taskId)
    await taskRegistry.update(taskId, { status: "running" })
    await taskQueue.add("tasks", { taskId, issueUrl, githubToken, githubLogin })
    res.status(200).json({ taskId, status: "requeued" })
  })

  router.get("/tasks", async (_req, res) => {
    const tasks = await taskRegistry.list(50)
    res.status(200).json(tasks)
  })

  router.get("/stats", async (_req, res) => {
    const tasks = await taskRegistry.list(200)
    const stats = { total: tasks.length, running: 0, done: 0, failed: 0, queued: 0 }
    for (const t of tasks) {
      if (t.status === "running") stats.running++
      else if (t.status === "done") stats.done++
      else if (t.status === "failed") stats.failed++
      else if (t.status === "queued") stats.queued++
    }
    res.status(200).json(stats)
  })

  router.get("/budget", async (_req, res) => {
    const guard = getBudgetGuard()
    const snap = await guard.snapshot()
    res.status(200).json(snap)
  })

  return router;
}
