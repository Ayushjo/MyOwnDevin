import logger from "../logger.js"
import type ToolExecutor from "../tools/index.js"
import { AGENT_TOOLS } from "./tools.js"
import type { ToolInput } from "./tools.js"
import type { LLMRouter } from "../llm/router.js"
import type {
  AgentRole,
  LLMMessage,
  LLMMessageContent,
  RunResult,
  ToolEventCallback,
  ThoughtCallback,
  Usage,
} from "../llm/types.js"
import { isAgentRecoverableError, isOutputParseFailed } from "../llm/errors.js"
import { buildAgentRecoveryPrompt } from "./recovery.js"

type ToolResult = {
  success: boolean
  output: string
  error?: string
}

export type AgentBrainOptions = {
  systemPrompt: string
  role: AgentRole
  router: LLMRouter
  toolExecutor?: ToolExecutor
  onToolEvent?: ToolEventCallback
  onThought?: ThoughtCallback
  stepId?: number | undefined
}

const EXPLORE_TOOLS = new Set([
  "search_code", "list_dir", "view_file", "read_file", "print_tree",
])

const MAX_RECOVERABLE_ERRORS = Number(process.env.AGENT_MAX_RECOVERABLE_ERRORS ?? 3)

function isToolValidationError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const msg = error.message.toLowerCase()
  return msg.includes("tool call validation") || msg.includes("tool_use_failed")
}

const MAX_TOOL_RESULT_CHARS = Number(process.env.MAX_TOOL_RESULT_CHARS ?? 8000)
const HISTORY_WINDOW_ROUNDS = Number(process.env.AGENT_HISTORY_WINDOW ?? 6)

function capToolContent(content: string): string {
  if (content.length <= MAX_TOOL_RESULT_CHARS) return content
  return content.slice(0, MAX_TOOL_RESULT_CHARS) + `\n… [truncated ${content.length - MAX_TOOL_RESULT_CHARS} chars]`
}

/** Map hallucinated / legacy tool names to canonical handlers. */
function canonicalToolName(name: string): string {
  const aliases: Record<string, string> = {
    "repo_browser.search": "search_code",
    "repo_browser_search": "search_code",
    "repo_browser.print_tree": "print_tree",
    "repo_browser_print_tree": "print_tree",
    "repo_browser.list_dir": "list_dir",
    "repo_browser_list_dir": "list_dir",
  }
  return aliases[name] ?? name
}

export class AgentBrain {
  private history: LLMMessage[] = []
  private historyDigest = ""
  private totalUsage: Usage = { inputTokens: 0, outputTokens: 0, costUsd: 0 }
  private llmCalls = 0
  private exploreOnlyRounds = 0
  private toolInvocations = 0
  private wroteFile = false
  private recoverableErrors = 0
  private lastToolAttempted = ""

  constructor(private opts: AgentBrainOptions) {}

  async run(userMessage: string): Promise<RunResult> {
    this.history.push({ role: "user", content: userMessage })
    return this.loop()
  }

  /** Feed verification / system errors back into the same conversation and keep tool-looping. */
  async continue(feedback: string): Promise<RunResult> {
    this.history.push({ role: "user", content: feedback })
    return this.loop()
  }

  private async loop(): Promise<RunResult> {
    const MAX_ITERATIONS = Number(process.env.AGENT_MAX_ITERATIONS ?? 40)
    let iterations = 0

    while (true) {
      if (iterations >= MAX_ITERATIONS) {
        logger.error("Agent exceeded max iterations")
        throw new Error(`Agent exceeded max iterations (${MAX_ITERATIONS})`)
      }
      iterations++

      const { provider, model } = this.opts.router.modelFor(this.opts.role)
      this.opts.onThought?.({
        status: "thinking",
        agent: this.opts.role,
        text: `Thinking (${provider}/${model})…`,
        model,
        provider,
      })

      let response
      try {
        response = await this.opts.router.chat(this.opts.role, {
          system: this.effectiveSystemPrompt(),
          messages: this.history,
          tools: this.opts.toolExecutor ? AGENT_TOOLS : [],
        })
      } catch (error) {
        if (isToolValidationError(error) || isAgentRecoverableError(error) || isOutputParseFailed(error)) {
          this.recoverableErrors++
          logger.warn("Recoverable agent error — feeding structured feedback", {
            attempt: this.recoverableErrors,
            error: error instanceof Error ? error.message.slice(0, 200) : error,
          })
          if (this.recoverableErrors > MAX_RECOVERABLE_ERRORS) {
            throw error
          }
          this.pruneCorruptedHistoryTail()
          this.history.push({
            role: "user",
            content: buildAgentRecoveryPrompt(error, this.recoverableErrors, MAX_RECOVERABLE_ERRORS, {
              ...(this.lastToolAttempted ? { lastTool: this.lastToolAttempted } : {}),
            }),
          })
          continue
        }
        throw error
      }

      this.recoverableErrors = 0

      this.llmCalls++
      this.accumulateUsage(response.usage)

      if (response.text.trim()) {
        this.opts.onThought?.({
          status: "reasoning",
          agent: this.opts.role,
          text: response.text.trim(),
          model: response.model,
          provider: response.provider,
        })
      }

      if (response.stopReason === "end_turn") {
        const text = response.text.trim()
        if (text.includes('"type":"tool_use"') || text.includes("tool_use") || text.includes("<function/")) {
          this.history.push({ role: "assistant", content: text })
          this.history.push({
            role: "user",
            content: "Your last response was invalid tool-call JSON. Use the provided tools (run_shell, read_file, write_file, etc.) — do not invent tool names. If the step requires a code change, use write_file now.",
          })
          continue
        }
        // Reject empty or tool-less completions when tools are available — the model
        // must actually inspect/edit the repo, not hallucinate "STEP COMPLETE".
        if (this.opts.toolExecutor && this.toolInvocations === 0) {
          this.history.push({ role: "assistant", content: text || "(empty response)" })
          this.history.push({
            role: "user",
            content: "You returned without using any tools. This step requires real work in the sandbox. Start by calling read_file or view_file on the target file, then write_file to apply changes. Do not claim the step is done until you have used tools.",
          })
          continue
        }
        if (this.opts.toolExecutor && !this.wroteFile && text.toUpperCase().includes("STEP COMPLETE")) {
          this.history.push({ role: "assistant", content: text })
          this.history.push({
            role: "user",
            content: 'You said STEP COMPLETE but never called write_file. If the step requires a code change, call write_file now. If the file already satisfies the requirement, run `git diff` to confirm and summarize what is already present.',
          })
          continue
        }
        return { text: response.text, usage: { ...this.totalUsage }, llmCalls: this.llmCalls }
      }

      if (response.stopReason === "tool_use" && response.toolCalls.length > 0) {
        const assistantContent: LLMMessageContent[] = []
        if (response.text) assistantContent.push({ type: "text", text: response.text })
        for (const tc of response.toolCalls) {
          assistantContent.push({
            type: "tool_use",
            id: tc.id,
            name: canonicalToolName(tc.name),
            input: tc.input,
          })
        }
        this.history.push({ role: "assistant", content: assistantContent })

        const toolResults: LLMMessageContent[] = []

        let wroteFile = false
        for (const tc of response.toolCalls) {
          this.lastToolAttempted = tc.name
          logger.info(`Tool called: ${tc.name} with args: ${JSON.stringify(tc.input).slice(0, 200)}`)
          this.opts.onToolEvent?.({ type: "tool_call", tool: tc.name, args: tc.input })
          this.toolInvocations++
          if (tc.name === "write_file") wroteFile = true

          const start = Date.now()
          const result = await this.dispatchTool(tc.name, tc.input)
          const durationMs = Date.now() - start

          this.opts.onToolEvent?.({
            type: "tool_result",
            tool: tc.name,
            success: result.success,
            output: result.success ? result.output : (result.error ?? ""),
            durationMs,
          })

          toolResults.push({
            type: "tool_result",
            tool_use_id: tc.id,
            content: capToolContent(result.success ? result.output : `ERROR: ${result.error}`),
          })
        }

        if (wroteFile) {
          this.exploreOnlyRounds = 0
          this.wroteFile = true
        } else if (response.toolCalls.every((tc) => EXPLORE_TOOLS.has(tc.name))) {
          this.exploreOnlyRounds++
          if (this.exploreOnlyRounds >= 3) {
            toolResults.push({
              type: "text",
              text: "You have searched/read enough. The step requires a code change — call write_file now. For Redis health checks, create a new ioredis Redis() instance inline; checkpointStore does not export a redis client.",
            })
            this.exploreOnlyRounds = 0
          }
        }

        this.history.push({ role: "user", content: toolResults })
        this.trimHistory()

        if (response.text.toUpperCase().includes("STEP COMPLETE")) {
          return { text: response.text, usage: { ...this.totalUsage }, llmCalls: this.llmCalls }
        }
      }
    }
  }

  private async dispatchTool(name: string, input: Record<string, unknown>): Promise<ToolResult> {
    const executor = this.opts.toolExecutor
    if (!executor) return { success: false, output: "", error: "No tool executor" }

    const tool = canonicalToolName(name)

    switch (tool) {
      case "run_shell": {
        const args = input as ToolInput["run_shell"]
        return executor.run_shell(args.command, args.timeoutMs)
      }
      case "read_file": {
        const args = input as ToolInput["read_file"]
        return executor.read_file(args.filePath, args.timeoutMs)
      }
      case "write_file": {
        const args = input as ToolInput["write_file"]
        return executor.write_file(args.filePath, args.content, args.timeoutMs)
      }
      case "git_commit": {
        const args = input as ToolInput["git_commit"]
        return executor.git_commit(args.message, args.timeoutMs)
      }
      case "git_checkout": {
        const args = input as ToolInput["git_checkout"]
        return executor.git_checkout(args.branch, args.timeoutMs)
      }
      case "search_code": {
        const args = input as ToolInput["search_code"]
        const maxResults = typeof args.max_results === "number" ? args.max_results : 30
        return executor.search_code(args.query, args.path, maxResults)
      }
      case "print_tree": {
        const args = input as ToolInput["print_tree"]
        return executor.print_tree(args.path, args.depth)
      }
      case "view_file": {
        const args = input as ToolInput["view_file"]
        return executor.view_file(args.filePath, args.startLine, args.endLine)
      }
      case "list_dir": {
        const args = input as ToolInput["list_dir"]
        return executor.list_dir(args.path, args.depth)
      }
      default:
        return {
          success: false,
          output: "",
          error: `Unknown tool: ${name}. Available: ${AGENT_TOOLS.map((t) => t.name).join(", ")}`,
        }
    }
  }

  /** Drop trailing assistant tool_use turns that never got results — fixes cross-provider message errors. */
  private pruneCorruptedHistoryTail() {
    while (this.history.length > 0) {
      const last = this.history[this.history.length - 1]
      if (
        last?.role === "assistant" &&
        Array.isArray(last.content) &&
        last.content.some((c) => c.type === "tool_use")
      ) {
        this.history.pop()
        continue
      }
      if (
        last?.role === "user" &&
        Array.isArray(last.content) &&
        last.content.every((c) => c.type === "tool_result")
      ) {
        this.history.pop()
        continue
      }
      break
    }
  }

  private trimHistory() {
    const maxMessages = HISTORY_WINDOW_ROUNDS * 2
    if (this.history.length <= maxMessages) return

    let start = this.history.length - maxMessages
    while (start < this.history.length) {
      const m = this.history[start]
      if (
        m?.role === "user" &&
        Array.isArray(m.content) &&
        m.content.length > 0 &&
        m.content.every((c) => c.type === "tool_result")
      ) {
        start++
      } else {
        break
      }
    }

    const dropped = this.history.splice(0, start)
    const summary = dropped
      .map((m) => {
        if (typeof m.content === "string") return m.content.slice(0, 120)
        return m.content
          .filter((c) => c.type === "text")
          .map((c) => (c.type === "text" ? c.text : ""))
          .join(" ")
          .slice(0, 120)
      })
      .filter(Boolean)
      .join(" | ")
      .slice(0, 800)

    if (summary) {
      this.historyDigest = `${this.historyDigest}\n${summary}`.slice(-800)
    }
  }

  private effectiveSystemPrompt(): string {
    if (!this.historyDigest) return this.opts.systemPrompt
    return `${this.opts.systemPrompt}\n\n# Prior context (summarized)\n${this.historyDigest}`
  }

  private accumulateUsage(usage: Usage) {
    this.totalUsage.inputTokens += usage.inputTokens
    this.totalUsage.outputTokens += usage.outputTokens
    this.totalUsage.costUsd += usage.costUsd
  }

  getHistory(): LLMMessage[] {
    return this.history
  }

  setHistory(history: LLMMessage[]): void {
    this.history = history
  }

  getUsage(): Usage {
    return { ...this.totalUsage }
  }
}
