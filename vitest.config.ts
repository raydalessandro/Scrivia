import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Test unitari del TS puro in lib/ (engine, comandi, layer AI).
// Alias "@/..." come in tsconfig, così gli import combaciano col resto del repo.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
