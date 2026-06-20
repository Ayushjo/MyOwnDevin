import { describe, expect, it } from "vitest"
import { toGeminiContents } from "../geminiMessages.js"
import { toOpenAIMessages } from "../openaiMessages.js"
import { isAgentRecoverableError } from "../errors.js"

describe("toGeminiContents", () => {
  it("pairs functionCall with matching functionResponse name", () => {
    const contents = toGeminiContents({
      system: "sys",
      messages: [
        {
          role: "assistant",
          content: [
            { type: "tool_use", id: "call_1", name: "view_file", input: { path: "a.ts" } },
          ],
        },
        {
          role: "user",
          content: [
            { type: "tool_result", tool_use_id: "call_1", content: "file contents" },
          ],
        },
      ],
    })

    expect(contents).toHaveLength(2)
    expect(contents[0]?.role).toBe("model")
    expect(contents[0]?.parts?.[0]).toMatchObject({
      functionCall: { name: "view_file" },
    })
    expect(contents[1]?.role).toBe("user")
    expect(contents[1]?.parts?.[0]).toMatchObject({
      functionResponse: { name: "view_file" },
    })
  })
})

describe("toOpenAIMessages orphan handling", () => {
  it("folds orphaned tool results into user text", () => {
    const msgs = toOpenAIMessages({
      system: "sys",
      messages: [
        {
          role: "user",
          content: [
            { type: "tool_result", tool_use_id: "orphan", content: "oops" },
          ],
        },
      ],
    })

    const user = msgs.find((m) => m.role === "user")
    expect(user).toBeDefined()
    expect("content" in user! && user.content).toContain("orphan")
  })
})

describe("isAgentRecoverableError gemini", () => {
  it("treats Gemini function-call ordering errors as recoverable", () => {
    expect(
      isAgentRecoverableError(
        new Error(
          "Please ensure that function call turn comes immediately after a user turn or after a function response turn.",
        ),
      ),
    ).toBe(true)
  })
})
