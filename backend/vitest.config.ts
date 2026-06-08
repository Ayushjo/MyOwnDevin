import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/evals/**/*.eval.ts"],
    globals: false,
    testTimeout: 15_000,
  },
})
