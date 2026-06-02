import logger from "../logger.js";
import { SandboxManager } from "../sandbox/index.js";

type ToolResult = {
    success: boolean;
    output: string;
    error? : string
}
type GitOpsInput =
 
   { op: 'commit';   message: string }

  | { op: 'checkout'; branch: string }
const dockerWorker = new SandboxManager();
async function run_shell(containerId:string,command:string,timeoutMs:number):Promise<ToolResult>{
    try {
        const result = await dockerWorker.exec(containerId,command)
        if(result?.exitCode!=0){
            logger.error(`Error running shell: ${result?.stderr}`);
            return {success:false,output:"",error:`Error running shell: ${result?.stderr}`}
        }
        else{
            logger.info(`Shell executed successfully`);
            return {success:true,output:result?.stdout,error:result?.stderr}
        }
        
    } catch (error) {
        logger.error(`Error running shell: ${error}`);
        return {success:false,output:"",error:`Error running shell: ${error}`}
    }


}
async function read_file(containerId:string,filePath:string):Promise<ToolResult>{
    try {
        const result = await dockerWorker.exec(containerId,`cat ${filePath}`)
        if(result?.exitCode!=0){
            logger.error(`Error reading file: ${result?.stderr}`);
            return {success:false,output:"",error:`Error reading file: ${result?.stderr}`}
        }
        else{
            logger.info(`File read successfully`);
            return {success:true,output:result?.stdout,error:result?.stderr}
        }
        
    } catch (error) {
        logger.error(`Error reading file: ${error}`);
        return {success:false,output:"",error:`Error reading file: ${error}`}
        
    }
}

async function write_file(containerId:string,filePath:string,content:string):Promise<ToolResult>{
    try {
        const result = await dockerWorker.exec(containerId,`echo "${content}" > ${filePath}`)
        if(result?.exitCode!=0){
            logger.error(`Error writing file: ${result?.stderr}`);
            return {success:false,output:"",error:`Error writing file: ${result?.stderr}`}
        }
        else{
            logger.info(`File written successfully`);
            return {success:true,output:result?.stdout,error:result?.stderr}
        }
    }
    catch(error){
        logger.error(`Error writing file: ${error}`);
        return {success:false,output:"",error:`Error writing file: ${error}`}
    }
}

async function git_ops(containerId:string,command:GitOpsInput):Promise<ToolResult>{
    try {

        switch(command.op){
            
            
            case 'commit':
                const commitResult = await run_shell(containerId,`git add -A && git commit -m "${command.message}"`,10000)
                return commitResult
            
            
                
            
            case 'checkout':
                const checkoutResult = await run_shell(containerId,`git checkout ${command.op=="checkout" ? command.branch : ""}`,10000)
                return checkoutResult
            }
            
        }
        catch(error){
            logger.error(`Error performing git operations: ${error}`);
            return {success:false,output:"",error:`Error performing git operations: ${error}`}
        }
    }
