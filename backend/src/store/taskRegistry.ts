import { Redis } from "ioredis";
import { Task } from '../api/types';

const redis = new Redis();
const taskRegistry: { [taskId: string]: Task } = {};

export function getTask(taskId: string): Task | undefined {
  return taskRegistry[taskId];
}

export function addTask(task: Task) {
  taskRegistry[task.id] = task;
}

export function updateTask(taskId: string, updates: Partial<Task>) {
  const task = getTask(taskId);
  if (task) {
    Object.assign(task, updates);
  }
}

export function getStats(): { totalTasks: number; completedTasks: number; cancelledTasks: number } {
  let totalTasks = 0;
  let completedTasks = 0;
  let cancelledTasks = 0;
  for (const task of Object.values(taskRegistry)) {
    totalTasks++;
    if (task.status === 'completed') {
      completedTasks++;
    } else if (task.status === 'cancelled') {
      cancelledTasks++;
    }
  }
  return { totalTasks, completedTasks, cancelledTasks };
}
