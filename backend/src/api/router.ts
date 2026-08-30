// router.ts
import { Router } from "express";
import logger from "../logger.js";
import { v4 as uuidv4 } from "uuid";
import { taskQueue } from "../BullMQ/worker.js";
import { EventBus } from "../events/eventBus.js";
import type { CheckpointStore } from "../store/checkpointStore.js";
import { taskRegistry } from '../store/taskRegistry.js'; // Import taskRegistry

export const createRouter = (eventBus: EventBus, checkpointStore: CheckpointStore) => {
  const router = Router();

  router.post("/task", async (req, res) => {
    try {
      const { issueUrl } = req.body;
      if (!issueUrl) {
        return res.status(400).json({ error: "Issue URL is required" })
      }
      const taskId = uuidv4();
      eventBus.subscribe(taskId)
      await taskQueue.add("tasks", { taskId, issueUrl })
      logger.info("Task created: " + taskId)
      res.status(200).json({ taskId })
    } catch (error) {
      logger.error("Error creating task: " + error)
      res.status(500).json({ error: "Internal server error" })
    }
  })

  router.get("/task/:taskId/stream", (req, res) => {
    const { taskId } = req.params;

    res.setHeader("Content-Type", "text/event-stream")
    res.setHeader("Cache-Control", "no-cache")
    res.setHeader("Connection", "keep-alive")
    res.flushHeaders()

    const emitter = eventBus.subscribe(taskId)

    emitter.on("event", (event) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`)
      if (event.type === "task_complete" || event.type === "task_failed") {
        eventBus.cleanup(taskId)
        res.end()
      }
    })

    req.on("close", () => {
      eventBus.cleanup(taskId)
    })
  })

  router.get("/task/:taskId", async (req, res) => {
    const { taskId } = req.params
    try {
      const state = await checkpointStore.load(taskId)
      if (!state) {
        return res.status(404).json({ error: "Task not found" })
      }
      res.status(200).json(state)
    } catch (error) {
      logger.error("Error fetching task state: " + error)
      res.status(500).json({ error: "Internal server error" })
    }
  })

  // New route for paginated task listing
  router.get("/tasks", async (req, res) => {
    const { limit = 10, offset = 0, status, q } = req.query;
    try {
      const opts = { limit: Number(limit), offset: Number(offset), status, query: q };
      const { tasks, total } = await taskRegistry.list(opts);
      res.status(200).json({ tasks, total, limit, offset });
    } catch (error) {
      logger.error("Error fetching tasks: " + error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Replace inline loop in GET /api/stats with aggregateStats
  router.get("/stats", async (req, res) => {
    try {
      const stats = await taskRegistry.aggregateStats();
      res.status(200).json({ totalCostUsd: stats.totalCostUsd });
    } catch (error) {
      logger.error("Error fetching stats: " + error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  return router;
}