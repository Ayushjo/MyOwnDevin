import type OpenAI from "openai"
import type { ChatParams } from "./types.js"

export type ToolNameSanitizer = (name: string) => string

const identity: ToolNameSanitizer = (name) => name

/**
 * Convert internal chat history to OpenAI-compatible messages.
 * Handles orphaned tool results (no preceding assistant tool_calls) by folding into user text.
 */
export function toOpenAIMessages(
  params: ChatParams,
  sanitizeToolName: ToolNameSanitizer = identity,
): OpenAI.Chat.ChatCompletionMessageParam[] {
  const msgs: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: params.system },
  ]

  for (const msg of params.messages) {
    if (typeof msg.content === "string") {
      msgs.push({ role: msg.role as "user" | "assistant", content: msg.content })
      continue
    }

    if (msg.role === "assistant") {
      const textParts = msg.content.filter((c) => c.type === "text")
      const toolParts = msg.content.filter((c) => c.type === "tool_use")
      const text = textParts.map((c) => (c.type === "text" ? c.text : "")).join("")

      if (toolParts.length > 0) {
        msgs.push({
          role: "assistant",
          content: text || null,
          tool_calls: toolParts.map((c) => {
            if (c.type !== "tool_use") throw new Error("unexpected")
            return {
              id: c.id,
              type: "function" as const,
              function: {
                name: sanitizeToolName(c.name),
                arguments: JSON.stringify(c.input),
              },
            }
          }),
        })
      } else if (text) {
        msgs.push({ role: "assistant", content: text })
      }
      continue
    }

    if (msg.role === "user") {
      const toolResults = msg.content.filter((c) => c.type === "tool_result")
      const textParts = msg.content.filter((c) => c.type === "text")
      const last = msgs[msgs.length - 1]
      const canEmitTools =
        last?.role === "assistant" &&
        "tool_calls" in last &&
        Array.isArray(last.tool_calls) &&
        last.tool_calls.length > 0

      if (canEmitTools && toolResults.length > 0) {
        for (const part of toolResults) {
          if (part.type !== "tool_result") continue
          msgs.push({
            role: "tool",
            tool_call_id: part.tool_use_id,
            content: part.content,
          })
        }
      } else if (toolResults.length > 0) {
        const folded = toolResults
          .map((p) =>
            p.type === "tool_result"
              ? `[Tool result ${p.tool_use_id}]: ${p.content.slice(0, 2000)}`
              : "",
          )
          .join("\n")
        msgs.push({ role: "user", content: folded })
      }

      const text = textParts.map((c) => (c.type === "text" ? c.text : "")).join("\n")
      if (text) msgs.push({ role: "user", content: text })
    }
  }

  return msgs
}
