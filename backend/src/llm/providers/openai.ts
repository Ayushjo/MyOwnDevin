import OpenAI from "openai"
import type { ChatParams, LLMProvider, LLMResponse, ProviderName } from "../types.js"
import { computeProviderCost } from "../pricing.js"
import { loadLLMConfig } from "../config.js"
import { parseToolArguments } from "../parseToolArgs.js"
import { toOpenAIMessages } from "../openaiMessages.js"
import logger from "../../logger.js"

/** OpenAI only allows tool names matching ^[a-zA-Z0-9_-]+$ */
export function openaiToolName(name: string): string {
  return name.replace(/\./g, "_")
}

export class OpenAIProvider implements LLMProvider {
  readonly name: ProviderName = "openai"
  private client: OpenAI

  constructor(readonly model: string) {
    this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }

  async chat(params: ChatParams): Promise<LLMResponse> {
    const messages = toOpenAIMessages(params, openaiToolName)
    const tools = params.tools?.map((t) => ({
      type: "function" as const,
      function: {
        name: openaiToolName(t.name),
        description: t.description,
        parameters: t.input_schema,
      },
    }))

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages,
      max_tokens: params.maxTokens ?? 4096,
      temperature: params.temperature ?? 0,
      ...(tools && tools.length > 0 ? { tools, tool_choice: "auto" as const } : {}),
    })

    const choice = response.choices[0]
    if (!choice) throw new Error("OpenAI returned no choices")

    const inputTokens = response.usage?.prompt_tokens ?? 0
    const outputTokens = response.usage?.completion_tokens ?? 0
    const isFreeTier = loadLLMConfig().isFreeTier

    const toolCalls = (choice.message.tool_calls ?? [])
      .filter((tc): tc is OpenAI.Chat.ChatCompletionMessageFunctionToolCall => tc.type === "function")
      .map((tc) => ({
        id: tc.id,
        name: openaiToolName(tc.function.name),
        input: parseToolArguments(tc.function.arguments, openaiToolName(tc.function.name)),
      }))

    return {
      text: choice.message.content ?? "",
      toolCalls,
      usage: {
        inputTokens,
        outputTokens,
        costUsd: computeProviderCost(this.name, this.model, inputTokens, outputTokens, isFreeTier),
      },
      stopReason: toolCalls.length > 0 ? "tool_use" : "end_turn",
      model: this.model,
      provider: this.name,
    }
  }
}

export function createOpenAIProvider(model: string): OpenAIProvider | null {
  if (!process.env.OPENAI_API_KEY) {
    logger.warn("OPENAI_API_KEY not set — OpenAI provider unavailable")
    return null
  }
  return new OpenAIProvider(model)
}
