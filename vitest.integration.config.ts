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
    /*
     * Mesma ordem do `vitest.config.ts`, e pelo mesmo motivo: o Vite para no
     * primeiro alias que casa. Com "@" na frente, "@/content/loader" viraria
     * "src/content/loader", que não existe. O mais específico vem primeiro.
     *
     * A barra depois do `@` também não é detalhe: sem ela, `/^@/` capturaria
     * `@prisma/client` e todo pacote com escopo.
     */
    alias: [
      {
        find: /^@\/content\//,
        replacement: `${fileURLToPath(new URL("./content", import.meta.url))}/`,
      },
      {
        find: /^@\/app\//,
        replacement: `${fileURLToPath(new URL("./app", import.meta.url))}/`,
      },
      {
        find: /^@\//,
        replacement: `${fileURLToPath(new URL("./src", import.meta.url))}/`,
      },
    ],
  },
});
