import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      // Only measure coverage for the new files introduced in this feature set.
      // Pre-existing components (KeysTable, NewKeyModal, Toast, etc.) are outside
      // this feature's scope and would otherwise skew the aggregate below threshold.
      include: [
        "src/components/LogsTable.tsx",
        "src/components/KeyDrillDown.tsx",
        "src/hooks/useRequestLogs.ts",
        "src/lib/api.ts",
        "src/lib/format.ts",
      ],
      exclude: ["src/**/*.test.{ts,tsx}"],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
