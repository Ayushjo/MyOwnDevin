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

export default class ToolExecutor{
    private dockerWorker: SandboxManager;
    constructor(private containerId:string){
        this.dockerWorker = new SandboxManager();
        this.containerId = containerId;
    }
    async run_shell(command:string,timeoutMs:number):Promise<ToolResult>{
        try {
            const result = await this.dockerWorker.exec(this.containerId,command,timeoutMs)
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
    async read_file(filePath:string,timeoutMs:number):Promise<ToolResult>{
        try {
            const result = await this.dockerWorker.exec(this.containerId,`cat ${filePath}`,timeoutMs)
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
    
    async write_file(filePath:string,content:string,timeoutMs:number):Promise<ToolResult>{
        try {
            const result = await this.dockerWorker.exec(
                this.containerId,
                `cat > ${filePath} << 'EOF'\n${content}\nEOF`
              ,timeoutMs)
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
    
    async git_commit(message:string,timeoutMs:number):Promise<ToolResult>{
        try {
            const result = await this.run_shell(`git add -A && git commit -m "${message}"`,timeoutMs)
            return result
        }
        catch(error){
            logger.error(`Error committing: ${error}`);
            return {success:false,output:"",error:`Error committing: ${error}`}
        }
    }
    async git_checkout(branch:string,timeoutMs:number):Promise<ToolResult>{
        try {
            const result = await this.run_shell(`git checkout ${branch}`,timeoutMs)
            return result
        }
        catch(error){
            logger.error(`Error checking out: ${error}`);
            return {success:false,output:"",error:`Error checking out: ${error}`}
        }
    }
    
    

}
