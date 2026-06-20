import OpenAI from "openai"
import type { ChatParams, LLMProvider, LLMResponse, ProviderName } from "../types.js"
import { computeCost } from "../pricing.js"
import { parseToolArguments } from "../parseToolArgs.js"
import { toOpenAIMessages } from "../openaiMessages.js"
import logger from "../../logger.js"

export class OpenRouterProvider implements LLMProvider {
  readonly name: ProviderName = "openrouter"
  private client: OpenAI

  constructor(readonly model: string) {
    this.client = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: "https://openrouter.ai/api/v1",
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

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages,
      max_tokens: params.maxTokens ?? 4096,
      temperature: params.temperature ?? 0,
      ...(tools && tools.length > 0
        ? {
            tools,
            tool_choice: "auto" as const,
            // Only route to providers that support function/tool calling
            provider: { require_parameters: true },
          }
        : {}),
    } as OpenAI.Chat.ChatCompletionCreateParamsNonStreaming)

    const choice = response.choices[0]
    if (!choice) throw new Error("OpenRouter returned no choices")

    const inputTokens = response.usage?.prompt_tokens ?? 0
    const outputTokens = response.usage?.completion_tokens ?? 0

    const toolCalls = (choice.message.tool_calls ?? [])
      .filter((tc): tc is OpenAI.Chat.ChatCompletionMessageFunctionToolCall => tc.type === "function")
      .map((tc) => ({
        id: tc.id,
        name: tc.function.name,
        input: parseToolArguments(tc.function.arguments, tc.function.name),
      }))

    return {
      text: choice.message.content ?? "",
      toolCalls,
      usage: {
        inputTokens,
        outputTokens,
        costUsd: computeCost(this.model, inputTokens, outputTokens, true),
      },
      stopReason: toolCalls.length > 0 ? "tool_use" : "end_turn",
      model: this.model,
      provider: this.name,
    }
  }
}

export function createOpenRouterProvider(model: string): OpenRouterProvider | null {
  if (!process.env.OPENROUTER_API_KEY) {
    logger.warn("OPENROUTER_API_KEY not set — OpenRouter provider unavailable")
    return null
  }
  return new OpenRouterProvider(model)
}
