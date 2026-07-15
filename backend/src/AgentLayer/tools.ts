import type { LLMTool } from "../llm/types.js"

/** Canonical tools sent to LLMs — no dotted aliases (reduces hallucination + OpenAI name issues). */
export const AGENT_TOOLS: LLMTool[] = [
  {
    name: "run_shell",
    description: "Run a shell command in the sandbox. Backend npm/tsc commands auto-run from /workspace/backend.",
    input_schema: {
      type: "object",
      properties: {
        command: { type: "string", description: "Shell command e.g. 'npm run build'" },
        timeoutMs: { type: "number", description: "Timeout ms (default 30000)" },
      },
      required: ["command"],
    },
  },
  {
    name: "read_file",
    description: "Read an entire file. Prefer view_file for large files.",
    input_schema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "Absolute path e.g. '/workspace/frontend/src/App.tsx'" },
      },
      required: ["filePath"],
    },
  },
  {
    name: "view_file",
    description: "Read a line range from a file (max ~100 lines). Use for large files.",
    input_schema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "Absolute path" },
        startLine: { type: "number", description: "1-indexed start (default 1)" },
        endLine: { type: "number", description: "End line (default start+99)" },
      },
      required: ["filePath"],
    },
  },
  {
    name: "write_file",
    description:
      "Write full file content. For files >150 lines, use view_file first, then write the COMPLETE updated file. " +
      "Escape quotes/newlines properly in JSON. If a write fails, retry with a smaller targeted edit.",
    input_schema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "Absolute path" },
        content: { type: "string", description: "Full file content to write" },
      },
      required: ["filePath", "content"],
    },
  },
  {
    name: "search_code",
    description: "Ripgrep search across the repo. Returns matching paths and lines.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search pattern" },
        path: { type: "string", description: "Directory (default /workspace)" },
        max_results: { type: "number", description: "Max matches (default 30)" },
      },
      required: ["query"],
    },
  },
  {
    name: "list_dir",
    description: "List files in a directory.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Directory path (default /workspace)" },
        depth: { type: "number", description: "Tree depth" },
      },
      required: [],
    },
  },
  {
    name: "print_tree",
    description: "Show directory tree to discover layout.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Root (default /workspace)" },
        depth: { type: "number", description: "Max depth (default 2)" },
      },
      required: [],
    },
  },
  {
    name: "git_commit",
    description: "Stage all changes and commit.",
    input_schema: {
      type: "object",
      properties: {
        message: { type: "string", description: "Commit message" },
      },
      required: ["message"],
    },
  },
]

/** @deprecated use AGENT_TOOLS — kept for type exports */
export const TOOLS = AGENT_TOOLS

export type ToolInput = {
  run_shell: { command: string; timeoutMs?: number }
  read_file: { filePath: string; timeoutMs?: number }
  write_file: { filePath: string; content: string; timeoutMs?: number }
  git_commit: { message: string; timeoutMs?: number }
  git_checkout: { branch: string; timeoutMs?: number }
  search_code: { query: string; path?: string; max_results?: number }
  view_file: { filePath: string; startLine?: number; endLine?: number }
  list_dir: { path?: string; depth?: number }
  print_tree: { path?: string; depth?: number }
}
