import { AgentBrain } from "../AgentLayer/index.js"
import logger from "../logger.js"
import type ToolExecutor from "../tools/index.js"
import { EXECUTOR_PROMPT } from "../utils/prompts.js"
import type { Step } from "./plannerAgent.js"

type StepResult = {
    success:boolean,
    output:string,
}

export class ExecutorAgent{
    private brain:AgentBrain
    constructor(private toolExecutor:ToolExecutor){
        this.brain = new AgentBrain(EXECUTOR_PROMPT,this.toolExecutor)
    }

    async execute(step:Step):Promise<StepResult>{
        try {
            const brain = new AgentBrain(EXECUTOR_PROMPT,this.toolExecutor)
            const message = `Complete this following step: ${step.description}`
            const output = await brain.run(message)
            logger.info("Output: "+output)
            return {success:true,output:output}
        } catch (error) {
            logger.info("Error occured: "+error)
            throw new Error("Error occured: "+error)
        }
    }
}