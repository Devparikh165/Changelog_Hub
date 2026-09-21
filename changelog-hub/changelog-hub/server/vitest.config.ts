import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./tests/setup-env.ts"],
    // Each file starts its own in-memory MongoDB; one file at a time keeps memory low.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000, // the very first run downloads a MongoDB binary
  },
});
