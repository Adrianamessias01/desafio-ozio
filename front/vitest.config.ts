import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Separado do vite.config.ts: os testes unitários não precisam do plugin do React Router.
export default defineConfig({
  resolve: {
    alias: { "~": fileURLToPath(new URL("./app", import.meta.url)) },
  },
  test: {
    include: ["app/**/*.test.ts"],
  },
});
