import type { Request, Response, NextFunction } from "express"
import { SessionStore, SESSION_COOKIE, type SessionData } from "../auth/session.js"

// Augment Express request with the resolved session.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      session?: SessionData
    }
  }
}

/**
 * Attaches the authenticated session (if any) to req.session.
 * Resolves auth in this order:
 *   1. httpOnly session cookie
 *   2. short-lived stream token in ?token= (for SSE EventSource)
 */
export function attachSession(sessionStore: SessionStore) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const cookieSid = req.cookies?.[SESSION_COOKIE] as string | undefined
      let sessionId = cookieSid

      if (!sessionId && typeof req.query.token === "string") {
        const resolved = await sessionStore.resolveStreamToken(req.query.token)
        if (resolved) sessionId = resolved
      }

      if (sessionId) {
        const session = await sessionStore.get(sessionId)
        if (session) req.session = session
      }
    } catch {
      /* ignore — treated as unauthenticated */
    }
    next()
  }
}

/**
 * Requires an authenticated session. Falls back to the legacy shared API_TOKEN
 * (Bearer header or ?token=) so scripts/benchmarks keep working.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (req.session) return next()

  const token = process.env.API_TOKEN
  if (token) {
    const header = req.headers.authorization
    if (header === `Bearer ${token}`) return next()
    if (req.query.token === token) return next()
  }

  // If no session AND no API_TOKEN configured, allow through in dev.
  if (!token && process.env.NODE_ENV !== "production") return next()

  res.status(401).json({ error: "Unauthorized" })
}
