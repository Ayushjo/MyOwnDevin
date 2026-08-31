import { describe, it, expect, vi, beforeEach } from "vitest"

const mockFindMany = vi.fn()
const mockFindFirst = vi.fn()

vi.mock("../../db/prisma.js", () => ({
  isDatabaseEnabled: () => true,
  getPrisma: () => ({
    task: {
      findMany: mockFindMany,
      findFirst: mockFindFirst,
    },
  }),
}))

describe("taskRepository scoping", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("lists tasks only for the given user", async () => {
    mockFindMany.mockResolvedValue([
      {
        id: "t1",
        issueUrl: "https://github.com/o/r/issues/1",
        issueTitle: "Bug",
        issueNumber: 1,
        status: "done",
        createdAt: new Date("2025-01-01"),
        updatedAt: new Date("2025-01-02"),
        prUrl: null,
      },
    ])

    const { listTasksForUser } = await import("../taskRepository.js")
    const tasks = await listTasksForUser("user-a", 10)

    expect(tasks).toHaveLength(1)
    expect(tasks[0]?.taskId).toBe("t1")
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-a" }, take: 10 }),
    )
  })

  it("checks task ownership", async () => {
    mockFindFirst.mockResolvedValue({ id: "t1" })

    const { userOwnsTask } = await import("../taskRepository.js")
    const owns = await userOwnsTask("user-a", "t1")

    expect(owns).toBe(true)
    expect(mockFindFirst).toHaveBeenCalledWith({
      where: { id: "t1", userId: "user-a" },
      select: { id: true },
    })
  })
})
