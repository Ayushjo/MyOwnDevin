import { AgentBrain } from "../AgentLayer/index.js";
import logger from "../logger.js";
import { PLANNER_PROMPT } from "../utils/prompts.js";

export type Step = {
    id: number;
    description: string;
}

export class PlannerAgent{
    private brain:AgentBrain
    constructor(){
        this.brain = new AgentBrain(PLANNER_PROMPT)
    }
    async plan(issueBody:string):Promise <Step[]>{
        try {
            const reponse = await this.brain.run(issueBody)
            const steps = JSON.parse(reponse) 
            logger.info("Steps: "+JSON.stringify(steps))
            return steps
        } catch (error) {
            logger.info("Error occured: "+error)
            throw new Error("Error occured: "+error)
            
        }

    }
}