/** Safe parsing of LLM tool-call argument JSON — never crash the agent loop. */

export class ToolArgumentsParseError extends Error {
  readonly raw: string
  readonly partial?: Record<string, unknown>

  constructor(message: string, raw: string, partial?: Record<string, unknown>) {
    super(message)
    this.name = "ToolArgumentsParseError"
    this.raw = raw
    if (partial !== undefined) this.partial = partial
  }
}

function unescapeJsonString(s: string): string {
  return s.replace(/\\n/g, "\n").replace(/\\t/g, "\t").replace(/\\"/g, '"').replace(/\\\\/g, "\\")
}

/** Best-effort recovery when the model truncated or mangled tool-call JSON (common on large write_file). */
function recoverPartialArgs(raw: string, toolName?: string): Record<string, unknown> | null {
  const filePath =
    raw.match(/"filePath"\s*:\s*"((?:\\.|[^"\\])*)"/)?.[1] ??
    raw.match(/"filePath"\s*:\s*'([^']*)'/)?.[1]

  if (!filePath) return null

  const decodedPath = unescapeJsonString(filePath)

  // write_file: grab everything after "content": " even if JSON is truncated
  const contentKey = raw.match(/"content"\s*:\s*"/)
  if (contentKey && (toolName === "write_file" || raw.includes('"content"'))) {
    const start = raw.indexOf(contentKey[0]) + contentKey[0].length
    let content = raw.slice(start)
    // Trim at last complete line if truncated mid-string
    if (!content.endsWith('"') && !content.endsWith('"}')) {
      const lastNewline = content.lastIndexOf("\\n")
      if (lastNewline > 0) content = content.slice(0, lastNewline)
    }
    content = content.replace(/"\s*}?\s*$/, "")
    return { filePath: decodedPath, content: unescapeJsonString(content) }
  }

  if (toolName === "read_file" || toolName === "view_file") {
    return { filePath: decodedPath }
  }

  const command = raw.match(/"command"\s*:\s*"((?:\\.|[^"\\])*)"/)?.[1]
  if (command) return { command: unescapeJsonString(command) }

  const query = raw.match(/"query"\s*:\s*"((?:\\.|[^"\\])*)"/)?.[1]
  if (query) return { query: unescapeJsonString(query) }

  return { filePath: decodedPath }
}

export function parseToolArguments(
  raw: string | undefined | null,
  toolName?: string,
): Record<string, unknown> {
  const trimmed = (raw ?? "").trim()
  if (!trimmed || trimmed === "{}") return {}

  try {
    return JSON.parse(trimmed) as Record<string, unknown>
  } catch (firstError) {
    const partial = recoverPartialArgs(trimmed, toolName)
    if (partial && Object.keys(partial).length > 0) {
      return partial
    }

    const hint = trimmed.length > 120 ? `${trimmed.slice(0, 120)}…` : trimmed
    const pos = firstError instanceof SyntaxError && "message" in firstError
      ? firstError.message
      : String(firstError)
    throw new ToolArgumentsParseError(
      `Malformed tool arguments JSON (${pos}). Preview: ${hint}`,
      trimmed,
      partial ?? undefined,
    )
  }
}
