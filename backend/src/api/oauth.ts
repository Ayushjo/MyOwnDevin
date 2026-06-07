import { Router } from "express"
import logger from "../logger.js"
import { SessionStore, SESSION_COOKIE } from "../auth/session.js"

const GITHUB_AUTHORIZE = "https://github.com/login/oauth/authorize"
const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token"
const GITHUB_USER_URL = "https://api.github.com/user"

function frontendUrl(): string {
  return process.env.FRONTEND_URL ?? "http://localhost:5173"
}

function backendUrl(): string {
  return process.env.BACKEND_URL ?? `http://localhost:${process.env.PORT ?? 3500}`
}

// Cookies must be cross-site (SameSite=None; Secure) in production so the SPA
// on another origin keeps the session; localhost uses Lax over http.
function cookieOptions() {
  const isProd = process.env.NODE_ENV === "production"
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: (isProd ? "none" : "lax") as "none" | "lax",
    maxAge: 1000 * 60 * 60 * 24 * 7,
    path: "/",
  }
}

export function createOAuthRouter(sessionStore: SessionStore) {
  const router = Router()

  // Step 1 — redirect the user to GitHub's consent screen.
  router.get("/github", (req, res) => {
    const clientId = process.env.GITHUB_CLIENT_ID
    if (!clientId) {
      return res.status(500).json({ error: "GitHub OAuth is not configured (missing GITHUB_CLIENT_ID)" })
    }
    const returnTo = typeof req.query.returnTo === "string" ? req.query.returnTo : "/dashboard"
    const state = Buffer.from(JSON.stringify({ returnTo, n: Date.now() })).toString("base64url")

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: `${backendUrl()}/api/auth/github/callback`,
      scope: "repo read:user",
      state,
      allow_signup: "true",
    })
    res.redirect(`${GITHUB_AUTHORIZE}?${params.toString()}`)
  })

  // Step 2 — GitHub redirects back with a code; exchange it for a token.
  router.get("/github/callback", async (req, res) => {
    const code = req.query.code as string | undefined
    const stateRaw = req.query.state as string | undefined
    let returnTo = "/dashboard"
    try {
      if (stateRaw) {
        const decoded = JSON.parse(Buffer.from(stateRaw, "base64url").toString("utf8"))
        if (typeof decoded.returnTo === "string") returnTo = decoded.returnTo
      }
    } catch {
      /* ignore malformed state */
    }

    if (!code) return res.redirect(`${frontendUrl()}/login?error=missing_code`)

    try {
      const tokenRes = await fetch(GITHUB_TOKEN_URL, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: process.env.GITHUB_CLIENT_ID,
          client_secret: process.env.GITHUB_CLIENT_SECRET,
          code,
          redirect_uri: `${backendUrl()}/api/auth/github/callback`,
        }),
      })
      const tokenJson = (await tokenRes.json()) as { access_token?: string; error?: string }
      const accessToken = tokenJson.access_token
      if (!accessToken) {
        logger.error("OAuth token exchange failed: " + JSON.stringify(tokenJson))
        return res.redirect(`${frontendUrl()}/login?error=token_exchange`)
      }

      const userRes = await fetch(GITHUB_USER_URL, {
        headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/vnd.github+json" },
      })
      const user = (await userRes.json()) as { login: string; name?: string; avatar_url: string }

      const sessionId = await sessionStore.create({
        login: user.login,
        ...(user.name ? { name: user.name } : {}),
        avatarUrl: user.avatar_url,
        accessToken,
        createdAt: new Date().toISOString(),
      })

      res.cookie(SESSION_COOKIE, sessionId, cookieOptions())
      logger.info("User signed in: " + user.login)
      res.redirect(`${frontendUrl()}${returnTo.startsWith("/") ? returnTo : "/dashboard"}`)
    } catch (error) {
      logger.error("OAuth callback error: " + error)
      res.redirect(`${frontendUrl()}/login?error=oauth_failed`)
    }
  })

  // Current user (public fields only).
  router.get("/me", (req, res) => {
    if (!req.session) return res.status(200).json({ user: null })
    const { login, name, avatarUrl } = req.session
    res.status(200).json({ user: { login, name, avatarUrl } })
  })

  // Short-lived token so EventSource (which can't send headers) can authenticate.
  router.get("/stream-token", async (req, res) => {
    const sid = req.cookies?.[SESSION_COOKIE] as string | undefined
    if (!sid) return res.status(401).json({ error: "Unauthorized" })
    const token = await sessionStore.issueStreamToken(sid)
    res.status(200).json({ token })
  })

  router.post("/logout", async (req, res) => {
    const sid = req.cookies?.[SESSION_COOKIE] as string | undefined
    if (sid) await sessionStore.destroy(sid)
    res.clearCookie(SESSION_COOKIE, { path: "/" })
    res.status(200).json({ ok: true })
  })

  return router
}
