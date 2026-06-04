import {simpleGit} from "simple-git";
import type { SimpleGit } from "simple-git";
import logger from "../logger.js";
import os from "os";
import path from "path";

export class GitManager {
    private git: SimpleGit;
   

    constructor(){
        this.git = simpleGit();
        
    }

    async clone(repoUrl:string,taskId:string){
        try{
            const clonePath = path.join(os.tmpdir(),'tasks',taskId);
            const result = await this.git.clone(repoUrl,clonePath);
            
            return clonePath;
        }
        catch(error){
            logger.error(`Error cloning repository: ${error}`);
            throw error;
        }
    }
    async push(path:string){
        try {
            const repoGit = simpleGit(path);
            const result = await repoGit.push();
            return result;
            
        } catch (error) {
            logger.error(`Error pushing repository: ${error}`);
            return false;
            
        }
    }
}