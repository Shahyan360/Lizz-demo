import { defineConfig } from "vitest/config";
import path from "path";

/**
 * Vitest configuration.
 *
 * - `node` environment: these are backend/library tests, no DOM.
 * - `@/` alias mirrors tsconfig so tests import app modules the same way the app
 *   does (and so `vi.mock("@/...")` resolves to the same module the source imports
 *   via its relative path).
 * - Reporters: human-readable `default` for the console PLUS `junit`, written to
 *   `test-results/junit.xml`. CircleCI ingests that file via `store_test_results`
 *   so failures show up on the Tests tab, not just in raw log output.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Point the few-shot corpus reader at the committed fixture. Must be set here
    // (before any test module loads) because category-samples.ts resolves the
    // directory once at import time.
    env: {
      CATEGORY_SAMPLES_DIR: path.resolve(__dirname, "tests/fixtures/by-category"),
    },
    reporters: ["default", "junit"],
    outputFile: {
      junit: "test-results/junit.xml",
    },
    // Integration tests talk to a real MySQL and share tables; keep the file
    // order deterministic and avoid cross-file DB races.
    fileParallelism: false,
  },
});
