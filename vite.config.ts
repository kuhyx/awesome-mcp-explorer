/// <reference types="vitest/config" />
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// base: "./" keeps the built bundle path-agnostic so it works from a GitHub
// Pages project subpath (/awesome-mcp-explorer/) and from file:// alike.
export default defineConfig({
  base: "./",
  plugins: [react()],
  test: {
    coverage: {
      exclude: [
        "src/main.tsx", // DOM bootstrap: nothing to assert that jsdom can see
        "src/test/**",
        "src/**/*.d.ts",
        "scripts/build-dataset.ts", // thin CLI wiring; its parts are covered
      ],
      include: ["src/**/*.{ts,tsx}", "scripts/**/*.ts"],
      provider: "v8",
      thresholds: {
        branches: 100,
        functions: 100,
        lines: 100,
        statements: 100,
      },
    },
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
  },
});
