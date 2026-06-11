import path from "path";
import react from "@vitejs/plugin-react";
import { configDefaults, defineConfig } from "vitest/config";

const enforceCoverage = process.env.COVERAGE_ENFORCE !== "false";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "server-only": path.resolve(__dirname, "./src/test/server-only-stub.ts"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    passWithNoTests: true,
    // Playwright e2e specs live in ./e2e and must not be run by Vitest.
    exclude: [...configDefaults.exclude, "e2e/**"],
    coverage: {
      provider: "istanbul",
      reporter: ["text", "html", "lcov", "json-summary"],
      reportsDirectory: "./coverage/unit",
      exclude: [
        "src/test/**",
        "**/*.config.*",
        "next.config.ts",
        "scripts/**",
        ".next/**",
      ],
      ...(enforceCoverage
        ? {
            lines: 85,
            branches: 85,
            functions: 85,
            statements: 85,
          }
        : {}),
    },
  },
});