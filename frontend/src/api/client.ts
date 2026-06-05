// All requests go through Vite's dev proxy (/api → localhost:3500).
// In production, point VITE_API_URL to your backend origin.
const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? ''

export async function createTask(issueUrl: string): Promise<{ taskId: string }> {
  const res = await fetch(`${BASE}/api/task`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ issueUrl }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(body || `HTTP ${res.status}`)
  }
  return res.json() as Promise<{ taskId: string }>
}

/** Opens an SSE stream for a running task. Caller is responsible for .close(). */
export function openTaskStream(taskId: string): EventSource {
  return new EventSource(`${BASE}/api/task/${taskId}/stream`)
}

/** Returns the current checkpoint state, or null if the task is done / not found. */
export async function getTaskState(taskId: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(`${BASE}/api/task/${taskId}`)
    if (res.status === 404) return null
    if (!res.ok) return null
    return res.json() as Promise<Record<string, unknown>>
  } catch {
    return null
  }
}
