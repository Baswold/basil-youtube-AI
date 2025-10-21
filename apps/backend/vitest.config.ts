import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
    exclude: ["node_modules", "dist"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        "dist/",
        "**/*.test.ts",
        "**/*.config.ts",
      ],
    },
    testTimeout: 10000,
  },
  resolve: {
    alias: {
      "@basil/shared": path.resolve(__dirname, "../../packages/shared/src"),
    },
  },
});
