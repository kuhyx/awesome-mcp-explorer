/// <reference types="vitest/config" />
import { getViteConfig } from "astro/config";

// Node runs the pipeline, endpoints and Container renders; jsdom the elements.
const config = getViteConfig({
  test: {
    coverage: {
      exclude: ["src/test/**", "src/**/*.d.ts", "scripts/build-dataset.ts"],
      include: ["src/**/*.ts", "scripts/**/*.ts"],
      provider: "v8",
      thresholds: {
        branches: 100,
        functions: 100,
        lines: 100,
        statements: 100,
      },
    },
    projects: [
      {
        extends: true,
        test: {
          environment: "jsdom",
          exclude: ["src/pages/**"],
          globals: true,
          include: ["src/**/*.test.ts"],
          name: "app",
          setupFiles: ["./src/test/setup.ts"],
        },
      },
      {
        extends: true,
        test: {
          environment: "node",
          globals: true,
          include: ["scripts/**/*.test.ts", "src/pages/**/*.test.ts"],
          name: "pipeline",
        },
      },
    ],
  },
});

export default config;
