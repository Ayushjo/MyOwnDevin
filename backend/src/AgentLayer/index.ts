import logger from "../logger.js";
import type ToolExecutor from "../tools/index.js";
import { Anthropic } from "@anthropic-ai/sdk";
import type { ContentBlock } from "@anthropic-ai/sdk/resources/messages/messages.js";
export const TOOLS = [
    {
      name: "run_shell",
      description: "Run any shell command inside the sandbox. Use for installing dependencies, running tests, compiling code, or any terminal operation.",
      input_schema: {
        type: "object" as const,
        properties: {
          command: {
            type: "string",
            description: "Shell command to run e.g. 'npm install', 'tsc', 'node index.js'"
          },
          timeoutMs: {
            type: "number",
            description: "How long to wait before killing the command. Defaults to 30000ms"
          }
        },
        required: ["command"]
      }
    },
    {
      name: "read_file",
      description: "Read the contents of a file inside the sandbox. Use to inspect existing code before making changes.",
      input_schema: {
        type: "object" as const,
        properties: {
          filePath: {
            type: "string",
            description: "Absolute path to the file e.g. '/workspace/src/index.ts'"
          },
          timeoutMs: {
            type: "number",
            description: "How long to wait before killing the command. Defaults to 30000ms"
          }
        },
        required: ["filePath"]
      }
    },
    {
      name: "write_file",
      description: "Write content to a file inside the sandbox. Use to create new files or overwrite existing ones with fixes.",
      input_schema: {
        type: "object" as const,
        properties: {
          filePath: {
            type: "string",
            description: "Absolute path to the file e.g. '/workspace/src/index.ts'"
          },
          content: {
            type: "string",
            description: "Full content to write to the file"
          } ,
          timeoutMs: {
            type: "number",
            description: "How long to wait before killing the command. Defaults to 30000ms"
          }
        },
        required: ["filePath", "content"]
      }
    },
    {
      name: "git_commit",
      description: "Stage all changes and commit them. Use after writing files to save progress.",
      input_schema: {
        type: "object" as const,
        properties: {
          message: {
            type: "string",
            description: "Commit message describing what was changed e.g. 'fix: handle null case in getUserById'"
          } ,
          timeoutMs: {
            type: "number",
            description: "How long to wait before killing the command. Defaults to 30000ms"
          }
        },
        required: ["message"]
      }
    },
    {
      name: "git_checkout",
      description: "Create and switch to a new branch inside the sandbox.",
      input_schema: {
        type: "object" as const,
        properties: {
          branch: {
            type: "string",
            description: "Branch name to create and switch to e.g. 'fix/issue-23'"
          } ,
          timeoutMs: {
            type: "number",
            description: "How long to wait before killing the command. Defaults to 30000ms"
          }
        },
        required: ["branch"]
      }
    }
  ]
  type ToolResult = {
    success: boolean;
    output: string;
    error? : string
}
  type Message = {
    role: "user" | "assistant"
    content: string | ContentBlock[]
  }


export class AgentBrain{
    private history:Message[] = [];
    private client: Anthropic;
    constructor(private systemPrompt:string,private toolExecutor?:ToolExecutor){
        this.systemPrompt = systemPrompt;
        if(toolExecutor){
            this.toolExecutor = toolExecutor;
        }
        this,this.client = new Anthropic({
            apiKey:process.env.ANTHROPIC_API_KEY
        })

    }

    async run(userMessage: string): Promise<string> {
        try {
          // push user message — don't reset history
          this.history.push({ role: "user", content: userMessage })
      
          let iterations = 0
          const MAX_ITERATIONS = 20
      
          while (true) {
            if (iterations > MAX_ITERATIONS) {
                logger.error("Agent exceeded max iterations")
              throw new Error("Agent exceeded max iterations")
            }
            iterations++
      
            const response = await this.client.messages.create({
              model: "claude-haiku-4-5-20251001",
              max_tokens: 4096,
              system: this.systemPrompt,
              messages: this.history,
              tools: this.toolExecutor ? TOOLS : []
            } )
      
            // Claude is done — extract text and return
            if (response.stop_reason === "end_turn") {
              const textBlock = response.content.find((b: ContentBlock) => b.type === "text")
              return textBlock ? textBlock.text : ""
            }
      
            // Claude wants to call tools
            if (response.stop_reason === "tool_use") {
              // step 1 — push Claude's full response to history first
              this.history.push({ role: "assistant", content: response.content })
      
              // step 2 — collect all tool results
              const toolResults = []
      
              for (const block of response.content) {
                if (block.type === "tool_use") {
                  logger.info(`Tool called: ${block.name} with args: ${JSON.stringify(block.input)}`)
      
                  // dispatch to the right tool
                  let result: ToolResult
      
                  switch (block.name) {
                    case "run_shell":
                      result = await this.toolExecutor?.run_shell(
                        (block.input as any).command,
                        (block.input as any).timeoutMs
                      ) as any
                      break
                    case "read_file":
                      result = await this.toolExecutor?.read_file((block.input as any).filePath,(block.input as any).timeoutMs) as any
                      break
                    case "write_file":
                      result = await this.toolExecutor?.write_file(
                        (block.input as any).filePath,
                        (block.input as any).content,
                        (block.input as any).timeoutMs
                      ) as any
                      break
                    case "git_commit":
                      result = await this.toolExecutor?.git_commit((block.input as any).message,(block.input as any).timeoutMs) as any
                      break
                    case "git_checkout":
                      result = await this.toolExecutor?.git_checkout((block.input as any).branch,(block.input as any).timeoutMs) as any
                      break
                    default:
                      result = { success: false, output: "", error: `Unknown tool: ${block.name}` }
                  }
      
                  toolResults.push({
                    type: "tool_result" as const,
                    tool_use_id: block.id,  // must match Claude's id
                    content: result.success ? result.output : `ERROR: ${result.error}`
                  })
                }
              }
      
              // step 3 — push all tool results back as one user message
              this.history.push({ role: "user", content: toolResults as any})
      
              // loop continues — Claude sees results and decides next step
            }
          }
      
        } catch (error) {
          logger.error(`Error running agent: ${error}`)
          throw error
        }
      }
    getHistory():Message[]{
        return this.history
    }
    setHistory(history:Message[]):void{
        this.history = history

    }

    
}