import express from 'express';
import cors from 'cors';
import morgan from "morgan"
import logger from "./logger.js"
import { EventBus } from './events/eventBus.js';
import { startWorker } from './BullMQ/worker.js';
import { createRouter } from './api/router.js';
import { CheckpointStore } from './store/checkpointStore.js';
import { createClient } from "redis";

const app = express();
const redisClient = createClient({
  url: process.env.REDIS_URL || "redis://127.0.0.1:6379"
});
redisClient.on("error", (err) => logger.error("Redis Client Error: " + err));
await redisClient.connect();

app.use(cors({ origin: process.env.FRONTEND_URL ?? "http://localhost:5173" }));
app.use(express.json());

const morganFormat = ":method :url :status :response-time ms";
app.use(
  morgan(morganFormat, {
    stream: {
      write: (message) => {
        const logObject = {
          method: message.split(" ")[0],
          url: message.split(" ")[1],
          status: message.split(" ")[2],
          responseTime: message.split(" ")[3],
        };
        logger.info(JSON.stringify(logObject));
      },
    },
  })
);

const eventBus = new EventBus();
const checkpointStore = new CheckpointStore();
const worker = startWorker(eventBus,checkpointStore);
app.use("/api", createRouter(eventBus, checkpointStore, redisClient));
const PORT = process.env.PORT || 3500
app.listen(PORT,()=>{
    logger.info(`Server is running on port ${PORT}`);
})
