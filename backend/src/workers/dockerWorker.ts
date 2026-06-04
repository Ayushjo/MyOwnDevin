import { SandboxManager } from "../sandbox/index.js";
import logger from "../logger.js";
import { GitManager } from "../GitManager/index.js";


export const dockerWorker = new SandboxManager();
const gitManager = new GitManager()
const runTask = async (taskId: string, command: string,repoUrl:string) => {

    try{
        const cloneResult = await gitManager.clone(repoUrl,taskId);
        if(!cloneResult){
            throw new Error(`Error cloning repository`);
        }
        else{
            logger.info(`Repository cloned successfully`);
        }
        const container = await dockerWorker.createContainer(taskId)
        logger.info(`Container created with ID: ${container.id}`);
        
        const result = await dockerWorker.exec(container.id, command,10000);
        
        if (result?.exitCode!=0){
            throw new Error(`Command failed with exit code ${result?.exitCode}`);
        }        
        else{
            logger.info(`Command executed successfully`);
        }

    }
    catch(e){
        logger.error(`Error running task ${taskId}: ${e}`);


    }
}

const killContainer = async (containerId: string) => {
    try{
        await dockerWorker.kill(containerId);
        logger.info(`Container killed with ID: ${containerId}`);
    }
    catch(e){
        logger.error(`Error killing container ${containerId}: ${e}`);
    }
}
