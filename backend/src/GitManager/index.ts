import { simpleGit } from "simple-git"
import type { SimpleGit } from "simple-git"
import logger from "../logger.js"
import { getTaskPath } from "../utils/taskPath.js"

const AGENT_AUTHOR = "Devin Agent <agent@devin.local>"

export class GitManager {
    private git: SimpleGit

    constructor() {
        this.git = simpleGit()
    }

    repoAt(path: string): SimpleGit {
        return simpleGit(path)
    }

    async clone(repoUrl: string, taskId: string) {
        try {
            const clonePath = getTaskPath(taskId)
            await this.git.clone(repoUrl, clonePath)
            return clonePath
        } catch (error) {
            logger.error(`Error cloning repository: ${error}`)
            throw error
        }
    }

    /** Stage all changes and commit. Agent writes files via write_file but rarely calls git_commit. */
    async commitAll(
        repoPath: string,
        message: string,
    ): Promise<{ committed: boolean; files: string[] }> {
        const git = simpleGit(repoPath)
        await git.add("-A")
        const staged = (await git.diff(["--cached", "--name-only"])).trim()
        if (!staged) {
            logger.warn("commitAll: nothing staged", { repoPath })
            return { committed: false, files: [] }
        }
        const files = staged.split("\n").map((f) => f.trim()).filter(Boolean)
        await git.commit(message, undefined, { "--author": AGENT_AUTHOR })
        logger.info(`commitAll: committed ${files.length} file(s)`, { files })
        return { committed: true, files }
    }

    /** Files changed on this branch vs the base branch (committed only). */
    async changedFilesVs(repoPath: string, baseBranch: string): Promise<string[]> {
        const git = simpleGit(repoPath)
        const diff = (await git.diff([`${baseBranch}...HEAD`, "--name-only"])).trim()
        return diff ? diff.split("\n").map((f) => f.trim()).filter(Boolean) : []
    }

    async push(repoPath: string, branchName: string) {
        try {
            const repoGit = simpleGit(repoPath)
            const result = await repoGit.push(["--set-upstream", "origin", branchName])
            return result
        } catch (error) {
            logger.error(`Error pushing repository: ${error}`)
            throw error
        }
    }
}
