import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    setupFiles: ["./vitest.setup.ts"],
    testTimeout: 15000,
    // Default hookTimeout (10s) is too tight for a beforeAll that opens a
    // fresh Postgres connection and does several sequential creates against
    // a remote (Supabase) database — bump it so a slow-but-working
    // connection doesn't get mistaken for a broken one.
    hookTimeout: 30000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
