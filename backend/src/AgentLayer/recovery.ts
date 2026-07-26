import { AGENT_TOOLS } from "./tools.js"

const TOOL_NAMES = AGENT_TOOLS.map((t) => t.name).join(", ")

export function buildAgentRecoveryPrompt(
  error: unknown,
  attempt: number,
  maxAttempts: number,
  context?: { lastTool?: string; stepHint?: string },
): string {
  const errMsg = error instanceof Error ? error.message : String(error)
  const isJson = /json|unterminated|unexpected token|malformed tool/i.test(errMsg)
  const isTruncated = /unterminated|position \d+/i.test(errMsg)

  const lines = [
    `# EXECUTION ERROR (recovery ${attempt}/${maxAttempts})`,
    "",
    "## What failed",
    errMsg.slice(0, 600),
    "",
    "## Why this happens",
  ]

  if (isJson && isTruncated) {
    lines.push(
      "- Your last tool call JSON was truncated or had unescaped characters (common on large write_file).",
      "- The API could not parse the arguments — no file was written.",
    )
  } else if (isJson) {
    lines.push(
      "- Tool-call arguments were invalid JSON.",
      "- Check escaping: use \\n for newlines inside strings, escape quotes as \\\".",
    )
  } else {
    lines.push("- The provider rejected the request format or tool call.", "- Stay on registered tools only.")
  }

  if (context?.lastTool) {
    lines.push("", `## Last tool attempted: ${context.lastTool}`)
  }
  if (context?.stepHint) {
    lines.push("", `## Step context: ${context.stepHint}`)
  }

  lines.push(
    "",
    "## What to do now (follow exactly)",
    "1. Use view_file to read ONLY the section you need to change (not the whole file if >150 lines).",
    "2. Call write_file with the COMPLETE file content — valid JSON, properly escaped.",
    "3. If the file is large, make a minimal edit: change only the lines required for this step.",
    `4. Use ONLY these tools: ${TOOL_NAMES}`,
    "5. Do NOT repeat the same failing tool call with identical arguments.",
    "",
    "Proceed with the fix now.",
  )

  return lines.join("\n")
}
