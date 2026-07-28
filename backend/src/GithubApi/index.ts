import { Octokit } from "octokit";
import logger from "../logger.js";

export class GithubApi{
    private octokit:Octokit
    // Per-instance token: the signed-in user's OAuth token when available,
    // otherwise the global GITHUB_TOKEN fallback.
    public readonly token: string | undefined
    constructor(token?: string){
        this.token = token ?? process.env.GITHUB_TOKEN
        this.octokit = new Octokit({auth:this.token})
    }

    parseIssueUrl(issueUrl:string){
        const parts = issueUrl.replace("https://github.com/","").split("/")
        return {
            owner:parts[0] ?? "",
            repo:parts[1] ?? "",
            issueNumber:parseInt(parts[3] ?? "0")
        }
    }

    async getDefaultBranch(issueUrl: string): Promise<string> {
        const { owner, repo } = this.parseIssueUrl(issueUrl)
        const { data } = await this.octokit.rest.repos.get({ owner, repo })
        return data.default_branch
    }

    async getIssue(issueUrl:string){
        try {
            const {owner,repo,issueNumber} = this.parseIssueUrl(issueUrl)
            const {data} = await this.octokit.rest.issues.get({
                owner,repo,issue_number:issueNumber
            })
            logger.info("Issue: "+data.title)
            return data
        } catch (error) {
            logger.error("Error getting issue: "+error)
            throw error
        }
    }

    async createBranch(issueUrl:string, branchName:string, baseBranch = "main"){
        try {
            const {owner,repo} = this.parseIssueUrl(issueUrl)
            const {data:ref} = await this.octokit.rest.git.getRef({
                owner,repo,ref:`heads/${baseBranch}`
            })
            await this.octokit.rest.git.createRef({owner,repo,ref:`refs/heads/${branchName}`,sha:ref.object.sha})
            logger.info("Branch created: "+branchName)
        } catch (error) {
            logger.error("Error creating branch: "+error)
            throw error
        }
    }

    async openPR(issueUrl:string, branchName:string, baseBranch: string, title:string, body:string){
        try {
            const {owner,repo} = this.parseIssueUrl(issueUrl)
            const {data} = await this.octokit.rest.pulls.create({
                owner,repo,title,body,head:branchName,base:baseBranch
            })
            logger.info("PR opened: "+data.html_url)
            return data
        } catch (error) {
            logger.error("Error opening PR: "+error)
            throw error
        }
    }
}
