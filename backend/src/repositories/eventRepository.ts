import type { TaskEvent } from "../events/types.js"
import { getPrisma, isDatabaseEnabled } from "../db/prisma.js"
import logger from "../logger.js"

export async function appendEventToDb(
  taskId: string,
  sequence: number,
  event: TaskEvent,
): Promise<void> {
  if (!isDatabaseEnabled()) return

  try {
    await getPrisma().taskEvent.create({
      data: {
        taskId,
        sequence,
        eventType: event.type,
        payload: event as object,
      },
    })
  } catch (error) {
    logger.error(`Failed to persist event to Postgres: ${error instanceof Error ? error.message : error}`, {
      taskId,
      sequence,
      type: event.type,
    })
  }
}

export async function listEventsFromDb(taskId: string): Promise<TaskEvent[]> {
  if (!isDatabaseEnabled()) return []

  const rows = await getPrisma().taskEvent.findMany({
    where: { taskId },
    orderBy: { sequence: "asc" },
  })
  return rows.map((row) => row.payload as TaskEvent)
}

export async function clearEventsInDb(taskId: string): Promise<void> {
  if (!isDatabaseEnabled()) return
  await getPrisma().taskEvent.deleteMany({ where: { taskId } })
}

export async function countEventsInDb(taskId: string): Promise<number> {
  if (!isDatabaseEnabled()) return 0
  return getPrisma().taskEvent.count({ where: { taskId } })
}
