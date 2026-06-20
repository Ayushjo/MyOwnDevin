import { Anthropic } from "@anthropic-ai/sdk"
import type { ContentBlock } from "@anthropic-ai/sdk/resources/messages/messages.js"
import type { ChatParams, LLMProvider, LLMResponse, LLMMessage, ProviderName } from "../types.js"
import { computeCost } from "../pricing.js"
import logger from "../../logger.js"

export class AnthropicProvider implements LLMProvider {
  readonly name: ProviderName = "anthropic"
  private client: Anthropic

  constructor(readonly model: string) {
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  }

  async chat(params: ChatParams): Promise<LLMResponse> {
    const messages = params.messages.map((m) => this.toAnthropicMessage(m))

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: params.maxTokens ?? 4096,
      system: params.system,
      messages,
      tools: params.tools?.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.input_schema as Anthropic.Tool["input_schema"],
      })) ?? [],
    })

    const inputTokens = response.usage.input_tokens
    const outputTokens = response.usage.output_tokens

    const textBlock = response.content.find((b: ContentBlock) => b.type === "text")
    const toolCalls = response.content
      .filter((b: ContentBlock): b is ContentBlock & { type: "tool_use" } => b.type === "tool_use")
      .map((b) => ({
        id: b.id,
        name: b.name,
        input: b.input as Record<string, unknown>,
      }))

    const stopReason =
      response.stop_reason === "tool_use" ? "tool_use" :
      response.stop_reason === "max_tokens" ? "max_tokens" : "end_turn"

    return {
      text: textBlock?.type === "text" ? textBlock.text : "",
      toolCalls,
      usage: {
        inputTokens,
        outputTokens,
        costUsd: computeCost(this.model, inputTokens, outputTokens, false),
      },
      stopReason,
      model: this.model,
      provider: this.name,
    }
  }

  private toAnthropicMessage(msg: LLMMessage) {
    if (typeof msg.content === "string") {
      return { role: msg.role, content: msg.content }
    }
    return {
      role: msg.role,
      content: msg.content.map((block) => {
        if (block.type === "text") return { type: "text" as const, text: block.text }
        if (block.type === "tool_use") return {
          type: "tool_use" as const,
          id: block.id,
          name: block.name,
          input: block.input,
        }
        return {
          type: "tool_result" as const,
          tool_use_id: block.tool_use_id,
          content: block.content,
        }
      }),
    }
  }
}

export function createAnthropicProvider(model: string): AnthropicProvider | null {
  if (!process.env.ANTHROPIC_API_KEY) {
    logger.warn("ANTHROPIC_API_KEY not set — Anthropic provider unavailable")
    return null
  }
  return new AnthropicProvider(model)
}
