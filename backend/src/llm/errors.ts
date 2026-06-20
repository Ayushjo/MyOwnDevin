/** Shared LLM error classification for router + agent retry loops. */

export function isRateLimit(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase()
    return msg.includes("429") || msg.includes("rate limit") || msg.includes("quota")
  }
  return false
}

/** Tokens-per-day — won't recover for hours; skip this provider/model. */
export function isDailyLimit(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const msg = error.message.toLowerCase()
  return (
    msg.includes("tokens per day") ||
    msg.includes("(tpd)") ||
    msg.includes("per day (tpd)")
  )
}

export function isInsufficientCredits(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const msg = error.message.toLowerCase()
  return msg.includes("402") || msg.includes("insufficient credits") || msg.includes("prompt tokens limit exceeded")
}

export function isToolCallError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const msg = error.message.toLowerCase()
  return msg.includes("tool_use_failed") || msg.includes("tool call validation")
}

/** Model returned malformed tool JSON — recover in-agent, do not burn the failover chain. */
export function isOutputParseFailed(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const msg = error.message.toLowerCase()
  return (
    msg.includes("output_parse_failed") ||
    msg.includes("parsing failed") ||
    msg.includes("failed_generation") ||
    msg.includes("could not be parsed") ||
    isJsonParseError(error)
  )
}

/** JSON.parse failed on tool-call arguments (truncated write_file, bad escaping, etc.). */
export function isJsonParseError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const msg = error.message.toLowerCase()
  return (
    error.name === "ToolArgumentsParseError" ||
    msg.includes("unterminated string") ||
    msg.includes("unexpected token") ||
    msg.includes("unexpected end of json") ||
    msg.includes("malformed tool arguments") ||
    (msg.includes("json") && (msg.includes("position") || msg.includes("at line")))
  )
}

/**
 * Errors the agent can fix by re-prompting — must NOT trigger provider failover.
 * Failover on these burns budget and produces garbage cross-provider history.
 */
export function isAgentRecoverableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const msg = error.message.toLowerCase()
  return (
    isJsonParseError(error) ||
    isOutputParseFailed(error) ||
    isToolCallError(error) ||
    msg.includes("invalid parameter") ||
    msg.includes("tool_calls") ||
    msg.includes("function response turn") ||
    msg.includes("function call turn") ||
    msg.includes("messages with role 'tool'") ||
    msg.includes("invalid_argument") ||
    msg.includes("invalid request")
  )
}

export class ModelRecoverableError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message)
    this.name = "ModelRecoverableError"
  }
}

export class BudgetExceededError extends Error {
  constructor(
    message: string,
    readonly scope: "task" | "org",
    readonly spentUsd: number,
    readonly limitUsd: number,
  ) {
    super(message)
    this.name = "BudgetExceededError"
  }
}

export function parseRetryAfterMs(error: unknown): number | null {
  if (!(error instanceof Error)) return null
  const match = error.message.match(/try again in ([\d.]+)s/i)
  if (match?.[1]) return Math.ceil(parseFloat(match[1]) * 1000) + 500
  const retryAfter = error.message.match(/retry-after[":\s]+(\d+)/i)
  if (retryAfter?.[1]) return parseInt(retryAfter[1], 10) * 1000
  return null
}

export function providerKey(provider: string, model: string): string {
  return `${provider}:${model}`
}
