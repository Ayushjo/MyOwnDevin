import { describe, it, expect } from "vitest"
import { parseToolArguments, ToolArgumentsParseError } from "../parseToolArgs.js"
import { isAgentRecoverableError, isJsonParseError } from "../errors.js"

describe("parseToolArguments", () => {
  it("parses valid JSON", () => {
    expect(parseToolArguments('{"filePath":"/workspace/a.ts","content":"x"}')).toEqual({
      filePath: "/workspace/a.ts",
      content: "x",
    })
  })

  it("recovers truncated write_file JSON", () => {
    const raw = '{"filePath":"/workspace/frontend/src/pages/TaskView.tsx","content":"import React\\nconst x = 1\\n'
    const result = parseToolArguments(raw, "write_file")
    expect(result.filePath).toBe("/workspace/frontend/src/pages/TaskView.tsx")
    expect(String(result.content)).toContain("import React")
  })

  it("throws ToolArgumentsParseError on garbage", () => {
    expect(() => parseToolArguments("{not json at all", "read_file")).toThrow(ToolArgumentsParseError)
  })
})

describe("isJsonParseError", () => {
  it("detects unterminated string", () => {
    expect(isJsonParseError(new Error("Unterminated string in JSON at position 5237"))).toBe(true)
  })

  it("detects ToolArgumentsParseError", () => {
    expect(isJsonParseError(new ToolArgumentsParseError("bad", "{}"))).toBe(true)
  })
})

describe("isAgentRecoverableError", () => {
  it("treats tool message format errors as recoverable", () => {
    expect(
      isAgentRecoverableError(
        new Error("Invalid parameter: messages with role 'tool' must be a response to a preceeding message with 'tool_calls'."),
      ),
    ).toBe(true)
  })

  it("does not treat 404 model errors as agent-recoverable", () => {
    expect(isAgentRecoverableError(new Error("404 The model does not exist"))).toBe(false)
  })
})
