import express from 'express';
import cors from 'cors';
import morgan from "morgan"
import logger from "./logger.js"
import dotenv from "dotenv"
import { EventBus } from './events/eventBus.js';
import { startWorker } from './BullMQ/worker.js';
import { createRouter } from './api/router.js';
import { CheckpointStore } from './store/checkpointStore.js';
dotenv.config();
const app = express();

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
const worker = startWorker(eventBus);
app.use("/api", createRouter(eventBus, checkpointStore));
const PORT = process.env.PORT || 3500
app.listen(PORT,()=>{
    logger.info(`Server is running on port ${PORT}`);
})
