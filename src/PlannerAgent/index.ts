// import { AgentBrain } from "../AgentLayer/index.js";
// import { PLANNER_PROMPT } from "../utils/prompts.js";

// type Step = {
//     id: number;
//     description: string;
// }

// export class PlannerAgent{
//     private brain:AgentBrain
//     constructor(){
//         this.brain = new AgentBrain(PLANNER_PROMPT)
//     }
//     async plan(issueBody:string):Promise <Step>{
//         const reponse = this.brain.run(issueBody)
//         const steps = JSON.parse(reponse) 
//         return steps

//     }
// }