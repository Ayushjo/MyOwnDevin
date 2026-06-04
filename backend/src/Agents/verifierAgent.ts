import { AgentBrain } from "../AgentLayer/index.js";
import logger from "../logger.js";
import { VERIFIER_PROMPT } from "../utils/prompts.js";
import type { Step } from "./plannerAgent.js";
type Output={
    passed:boolean,
    reason:string
}
export class VerifierAgent{
    private brain:AgentBrain
    constructor(){
        this.brain = new AgentBrain(VERIFIER_PROMPT)
    }
    async verify(step:Step,output:string):Promise <Output>{
        try {
            const message = `
            Step: ${step.description}
            Executor output: ${output}`
            logger.info("Message: "+message)
            
            const response = await this.brain.run(message)
            const cleaned = response
  .replace(/```json/g, '')
  .replace(/```/g, '')
  .trim()

            const result = JSON.parse(cleaned)
            logger.info("Result: "+JSON.stringify(result))
            return result as Output
        } catch (error) {
            logger.info("Error occured: "+error)
            throw new Error("Error occured: "+error)
        }
    }
}