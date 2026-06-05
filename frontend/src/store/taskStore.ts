import type { Task } from '../types/task'

// StoredTask is the same shape as Task — persisted to localStorage so
// the Dashboard works across page refreshes without a backend list endpoint.
export type StoredTask = Task

const LS_KEY = 'devin_tasks'

function read(): StoredTask[] {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? '[]') as StoredTask[]
  } catch {
    return []
  }
}

function write(tasks: StoredTask[]): void {
  localStorage.setItem(LS_KEY, JSON.stringify(tasks))
}

export function getTasks(): StoredTask[] {
  return read()
}

export function getTask(id: string): StoredTask | undefined {
  return read().find(t => t.id === id)
}

export function addTask(task: StoredTask): void {
  const tasks = read()
  tasks.unshift(task)
  write(tasks)
}

export function updateTask(id: string, updates: Partial<StoredTask>): void {
  const tasks = read()
  const idx = tasks.findIndex(t => t.id === id)
  if (idx !== -1) {
    tasks[idx] = { ...tasks[idx]!, ...updates }
    write(tasks)
  }
}
