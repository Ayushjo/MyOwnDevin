import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from "morgan"
import logger from "./logger.js"
import { EventBus } from './events/eventBus.js';
import { EventLog } from './events/eventLog.js';
import { startWorker } from './BullMQ/worker.js';
import { createRouter } from './api/router.js';
import { createOAuthRouter } from './api/oauth.js';
import { attachSession } from './api/auth.js';
import { SessionStore } from './auth/session.js';
import { CheckpointStore } from './store/checkpointStore.js';
import { TaskRegistry } from './store/taskRegistry.js';
import { SandboxManager } from './sandbox/index.js';
import { verifyRedisConnection } from './config/redisHealth.js';
import { createDockerClient, resolveDockerSocket } from './config/docker.js';
import { disconnectPrisma, verifyDatabaseConnection } from './db/prisma.js';

const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL ?? "http://localhost:5173", credentials: true }));
app.use(express.json());
app.use(cookieParser());

const morganFormat = ":method :url :status :response-time ms";
app.use(
  morgan(morganFormat, {
    stream: {
      write: (message) => {
        logger.info(message.trim());
      },
    },
  })
);

const eventLog = new EventLog();
const eventBus = new EventBus(eventLog);
const checkpointStore = new CheckpointStore();
const taskRegistry = new TaskRegistry();
const sessionStore = new SessionStore();
const worker = startWorker(eventBus, checkpointStore, taskRegistry);

const PORT = Number(process.env.PORT ?? 3500);
const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:5173";

// Resolve session (cookie or SSE stream token) on every /api request.
app.use("/api", attachSession(sessionStore));
app.use("/api/auth", createOAuthRouter(sessionStore));
app.use("/api", createRouter(eventBus, checkpointStore, taskRegistry, eventLog));

app.get("/", (_req, res) => {
  res.redirect(frontendUrl);
});
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "myowndevin-backend", port: PORT });
});
app.get("/health/docker", async (_req, res) => {
  const socket = resolveDockerSocket()
  try {
    await createDockerClient().ping()
    res.json({ status: "ok", socket: socket ?? "default" })
  } catch (error) {
    res.status(503).json({
      status: "unavailable",
      socket: socket ?? "default",
      error: error instanceof Error ? error.message : String(error),
    })
  }
});
app.get("/health/db", async (_req, res) => {
  const ok = await verifyDatabaseConnection()
  if (!ok) {
    return res.status(process.env.DATABASE_URL ? 503 : 200).json({
      status: process.env.DATABASE_URL ? "unavailable" : "disabled",
      database: process.env.DATABASE_URL ? "configured" : "not_configured",
    })
  }
  res.json({ status: "ok", database: "connected" })
});

void verifyRedisConnection().then((ok) => {
  if (!ok) {
    logger.warn("Server starting without a working Redis connection — task queue will not function")
  }
})

void verifyDatabaseConnection()

void createDockerClient().ping().then(() => {
  logger.info(`Docker connected (${resolveDockerSocket() ?? "default socket"})`)
}).catch((err) => {
  logger.warn(`Docker not reachable at startup — sandbox tasks will fail until Docker Desktop is running: ${err instanceof Error ? err.message : err}`)
})

const server = app.listen(PORT, () => {
    logger.info(`Server is running on port ${PORT}`);
});

// Graceful shutdown
const shutdown = async (signal: string) => {
    logger.info(`${signal} received — shutting down`);
    await worker.close();
    const sandbox = new SandboxManager();
    await sandbox.cleanupOrphans();
    await disconnectPrisma();
    server.close(() => process.exit(0));
};

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

process.on("uncaughtException", (err) => {
  logger.error(`Uncaught exception: ${err.message}`, { stack: err.stack });
});
process.on("unhandledRejection", (reason) => {
  logger.error(`Unhandled rejection: ${reason}`);
});
