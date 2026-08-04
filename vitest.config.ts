import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "tests/**/*.test.ts", "content/**/*.test.ts"],
    exclude: ["node_modules", ".next", "tests/e2e/**", "tests/integration/**"],
  },
  resolve: {
    /*
     * Ordem importa: o Vite testa os alias na sequência declarada e para no
     * primeiro que casa. Com "@" na frente, "@/content/loader" viraria
     * "src/content/loader" — que não existe. O mais específico vem primeiro.
     */
    alias: [
      /*
       * A barra depois do `@` não é detalhe: sem ela, `/^@/` capturaria
       * `@node-rs/argon2` e todo pacote com escopo, redirecionando-os para
       * dentro de `src/`.
       */
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
