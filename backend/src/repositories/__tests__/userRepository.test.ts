import { describe, it, expect, vi, beforeEach } from "vitest"

const mockUpsert = vi.fn()
const mockFindUnique = vi.fn()
const mockCreate = vi.fn()

vi.mock("../../db/prisma.js", () => ({
  isDatabaseEnabled: () => true,
  getPrisma: () => ({
    user: { upsert: mockUpsert, findUnique: mockFindUnique },
    plan: { findUnique: vi.fn().mockResolvedValue({ id: "plan-free", tier: "free" }) },
    subscription: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: mockCreate,
    },
  }),
}))

describe("userRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUpsert.mockResolvedValue({ id: "user-1", login: "octocat" })
  })

  it("upserts user by github id and returns user id", async () => {
    const { upsertUserByGithubId } = await import("../userRepository.js")
    const id = await upsertUserByGithubId({
      githubId: BigInt(42),
      login: "octocat",
      name: "Octo",
      avatarUrl: "https://avatars.githubusercontent.com/u/42",
    })
    expect(id).toBe("user-1")
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { githubId: BigInt(42) },
        create: expect.objectContaining({ login: "octocat" }),
      }),
    )
    expect(mockCreate).toHaveBeenCalled()
  })
})
