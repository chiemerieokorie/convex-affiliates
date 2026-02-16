import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "edge-runtime",
    typecheck: {
      tsconfig: "./tsconfig.test.json",
      exclude: ["**/consumer-test/**", "**/node_modules/**"],
    },
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.examples/**",
      "**/consumer-test/**",
    ],
  },
});
