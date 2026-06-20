export type AgentRole = "planner" | "executor" | "verifier" | "replan"

export type Usage = {
  inputTokens: number
  outputTokens: number
  costUsd: number
}

export type LLMToolCall = {
  id: string
  name: string
  input: Record<string, unknown>
}

export type LLMTool = {
  name: string
  description: string
  input_schema: {
    type: "object"
    properties: Record<string, unknown>
    required?: string[]
  }
}

export type LLMMessageContent =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: string }

export type LLMMessage = {
  role: "user" | "assistant"
  content: string | LLMMessageContent[]
}

export type ChatParams = {
  system: string
  messages: LLMMessage[]
  tools?: LLMTool[]
  maxTokens?: number
  temperature?: number
}

export type LLMResponse = {
  text: string
  toolCalls: LLMToolCall[]
  usage: Usage
  stopReason: "end_turn" | "tool_use" | "max_tokens" | "error"
  model: string
  provider: string
}

export type ModelPricing = {
  inputPer1M: number
  outputPer1M: number
}

export type ProviderName = "gemini" | "groq" | "anthropic" | "openrouter" | "openai"

export interface LLMProvider {
  readonly name: ProviderName
  readonly model: string
  chat(params: ChatParams): Promise<LLMResponse>
}

export type UsageCallback = (usage: Usage & {
  role: AgentRole
  model: string
  provider: string
  durationMs: number
}) => void

export type ToolEventCallback = (event:
  | { type: "tool_call"; tool: string; args: Record<string, unknown> }
  | { type: "tool_result"; tool: string; success: boolean; output: string; durationMs: number }
) => void

export type ThoughtCallback = (event: {
  status: "thinking" | "reasoning"
  agent: AgentRole
  text: string
  model?: string
  provider?: string
}) => void

export type RunResult = {
  text: string
  usage: Usage
  llmCalls: number
}
