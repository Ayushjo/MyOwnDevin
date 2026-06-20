import OpenAI from "openai"
import type { ChatParams, LLMProvider, LLMResponse, ProviderName } from "../types.js"
import { computeProviderCost } from "../pricing.js"
import { loadLLMConfig } from "../config.js"
import { parseToolArguments } from "../parseToolArgs.js"
import { toOpenAIMessages } from "../openaiMessages.js"
import logger from "../../logger.js"

export class GroqProvider implements LLMProvider {
  readonly name: ProviderName = "groq"
  private client: OpenAI

  constructor(readonly model: string) {
    this.client = new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: "https://api.groq.com/openai/v1",
    })
  }

  async chat(params: ChatParams): Promise<LLMResponse> {
    const messages = toOpenAIMessages(params)
    const tools = params.tools?.map((t) => ({
      type: "function" as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.input_schema,
      },
    }))

    const start = Date.now()
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages,
      max_tokens: params.maxTokens ?? 4096,
      temperature: params.temperature ?? 0,
      ...(tools && tools.length > 0 ? { tools, tool_choice: "auto" as const } : {}),
    })

    const choice = response.choices[0]
    if (!choice) throw new Error("Groq returned no choices")

    const inputTokens = response.usage?.prompt_tokens ?? 0
    const outputTokens = response.usage?.completion_tokens ?? 0
    const isFreeTier = loadLLMConfig().isFreeTier

    const toolCalls = (choice.message.tool_calls ?? [])
      .filter((tc): tc is OpenAI.Chat.ChatCompletionMessageFunctionToolCall => tc.type === "function")
      .map((tc) => ({
        id: tc.id,
        name: tc.function.name,
        input: parseToolArguments(tc.function.arguments, tc.function.name),
      }))

    const hasTools = toolCalls.length > 0

    return {
      text: choice.message.content ?? "",
      toolCalls,
      usage: {
        inputTokens,
        outputTokens,
        costUsd: computeProviderCost(this.name, this.model, inputTokens, outputTokens, isFreeTier),
      },
      stopReason: hasTools ? "tool_use" : "end_turn",
      model: this.model,
      provider: this.name,
    }
  }
}

export function createGroqProvider(model: string): GroqProvider | null {
  if (!process.env.GROQ_API_KEY) {
    logger.warn("GROQ_API_KEY not set — Groq provider unavailable")
    return null
  }
  return new GroqProvider(model)
}
