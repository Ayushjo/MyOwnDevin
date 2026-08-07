import logger from "../logger.js";
import { SandboxManager } from "../sandbox/index.js";

type ToolResult = {
    success: boolean;
    output: string;
    error?: string;
}

function normalizeWorkspacePath(filePath: string): string {
    const trimmed = filePath.trim();
    if (trimmed.startsWith("/workspace")) return trimmed;
    if (trimmed.startsWith("workspace/")) return `/${trimmed}`;
    if (trimmed.startsWith("/")) return `/workspace${trimmed}`;
    return `/workspace/${trimmed.replace(/^\.\//, "")}`;
}

export default class ToolExecutor {
    private sandbox: SandboxManager;
    private recentCommands = new Set<string>();
    private recentSearches = new Map<string, string>();
    private baselineSha: string | null = null;
    /** Repo-relative paths touched by write_file this step (e.g. backend/src/foo.ts). */
    private writtenFiles = new Set<string>();

    constructor(private containerId: string) {
        this.sandbox = new SandboxManager();
    }

    setBaseline(sha: string): void {
        this.baselineSha = sha.trim();
    }

    getWrittenFiles(): string[] {
        return [...this.writtenFiles];
    }

    resetCommandCache(): void {
        this.recentCommands.clear();
        this.recentSearches.clear();
        this.writtenFiles.clear();
    }

    /** Repo-relative path without /workspace/ prefix. */
    private toRepoPath(absPath: string): string {
        return absPath.replace(/^\/workspace\//, "").replace(/^\.\//, "");
    }

    async run_shell(command: string, timeoutMs = 30_000): Promise<ToolResult> {
        const normalized = command.trim().replace(/\s+/g, " ");

        if (/\bnpm\s+run\s+dev\b/.test(normalized) || /\bnpm\s+start\b/.test(normalized) || /\bnode\s+.*index/.test(normalized)) {
            return {
                success: false,
                output: "",
                error: "Long-running servers are blocked. Use 'npm run build' or 'npx tsc -b --noEmit' to verify instead.",
            };
        }

        let effective = normalized;
        if (/^npm\b/.test(normalized) && !/cd\s+\S+/.test(normalized)) {
            effective = `cd /workspace/backend && ${normalized}`;
        }
        if (/^cd\s+backend\s*&&/.test(normalized)) {
            effective = normalized.replace(/^cd\s+backend/, "cd /workspace/backend");
        }

        // Volatile inspection commands must never be cached — their output changes
        // as the working tree/commits evolve (e.g. verifier diff checks per step).
        const isVolatile = /\bgit\s+(diff|status|log|rev-parse|show)\b/.test(effective);

        if (!isVolatile && this.recentCommands.has(effective)) {
            return {
                success: true,
                output: `Skipped — this command already ran successfully: ${effective}`,
            };
        }

        try {
            const result = await this.sandbox.exec(this.containerId, effective, timeoutMs);
            if (result.exitCode !== 0) {
                return { success: false, output: result.stdout, error: result.stderr || `exit code ${result.exitCode}` };
            }
            if (!isVolatile) this.recentCommands.add(effective);
            const output = result.stdout || result.stderr || "Command ran successfully with no output.";
            return { success: true, output };
        } catch (error) {
            logger.error(`Error running shell: ${error}`);
            return { success: false, output: "", error: `Error running shell: ${error}` };
        }
    }

    async read_file(filePath: string, timeoutMs = 30_000): Promise<ToolResult> {
        const normalized = normalizeWorkspacePath(filePath);
        const escaped = normalized.replace(/'/g, "'\\''");
        return this.run_shell(`cat '${escaped}'`, timeoutMs);
    }

    async write_file(filePath: string, content: string, timeoutMs = 30_000): Promise<ToolResult> {
        try {
            const b64 = Buffer.from(content, "utf-8").toString("base64");
            const normalized = normalizeWorkspacePath(filePath);
            const escaped = normalized.replace(/'/g, "'\\''");
            const result = await this.sandbox.exec(
                this.containerId,
                `mkdir -p "$(dirname '${escaped}')" && echo '${b64}' | base64 -d > '${escaped}'`,
                timeoutMs
            );
            if (result.exitCode !== 0) {
                return { success: false, output: "", error: result.stderr || `exit code ${result.exitCode}` };
            }
            this.writtenFiles.add(this.toRepoPath(normalized));
            return { success: true, output: `Wrote ${content.split("\n").length} lines to ${normalized}` };
        } catch (error) {
            return { success: false, output: "", error: `Error writing file: ${error}` };
        }
    }

    async git_commit(message: string, timeoutMs = 30_000): Promise<ToolResult> {
        const escaped = message.replace(/'/g, "'\\''");
        return this.run_shell(`git add -A && git commit -m '${escaped}'`, timeoutMs);
    }

    async git_checkout(branch: string, timeoutMs = 30_000): Promise<ToolResult> {
        const escaped = branch.replace(/'/g, "'\\''");
        return this.run_shell(`git checkout -b '${escaped}' 2>/dev/null || git checkout '${escaped}'`, timeoutMs);
    }

    async search_code(query: string, searchPath = "/workspace", maxResults = 30): Promise<ToolResult> {
        const normalizedPath = normalizeWorkspacePath(searchPath);
        const limit = Math.min(Math.max(1, maxResults), 50);
        const key = `${query}::${normalizedPath}::${limit}`;
        if (this.recentSearches.has(key)) {
            return {
                success: true,
                output: `${this.recentSearches.get(key)}\n\n(Repeat search — you already have this. Use write_file to make code changes now.)`,
            };
        }

        const escapedQuery = query.replace(/'/g, "'\\''");
        const escapedPath = normalizedPath.replace(/'/g, "'\\''");
        const cmd = `rg --max-count 3 --max-filesize 1M -l '${escapedQuery}' '${escapedPath}' 2>/dev/null | head -${limit} || grep -rl '${escapedQuery}' '${escapedPath}' 2>/dev/null | head -${limit}`;
        const result = await this.run_shell(cmd);
        const output = (!result.success && !result.output) ? "No matches found." : (result.output || "No matches found.");
        this.recentSearches.set(key, output);
        return { success: true, output };
    }

    async print_tree(dirPath = "/workspace", depth = 2): Promise<ToolResult> {
        const normalized = normalizeWorkspacePath(dirPath);
        const d = Math.min(Math.max(1, Math.floor(depth)), 5);
        const escaped = normalized.replace(/'/g, "'\\''");
        const cmd = `find '${escaped}' -maxdepth ${d} \\( -path '*/.git/*' -o -path '*/node_modules/*' \\) -prune -o -print 2>/dev/null | head -100`;
        return this.run_shell(cmd, 15_000);
    }

    async view_file(filePath: string, startLine = 1, endLine?: number): Promise<ToolResult> {
        const end = endLine ?? startLine + 99;
        const normalized = normalizeWorkspacePath(filePath);
        const escaped = normalized.replace(/'/g, "'\\''");
        return this.run_shell(`sed -n '${startLine},${end}p' '${escaped}' | nl -ba -v ${startLine}`, 15_000);
    }

    async list_dir(dirPath = "/workspace", depth?: number): Promise<ToolResult> {
        if (depth && depth > 1) {
            return this.print_tree(dirPath, depth);
        }
        const normalized = normalizeWorkspacePath(dirPath);
        const escaped = normalized.replace(/'/g, "'\\''");
        return this.run_shell(`ls -la '${escaped}' 2>/dev/null || echo 'Directory not found'`, 10_000);
    }

    // Diff against the pre-agent baseline. When a SHA is set (captured on the host
    // after checkout), use it directly. Otherwise fall back to the devin-baseline tag
    // if present in the container, or HEAD as a last resort.
    // All commands are prefixed with `cd /workspace &&` so they run in the right dir
    // regardless of the container's WORKDIR.
    private baselineRef(): string {
        if (this.baselineSha) return this.baselineSha;
        return "$(cd /workspace && git rev-parse -q --verify devin-baseline >/dev/null 2>&1 && echo devin-baseline || echo HEAD)";
    }

    // run_shell substitutes a placeholder string when a command produces no
    // stdout/stderr. For diff helpers that means "no changes" — strip it so the
    // placeholder never leaks in as a fake filename or fake diff content.
    private cleanDiffOutput(output: string): string {
        const cleaned = output
            .replace(/Command ran successfully with no output\./g, "")
            .replace(/^Skipped —.*$/gm, "")
            .trim();
        return cleaned;
    }

    async gitDiffNames(): Promise<string[]> {
        const ref = this.baselineRef();
        // git diff alone misses NEW untracked files (common when write_file creates a file
        // the agent never git-adds). Merge tracked diffs + untracked + write_file ledger.
        const result = await this.run_shell(
            `cd /workspace && {
                git diff --name-only ${ref} 2>/dev/null
                git ls-files --others --exclude-standard 2>/dev/null
            }`,
        );
        const cleaned = this.cleanDiffOutput(result.output);
        const fromGit = cleaned
            ? [...new Set(cleaned.split("\n").map((l) => l.trim()).filter(Boolean))]
            : [];
        const all = [...new Set([...fromGit, ...this.writtenFiles])];
        logger.info(`[gitDiffNames] baseline=${ref} git=${fromGit.length} written=${this.writtenFiles.size} → [${all.join(", ")}]`);
        return all;
    }

    /** Extra context when verification fails — helps diagnose empty-diff false negatives. */
    async gitDiffDebug(): Promise<string> {
        const ref = this.baselineRef();
        const status = await this.run_shell("cd /workspace && git status --porcelain 2>/dev/null | head -20");
        const head = await this.run_shell("cd /workspace && git rev-parse HEAD 2>/dev/null");
        return `baseline=${ref} HEAD=${head.output.trim()} status=${status.output.trim().replace(/\n/g, "; ") || "(clean)"} written=[${[...this.writtenFiles].join(", ")}]`;
    }

    async gitDiffStat(): Promise<string> {
        const ref = this.baselineRef();
        const result = await this.run_shell(
            `cd /workspace && {
                git diff --stat ${ref} -- '*.ts' '*.tsx' '*.js' '*.jsx' 2>/dev/null
                git ls-files --others --exclude-standard -- '*.ts' '*.tsx' '*.js' '*.jsx' 2>/dev/null | sed 's/^/?? /'
            }`,
        );
        const cleaned = this.cleanDiffOutput(result.output);
        if (cleaned) return cleaned;
        if (this.writtenFiles.size) {
            return `${this.writtenFiles.size} file(s) written via write_file (may be untracked)`;
        }
        return "No changes";
    }

    async gitDiff(): Promise<string> {
        const ref = this.baselineRef();
        const result = await this.run_shell(`cd /workspace && git diff ${ref} 2>/dev/null`);
        return this.cleanDiffOutput(result.output);
    }
}
