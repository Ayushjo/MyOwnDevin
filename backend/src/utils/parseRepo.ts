export function parseRepoFromIssueUrl(issueUrl: string): { owner: string | null; repo: string | null } {
  const m = issueUrl.match(/github\.com\/([^/]+)\/([^/]+)/i)
  if (!m) return { owner: null, repo: null }
  return { owner: m[1] ?? null, repo: m[2]?.replace(/\.git$/, "") ?? null }
}
