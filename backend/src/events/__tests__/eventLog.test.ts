import { describe, it, expect, vi, beforeEach } from "vitest"
import type { TaskEvent } from "../../events/types.js"

const mockIsTerminal = vi.fn()
const mockListFromDb = vi.fn()
const mockAppendToDb = vi.fn()

vi.mock("../../repositories/taskRepository.js", () => ({
  isTaskTerminalInDb: (...args: unknown[]) => mockIsTerminal(...args),
}))

vi.mock("../../repositories/eventRepository.js", () => ({
  appendEventToDb: (...args: unknown[]) => mockAppendToDb(...args),
  listEventsFromDb: (...args: unknown[]) => mockListFromDb(...args),
  clearEventsInDb: vi.fn(),
}))

vi.mock("../../db/prisma.js", () => ({
  isDatabaseEnabled: () => true,
}))

vi.mock("../../config/redis.js", () => ({
  createRedisClient: () => ({
    rpush: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(1),
    lrange: vi.fn().mockResolvedValue([]),
    llen: vi.fn().mockResolvedValue(0),
    del: vi.fn().mockResolvedValue(1),
  }),
}))

describe("EventLog", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("replays completed task events from Postgres", async () => {
    const pgEvents: TaskEvent[] = [
      { type: "phase_start", phase: "planning", timestamp: "2025-01-01T00:00:00Z" },
      { type: "task_complete", prUrl: "https://github.com/o/r/pull/1", timestamp: "2025-01-01T00:01:00Z" },
    ]
    mockIsTerminal.mockResolvedValue(true)
    mockListFromDb.mockResolvedValue(pgEvents)

    const { EventLog } = await import("../../events/eventLog.js")
    const log = new EventLog()
    const events = await log.range("task-1")

    expect(events).toEqual(pgEvents)
    expect(mockListFromDb).toHaveBeenCalledWith("task-1")
  })

  it("dual-writes events to Postgres on append", async () => {
    mockIsTerminal.mockResolvedValue(false)
    const event: TaskEvent = { type: "step_start", step: { id: 1, title: "t", description: "d" }, timestamp: "2025-01-01T00:00:00Z" }

    const { EventLog } = await import("../../events/eventLog.js")
    const log = new EventLog()
    const seq = await log.append("task-2", event)

    expect(seq).toBe(0)
    expect(mockAppendToDb).toHaveBeenCalledWith("task-2", 0, event)
  })
})
