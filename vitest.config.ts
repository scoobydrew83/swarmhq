import { defineConfig } from "vitest/config";

export default defineConfig({
  define: {
    __VERSION__: JSON.stringify("0.0.0-test"),
  },
  test: {
    include: ["packages/*/src/**/*.test.ts"],
    environment: "node",
    coverage: {
      provider: "v8",
      include: ["packages/*/src/**/*.ts"],
      exclude: ["packages/*/src/**/*.test.ts", "packages/ui/**"],
    },
  },
});
