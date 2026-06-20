import type { Content, Part } from "@google/genai"
import type { ChatParams, LLMMessageContent } from "./types.js"

/**
 * Convert internal chat history to Gemini contents.
 * Gemini requires strict alternation: model functionCall → user functionResponse (matching name).
 */
export function toGeminiContents(params: ChatParams): Content[] {
  const contents: Content[] = []
  const toolNamesById = new Map<string, string>()

  for (const msg of params.messages) {
    if (typeof msg.content === "string") {
      contents.push({
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: msg.content }],
      })
      continue
    }

    const blocks = msg.content as LLMMessageContent[]

    if (msg.role === "assistant") {
      const parts: Part[] = []
      for (const block of blocks) {
        if (block.type === "text" && block.text) {
          parts.push({ text: block.text })
        } else if (block.type === "tool_use") {
          toolNamesById.set(block.id, block.name)
          parts.push({
            functionCall: { name: block.name, args: block.input },
          })
        }
      }
      if (parts.length > 0) {
        contents.push({ role: "model", parts })
      }
      continue
    }

    if (msg.role === "user") {
      const toolResults = blocks.filter((b) => b.type === "tool_result")
      const textParts = blocks.filter((b) => b.type === "text")

      for (const tr of toolResults) {
        if (tr.type !== "tool_result") continue
        const toolName = toolNamesById.get(tr.tool_use_id) ?? "unknown_tool"
        contents.push({
          role: "user",
          parts: [{
            functionResponse: {
              name: toolName,
              response: { output: tr.content },
            },
          }],
        })
      }

      const text = textParts
        .filter((t): t is { type: "text"; text: string } => t.type === "text")
        .map((t) => t.text)
        .join("\n")
      if (text) {
        contents.push({ role: "user", parts: [{ text }] })
      }
    }
  }

  return contents
}
