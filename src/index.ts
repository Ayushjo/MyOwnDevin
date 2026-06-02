import express from 'express';
import morgan from "morgan"
import logger from "./logger.js"
import dotenv from "dotenv"
import {SandboxManager} from "./sandbox/index.js"
dotenv.config();
const app = express();

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
const sandboxManager = new SandboxManager();
const PORT = process.env.PORT || 3500
app.listen(PORT,()=>{
    logger.info(`Server is running on port ${PORT}`);
})
app.get("/build",async(req,res)=>{
    try{
        await sandboxManager.buildImage().then(()=>{
            res.send("Image built successfully");
            logger.info("Image built successfully");
        }
    )

    }
    catch(e){
        logger.error(`Error building image: ${e}`);
        res.status(500).send("Error building image");
    }
    
})
