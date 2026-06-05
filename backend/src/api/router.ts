// router.ts
import { Router } from "express";
import logger from "../logger.js";
import { v4 as uuidv4 } from "uuid";
import { taskQueue } from "../BullMQ/worker.js";
import { EventBus } from "../events/eventBus.js";

export const createRouter = (eventBus: EventBus) => {
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

  return router;
}