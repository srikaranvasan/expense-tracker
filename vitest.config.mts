import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

/**
 * Four projects with different needs:
 *  - unit:        pure domain/lib logic, no I/O
 *  - integration: real ephemeral MongoDB, runs serially
 *  - ui:          component tests in jsdom
 *  - offline:     local repositories against a real IndexedDB implementation
 */
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    projects: [
      {
        resolve: { tsconfigPaths: true },
        test: {
          name: "unit",
          environment: "node",
          globals: true,
          include: ["src/**/*.test.ts", "tests/unit/**/*.test.ts"],
          exclude: ["**/node_modules/**", "tests/integration/**", "tests/e2e/**"],
          setupFiles: ["tests/setup/unit-setup.ts"],
        },
      },
      {
        resolve: { tsconfigPaths: true },
        test: {
          name: "integration",
          environment: "node",
          globals: true,
          include: ["tests/integration/**/*.test.ts"],
          setupFiles: ["tests/setup/integration-setup.ts"],
          // Booting an in-memory replica set per file would be wasteful.
          fileParallelism: false,
          testTimeout: 60_000,
          hookTimeout: 180_000,
        },
      },
      {
        plugins: [react()],
        resolve: { tsconfigPaths: true },
        test: {
          name: "ui",
          environment: "jsdom",
          globals: true,
          include: ["src/**/*.test.tsx", "tests/ui/**/*.test.tsx"],
          setupFiles: ["tests/setup/ui-setup.ts"],
        },
      },
      {
        resolve: { tsconfigPaths: true },
        test: {
          name: "offline",
          // Dexie needs a real IndexedDB implementation; fake-indexeddb provides one
          // in Node, so the local repositories are exercised for real rather than
          // against a mock that cannot reproduce transaction semantics.
          environment: "node",
          globals: true,
          include: ["tests/offline/**/*.test.ts"],
          setupFiles: ["tests/setup/offline-setup.ts"],
        },
      },
    ],
  },
});
