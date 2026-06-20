import { GoogleGenAI, type FunctionDeclaration } from "@google/genai"
import type { ChatParams, LLMProvider, LLMResponse, ProviderName } from "../types.js"
import { computeProviderCost } from "../pricing.js"
import { loadLLMConfig } from "../config.js"
import { toGeminiContents } from "../geminiMessages.js"
import logger from "../../logger.js"

export class GeminiProvider implements LLMProvider {
  readonly name: ProviderName = "gemini"
  private client: GoogleGenAI

  constructor(readonly model: string) {
    this.client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })
  }

  async chat(params: ChatParams): Promise<LLMResponse> {
    const contents = toGeminiContents(params)
    const tools = params.tools?.length
      ? [{
          functionDeclarations: params.tools.map((t) => ({
            name: t.name,
            description: t.description,
            parametersJsonSchema: t.input_schema,
          } satisfies FunctionDeclaration)),
        }]
      : undefined

    const response = await this.client.models.generateContent({
      model: this.model,
      contents,
      config: {
        systemInstruction: params.system,
        maxOutputTokens: params.maxTokens ?? 4096,
        temperature: params.temperature ?? 0,
        ...(tools ? { tools } : {}),
      },
    })

    const inputTokens = response.usageMetadata?.promptTokenCount ?? 0
    const outputTokens = response.usageMetadata?.candidatesTokenCount ?? 0
    const isFreeTier = loadLLMConfig().isFreeTier

    const parts = response.candidates?.[0]?.content?.parts ?? []
    const text = parts
      .filter((p): p is typeof p & { text: string } => "text" in p && !!p.text)
      .map((p) => p.text)
      .join("")

    const toolCalls = parts
      .filter((p): p is typeof p & { functionCall: { name: string; args: Record<string, unknown> } } =>
        "functionCall" in p && !!p.functionCall
      )
      .map((p, i) => ({
        id: `gemini_${Date.now()}_${i}`,
        name: p.functionCall.name,
        input: (p.functionCall.args ?? {}) as Record<string, unknown>,
      }))

  return {
      text,
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

export function createGeminiProvider(model: string): GeminiProvider | null {
  if (!process.env.GEMINI_API_KEY) {
    logger.warn("GEMINI_API_KEY not set — Gemini provider unavailable")
    return null
  }
  return new GeminiProvider(model)
}
