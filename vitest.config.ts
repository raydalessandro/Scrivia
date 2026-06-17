// vitest.config.ts — harness di test di Scrivia (M1, blindatura processi).
// Decisioni (vedi docs/TEST_SPEC.md §0):
//  - Runner: Vitest. Alias "@/" = root, come tsconfig ("paths").
//  - environment: "node" di default (la logica di lib/ è pura TS).
//  - jsdom SOLO per i pochi test di componenti (§6): si attiva per-file con
//    il docblock  // @vitest-environment jsdom  in cima al file, così i test
//    "node" restano leggeri.
//  - Niente rete: il layer AI (§4) si testa con fetch mockato (vi.stubGlobal).

import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Mirror di tsconfig: "@/<path>" -> "<root>/<path>".
    alias: [{ find: /^@\//, replacement: resolve(root) + "/" }],
  },
  test: {
    environment: "node",
    globals: false,
    include: ["test/**/*.test.ts", "test/**/*.test.tsx"],
    // I file di parità esistenti stampano molto su console: non è un problema.
  },
});
