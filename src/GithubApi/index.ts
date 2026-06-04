import { Octokit } from "octokit";
import logger from "../logger.js";

export class GithubApi{
    private octokit:Octokit
    constructor(){
        this.octokit = new Octokit({auth:process.env.GITHUB_TOKEN})
    }

    parseIssueUrl(issueUrl:string){
        const parts = issueUrl.replace("https://github.com/","").split("/")
        logger.info("Parts: "+JSON.stringify(parts))
        return {
            owner:parts[0] ?? "",
            repo:parts[1] ?? "",
            issueNumber:parseInt(parts[3] ?? "0")
        }


    }
    async getIssue(issueUrl:string){
        try {
            const {owner,repo,issueNumber} = this.parseIssueUrl(issueUrl)
            const {data} = await this.octokit.rest.issues.get({
                owner,repo,issue_number:issueNumber
            })
            logger.info("Issue: "+JSON.stringify(data))
            return data
        } catch (error) {
            logger.error("Error getting issue: "+error)
            throw error
            
        }
    }

    async createBranch(issueUrl:string,branchName:string){
        try {
            const {owner,repo,issueNumber} = this.parseIssueUrl(issueUrl)
            const {data:ref} = await this.octokit.rest.git.getRef({
                owner,repo,ref:`heads/main`
            }) 
            await this.octokit.rest.git.createRef({owner,repo,ref:`refs/heads/${branchName}`,sha:ref.object.sha})
            logger.info("Branch created: "+branchName)
            

        } catch (error) {
            logger.error("Error creating branch: "+error)
            throw error
            
        }
    }
    async openPR(issueUrl:string,branchName:string,title:string,body:string){
        try {
            const {owner,repo,issueNumber} = this.parseIssueUrl(issueUrl)
            const {data} = await this.octokit.rest.pulls.create({
                owner,repo,title,body,head:branchName,base:`main`
            })
            logger.info("PR opened: "+JSON.stringify(data))
            return data
            
        } catch (error) {
            logger.error("Error opening PR: "+error)
            throw error

            
        }

    }


}