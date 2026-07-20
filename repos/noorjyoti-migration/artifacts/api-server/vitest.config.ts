import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    testTimeout: 20_000,
    hookTimeout: 20_000,
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    server: {
      deps: {
        external: [/pg(-pool)?$/, /^pg-cloudflare$/],
      },
    },
  },
  resolve: {
    // Match the workspace tsconfig so @workspace/* packages resolve to source.
    conditions: ["workspace", "node", "require", "default"],
  },
  ssr: {
    external: ["pg", "pg-pool", "pg-cloudflare", "pg-native"],
  },
});
