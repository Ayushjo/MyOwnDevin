import { AgentBrain } from "../AgentLayer/index.js"
import logger from "../logger.js"
import type ToolExecutor from "../tools/index.js"
import { VERIFIER_PROMPT } from "../utils/prompts.js"
import type { Step } from "./plannerAgent.js"
import type { LLMRouter } from "../llm/router.js"
import { getLLMRouter } from "../llm/router.js"
import type { MetricsCollector } from "../metrics/metrics.js"
import type { VerificationResult } from "../events/types.js"

const CHANGE_KEYWORDS = ["write", "fix", "implement", "add", "import", "edit", "modify", "create", "update"]

function stepRequiresCodeChange(description: string): boolean {
    const desc = description.toLowerCase()
    return CHANGE_KEYWORDS.some((kw) => desc.includes(kw))
}

function extractRoutePath(description: string): string | null {
    const quoted = description.match(/['"`](\/api\/[^'"`.]+)['"`]/i)
    if (quoted?.[1]) return quoted[1]
    const methodPath = description.match(/(?:GET|POST|PUT|DELETE|PATCH)\s+(\/api\/[a-z0-9/_-]+)/i)
    if (methodPath?.[1]) return methodPath[1].replace(/[.,;)\]]+$/, "")
    return null
}

function extractTargetFile(description: string): string | null {
    const quoted = description.match(/`((?:backend|frontend)\/[\w./-]+\.(?:ts|tsx|js|jsx))`/i)
    if (quoted?.[1]) return `/workspace/${quoted[1]}`

    const match = description.match(/\b((?:backend|frontend)\/[\w./-]+\.(?:ts|tsx|js|jsx))\b/i)
    if (match?.[1]) return `/workspace/${match[1]}`

    return null
}

function isRouterFile(targetFile: string): boolean {
    return targetFile.includes("/api/router") || /\/router\.(ts|tsx|js|jsx)$/i.test(targetFile)
}

/** HTTP routes live in router.ts — not in store/registry/frontend data layers. */
function routeBelongsInFile(step: Step, targetFile: string): boolean {
    if (isRouterFile(targetFile)) return true
    if (targetFile.includes("/store/") || targetFile.includes("taskregistry")) return false
    const fileRel = targetFile.replace("/workspace/", "").toLowerCase()
    const desc = step.description.toLowerCase()
    return desc.includes(fileRel) && (desc.includes("route") || desc.includes("endpoint"))
}

function inferTargetFile(description: string): string | null {
    const desc = description.toLowerCase()
    if (desc.includes("taskregistry") || desc.includes("task registry")) {
        return "/workspace/backend/src/store/taskRegistry.ts"
    }
    if (desc.includes("client.ts") || desc.includes("api client") || desc.includes("searchtasks")) {
        return "/workspace/frontend/src/api/client.ts"
    }
    if (desc.includes("history.tsx") || desc.includes("history page")) {
        return "/workspace/frontend/src/pages/History.tsx"
    }
    if (desc.includes("router.ts") || (desc.includes("route") && desc.includes("/api/"))) {
        return "/workspace/backend/src/api/router.ts"
    }
    return null
}

export class VerifierAgent {
    private router: LLMRouter
    private brain: AgentBrain

    constructor(router?: LLMRouter, private metrics?: MetricsCollector) {
        this.router = router ?? getLLMRouter()
        this.brain = new AgentBrain({
            systemPrompt: VERIFIER_PROMPT,
            role: "verifier",
            router: this.router,
        })
    }

    async isAlreadySatisfied(
        step: Step,
        toolExecutor: ToolExecutor,
    ): Promise<{ passed: boolean; reason: string }> {
        return this.stepContentSatisfied(step, toolExecutor)
    }

    async verify(
        step: Step,
        output: string,
        toolExecutor?: ToolExecutor,
    ): Promise<VerificationResult> {
        const signals: string[] = []

        const layer1 = await this.deterministicCheck(step, output, toolExecutor)
        signals.push(...layer1.signals)
        if (layer1.definitive) {
            return { passed: layer1.passed, reason: layer1.reason, layer: "deterministic", signals }
        }

        if (toolExecutor) {
            const layer2 = await this.fileContentCheck(step, toolExecutor)
            signals.push(...layer2.signals)
            if (layer2.definitive) {
                return { passed: layer2.passed, reason: layer2.reason, layer: "deterministic", signals }
            }

            const layer3 = await this.diffCheck(step, toolExecutor)
            signals.push(...layer3.signals)
            if (layer3.definitive) {
                return { passed: layer3.passed, reason: layer3.reason, layer: "diff", signals }
            }
        }

        return this.llmJudge(step, output, signals)
    }

    private async deterministicCheck(
        step: Step,
        output: string,
        toolExecutor?: ToolExecutor,
    ): Promise<{ passed: boolean; reason: string; definitive: boolean; signals: string[] }> {
        const signals: string[] = []
        const desc = step.description.toLowerCase()
        const out = output.toLowerCase()

        if (out.includes('"type":"tool_use"') || out.includes("tool_use")) {
            signals.push("malformed_executor_output")
            return { passed: false, reason: "Executor returned tool-call JSON instead of completing the step", definitive: true, signals }
        }

        if (out.includes("step complete") && stepRequiresCodeChange(step.description)) {
            signals.push("executor_claimed_complete_needs_file_check")
            // not definitive — verify file content / diff below
        } else if (out.includes("step complete")) {
            signals.push("executor_claimed_complete")
            return { passed: true, reason: "Executor reported step complete", definitive: true, signals }
        }

        // Only treat short failure summaries as errors — not source code containing the word "error"
        if (output.length < 600 && /\bfailed\b/i.test(output) && /\berror\b/i.test(output) && !out.includes("step complete")) {
            signals.push("output_contains_error")
            return { passed: false, reason: "Executor output indicates failure", definitive: true, signals }
        }

        if (desc.includes("test") || desc.includes("run test")) {
            if (toolExecutor) {
                const testResult = await toolExecutor.run_shell(
                    "cd /workspace/backend && (npm test 2>&1 | tail -20 || echo 'NO_TEST_RUNNER')",
                    60_000,
                )
                signals.push(`test_exit: ${testResult.success}`)
                if (testResult.output.includes("NO_TEST_RUNNER")) {
                    return { passed: false, reason: "No test runner found", definitive: false, signals }
                }
                if (testResult.success) {
                    return { passed: true, reason: "Tests passed (exit 0)", definitive: true, signals }
                }
                return { passed: false, reason: `Tests failed: ${testResult.output.slice(0, 200)}`, definitive: true, signals }
            }
        }

        return { passed: false, reason: "Ambiguous — needs further checks", definitive: false, signals }
    }

    private async fileContentCheck(
        step: Step,
        toolExecutor: ToolExecutor,
    ): Promise<{ passed: boolean; reason: string; definitive: boolean; signals: string[] }> {
        const signals: string[] = []
        const desc = step.description.toLowerCase()
        let targetFile = extractTargetFile(step.description) ?? inferTargetFile(step.description)

        if (!targetFile || !stepRequiresCodeChange(step.description)) {
            return { passed: false, reason: "No target file to check", definitive: false, signals }
        }

        let fileResult = await toolExecutor.read_file(targetFile)
        signals.push(`checked_file: ${targetFile}`)
        if (!fileResult.success) {
            for (const rel of toolExecutor.getWrittenFiles()) {
                const candidate = `/workspace/${rel}`
                const fallback = await toolExecutor.read_file(candidate)
                if (fallback.success) {
                    logger.warn(`[fileContentCheck] path fix: ${targetFile} → ${candidate}`)
                    targetFile = candidate
                    fileResult = fallback
                    signals.push(`fallback_file: ${candidate}`)
                    break
                }
            }
        }
        if (!fileResult.success) {
            return { passed: false, reason: `Target file not readable: ${targetFile}`, definitive: true, signals }
        }

        const content = fileResult.output
        const routePath = extractRoutePath(step.description)

        if (desc.includes("import")) {
            const importMatch = step.description.match(/import\s+[^;`']+;?/i)
            const importSnippet = importMatch?.[0]?.toLowerCase() ?? ""
            const hasImport =
                (importSnippet && content.toLowerCase().includes(importSnippet.replace(/;$/, ""))) ||
                /\bimport\b.+\bfrom\b.+['"]/.test(content)

            if (!hasImport) {
                return { passed: false, reason: `Import statement not found in ${targetFile.replace("/workspace/", "")}`, definitive: true, signals }
            }
            return { passed: true, reason: "Import statement found in target file", definitive: true, signals }
        }

        if (
            routePath &&
            routeBelongsInFile(step, targetFile) &&
            !desc.includes("search") &&
            (desc.includes("add ") || desc.includes("update ") || desc.includes("modify ") || desc.includes("implement ") || desc.includes("create "))
        ) {
            if (!content.includes(routePath)) {
                return { passed: false, reason: `Route ${routePath} not found in ${targetFile.replace("/workspace/", "")}`, definitive: true, signals }
            }
            return { passed: true, reason: `Route ${routePath} found in target file`, definitive: true, signals }
        }

        if ((desc.includes("cancelled") || desc.includes("canceled")) && targetFile.includes("taskregistry")) {
            if (/cancelled/.test(content)) {
                return { passed: true, reason: "cancelled status present in taskRegistry", definitive: true, signals }
            }
        }

        if (desc.includes("search") && /\bsearch\s*\(/.test(content) && targetFile.includes("taskregistry")) {
            return { passed: true, reason: `search() method found in ${targetFile.replace("/workspace/", "")}`, definitive: true, signals }
        }

        if (/\bsearchTasks\b/.test(content) && (desc.includes("searchtasks") || targetFile.includes("client"))) {
            return { passed: true, reason: `searchTasks() found in ${targetFile.replace("/workspace/", "")}`, definitive: true, signals }
        }

        return { passed: false, reason: "File content check inconclusive", definitive: false, signals }
    }

    private async diffCheck(
        step: Step,
        toolExecutor: ToolExecutor,
    ): Promise<{ passed: boolean; reason: string; definitive: boolean; signals: string[] }> {
        const signals: string[] = []
        const diffStat = await toolExecutor.gitDiffStat()
        const diffNames = await toolExecutor.gitDiffNames()
        const writtenFiles = toolExecutor.getWrittenFiles()

        logger.info(`[diffCheck] step=${step.id} stat="${diffStat.slice(0, 200)}" files=[${diffNames.join(",")}] written=[${writtenFiles.join(",")}]`)
        signals.push(`diff_stat: ${diffStat.slice(0, 100)}`)
        signals.push(`diff_files: ${diffNames.slice(0, 5).join(',')}`)
        if (writtenFiles.length) signals.push(`written_files: ${writtenFiles.join(',')}`)

        const needsChange = stepRequiresCodeChange(step.description)

        // Use file list as the authoritative source (tracked diff + untracked + write_file ledger)
        const hasSourceChanges = diffNames.some(f => /\.(ts|tsx|js|jsx)$/.test(f))
        const wroteSource = writtenFiles.some(f => /\.(ts|tsx|js|jsx)$/.test(f))

        if ((hasSourceChanges || wroteSource) && needsChange) {
            const src = diffNames.filter(f => /\.(ts|tsx|js|jsx)$/.test(f))
            const label = src.length ? src.join(", ") : writtenFiles.join(", ")
            return { passed: true, reason: `Source code changes detected: ${label}`, definitive: true, signals }
        }

        if (needsChange && !hasSourceChanges && !wroteSource) {
            // Work may already exist from a prior attempt (retry/resume) — check file content
            // before failing on an empty diff (common when baselineSha was lost).
            const contentOk = await this.stepContentSatisfied(step, toolExecutor)
            signals.push(`content_check: ${contentOk.passed}`)
            if (contentOk.passed) {
                return { passed: true, reason: contentOk.reason, definitive: true, signals }
            }
            const debug = await toolExecutor.gitDiffDebug()
            logger.warn(`[diffCheck] FAILED step=${step.id}: ${debug}`)
            return { passed: false, reason: `Step requires code changes but no source file diff detected (files: [${diffNames.join(',')}]). ${debug}`, definitive: true, signals }
        }

        return { passed: false, reason: "Diff check inconclusive", definitive: false, signals }
    }

    /** Heuristic: does the repo already satisfy this step's intent? (idempotent retries) */
    private async stepContentSatisfied(
        step: Step,
        toolExecutor: ToolExecutor,
    ): Promise<{ passed: boolean; reason: string }> {
        const desc = step.description.toLowerCase()
        let targetFile = extractTargetFile(step.description) ?? inferTargetFile(step.description)

        if (targetFile) {
            const fileResult = await toolExecutor.read_file(targetFile)
            if (!fileResult.success) return { passed: false, reason: "Target file missing" }
            const content = fileResult.output

            if (desc.includes("taskregistry") || targetFile.includes("taskregistry")) {
                const hasCount = /\bcount\s*\(/.test(content)
                const hasListOpts = /\blist\s*\(\s*opts/.test(content) || /\blist\s*\(\s*options/.test(content) || /\blist\s*\(\s*\{/.test(content)
                const hasPagination = /zrevrange/.test(content) && (/offset/.test(content) || /limit/.test(content))
                const hasSearch = /\bsearch\s*\(/.test(content) && (/title/.test(content) || /query/.test(content))
                if (hasCount && hasListOpts && hasPagination) {
                    return { passed: true, reason: "taskRegistry.ts already implements count() and paginated list()" }
                }
                if (hasSearch && (desc.includes("search") || desc.includes("method"))) {
                    return { passed: true, reason: "taskRegistry.ts already implements search()" }
                }
                if ((desc.includes("cancelled") || desc.includes("canceled")) && /cancelled/.test(content)) {
                    return { passed: true, reason: "taskRegistry.ts already supports cancelled status" }
                }
            }

            if ((desc.includes("route") || desc.includes("/api/tasks") || desc.includes("get /api/tasks")) && targetFile.includes("router")) {
                const hasRoute = /router\.get\s*\(\s*['"]\/tasks['"]/.test(content) || /['"]\/tasks['"]/.test(content)
                const hasEnvelope = /total/.test(content) && /limit/.test(content) && /offset/.test(content)
                if (hasRoute && hasEnvelope) {
                    return { passed: true, reason: "router.ts already has paginated GET /tasks" }
                }
            }

            if (desc.includes("import") && /\bimport\b.+\bfrom\b/.test(content)) {
                return { passed: true, reason: "Import present in target file" }
            }

            if (/\bsearchTasks\b/.test(content) && targetFile.includes("client")) {
                return { passed: true, reason: "client.ts already has searchTasks()" }
            }
        }

        if (desc.includes("search") && !desc.includes("write") && !desc.includes("add ") && !desc.includes("modify ")) {
            return { passed: true, reason: "Audit/search step — no mandatory code change" }
        }

        if (desc.includes("tsc") || desc.includes("typescript") || desc.includes("compile")) {
            const result = await toolExecutor.run_shell("cd /workspace/backend && npx tsc -b --noEmit 2>&1 | tail -5", 120_000)
            if (result.success) {
                return { passed: true, reason: "TypeScript compilation passes" }
            }
        }

        return { passed: false, reason: "Content check did not confirm step completion" }
    }

    private async llmJudge(step: Step, output: string, signals: string[]): Promise<VerificationResult> {
        try {
            const message = `Step: ${step.description}\nExecutor output: ${output}\nSignals: ${signals.join(", ")}`
            const result = await this.brain.run(message)

            const cleaned = result.text
                .replace(/```json/g, "")
                .replace(/```/g, "")
                .trim()

            const parsed = JSON.parse(cleaned) as { passed: boolean; reason: string }
            return { passed: parsed.passed, reason: parsed.reason, layer: "llm", signals }
        } catch (error) {
            logger.error("LLM verifier error: " + error)
            return { passed: false, reason: `Verifier failed: ${error}`, layer: "llm", signals }
        }
    }
}
