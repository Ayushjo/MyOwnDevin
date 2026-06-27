const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? ''
const AUTH_HEADERS: Record<string, string> = {}
const apiToken = import.meta.env.VITE_API_TOKEN as string | undefined
if (apiToken) AUTH_HEADERS['Authorization'] = `Bearer ${apiToken}`

// All requests send cookies so the httpOnly session works cross-origin.
const CREDENTIALS: RequestCredentials = 'include'

export const API_BASE = BASE

export async function createTask(issueUrl: string): Promise<{ taskId: string }> {
  const res = await fetch(`${BASE}/api/task`, {
    method: 'POST',
    credentials: CREDENTIALS,
    headers: { 'Content-Type': 'application/json', ...AUTH_HEADERS },
    body: JSON.stringify({ issueUrl }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(body || `HTTP ${res.status}`)
  }
  return res.json() as Promise<{ taskId: string }>
}

export function openTaskStream(taskId: string): EventSource {
  // EventSource can't send headers; pass the token via query param when present.
  const qs = apiToken ? `?token=${encodeURIComponent(apiToken)}` : ''
  return new EventSource(`${BASE}/api/task/${taskId}/stream${qs}`, { withCredentials: true })
}

export async function getTaskEvents(taskId: string) {
  try {
    const res = await fetch(`${BASE}/api/task/${taskId}/events`, { credentials: CREDENTIALS, headers: AUTH_HEADERS })
    if (!res.ok) return []
    return res.json()
  } catch {
    return []
  }
}

export async function getTaskState(taskId: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(`${BASE}/api/task/${taskId}`, { credentials: CREDENTIALS, headers: AUTH_HEADERS })
    if (res.status === 404) return null
    if (!res.ok) return null
    return res.json() as Promise<Record<string, unknown>>
  } catch {
    return null
  }
}

export async function getTaskMetrics(taskId: string) {
  const res = await fetch(`${BASE}/api/task/${taskId}/metrics`, { credentials: CREDENTIALS, headers: AUTH_HEADERS })
  if (!res.ok) return null
  return res.json()
}

export async function retryTask(taskId: string, issueUrl?: string) {
  const res = await fetch(`${BASE}/api/task/${taskId}/retry`, {
    method: 'POST',
    credentials: CREDENTIALS,
    headers: { ...AUTH_HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify(issueUrl ? { issueUrl } : {}),
  })
  if (!res.ok) throw new Error(`Retry failed: ${res.status}`)
  return res.json()
}

export async function listTasks() {
  const res = await fetch(`${BASE}/api/tasks`, { credentials: CREDENTIALS, headers: AUTH_HEADERS })
  if (!res.ok) return []
  return res.json()
}

export type StatsResponse = {
  total: number
  running: number
  done: number
  failed: number
  queued: number
}

export async function getStats(): Promise<StatsResponse | null> {
  try {
    const res = await fetch(`${BASE}/api/stats`, { credentials: CREDENTIALS, headers: AUTH_HEADERS })
    if (!res.ok) return null
    return res.json() as Promise<StatsResponse>
  } catch {
    return null
  }
}

/* ── Auth ── */
export type AuthUser = { login: string; name?: string; avatarUrl: string }

export async function getMe(): Promise<AuthUser | null> {
  try {
    const res = await fetch(`${BASE}/api/auth/me`, { credentials: CREDENTIALS, headers: AUTH_HEADERS })
    if (!res.ok) return null
    const data = await res.json()
    return data?.user ?? null
  } catch {
    return null
  }
}

export function githubLoginUrl(returnTo?: string): string {
  const qs = returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ''
  return `${BASE}/api/auth/github${qs}`
}

export async function logout(): Promise<void> {
  try {
    await fetch(`${BASE}/api/auth/logout`, { method: 'POST', credentials: CREDENTIALS, headers: AUTH_HEADERS })
  } catch {
    /* ignore */
  }
}
