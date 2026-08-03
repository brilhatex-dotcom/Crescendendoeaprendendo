import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * Testes de integração — exigem Postgres com a migration aplicada.
 *
 * Separados do `vitest.config.ts` de propósito: `npm run verify` precisa rodar
 * em qualquer máquina, sem infraestrutura. Um teste que depende de banco dentro
 * do conjunto rápido é um teste que alguém acaba marcando como `skip`.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    // Compartilham as mesmas tabelas: em paralelo, um apaga o dado do outro.
    fileParallelism: false,
    testTimeout: 30_000,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@/content": fileURLToPath(new URL("./content", import.meta.url)),
    },
  },
});
