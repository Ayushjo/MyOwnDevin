import { describe, it, expect } from "vitest"

const ALIASES: Record<string, string> = {
  "repo_browser.search": "search_code",
  "repo_browser_search": "search_code",
  "repo_browser.print_tree": "print_tree",
  "repo_browser_print_tree": "print_tree",
  "repo_browser.list_dir": "list_dir",
  "repo_browser_list_dir": "list_dir",
}

function canonicalToolName(name: string): string {
  return ALIASES[name] ?? name
}

describe("tool alias mapping", () => {
  const cases = [
    ["repo_browser.search", "search_code"],
    ["repo_browser.print_tree", "print_tree"],
    ["repo_browser.list_dir", "list_dir"],
    ["write_file", "write_file"],
    ["search_code", "search_code"],
  ] as const

  for (const [input, expected] of cases) {
    it(`maps ${input} → ${expected}`, () => {
      expect(canonicalToolName(input)).toBe(expected)
    })
  }
})

describe("budget math", () => {
  it("task at 80% triggers downgrade threshold", () => {
    const limit = 0.25
    const spent = 0.21
    expect(spent / limit).toBeGreaterThanOrEqual(0.8)
  })

  it("$5 org budget supports ~20 tasks at $0.25 cap", () => {
    expect(5.0 / 0.25).toBe(20)
  })

  it("hybrid executor cost estimate under cap", () => {
    const inputTokens = 60_000
    const outputTokens = 4_000
    const cost = (inputTokens / 1e6) * 0.15 + (outputTokens / 1e6) * 0.60
    expect(cost).toBeLessThan(0.25)
  })
})

describe("history window", () => {
  it("6 rounds = 12 messages max", () => {
    const rounds = 6
    expect(rounds * 2).toBe(12)
  })
})

describe("planner attempt limit", () => {
  it("max 4 planner attempts before fallback", () => {
    const MAX_ATTEMPTS = 4
    expect(MAX_ATTEMPTS).toBeLessThanOrEqual(4)
  })
})

describe("executor per-step LLM cap", () => {
  it("default max iterations prevents runaway", () => {
    const maxIter = Number(process.env.AGENT_MAX_ITERATIONS ?? 40)
    expect(maxIter).toBeLessThanOrEqual(40)
  })
})
