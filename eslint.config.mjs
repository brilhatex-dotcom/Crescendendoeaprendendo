import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
});

/**
 * Regras que sustentam a Constituição no nível do código.
 * docs/01-arquitetura.md §8 · Bíblia Vol. 1 Cap. 1
 */
const config = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),

  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "src/generated/**",
      "next-env.d.ts",
    ],
  },

  {
    rules: {
      // ── Sem código provisório (Bíblia Cap. 0 §6) ──────────────────────────
      // Funcionalidade não pronta fica atrás de feature flag desligada,
      // nunca como comentário de promessa.
      //
      // `location: "start"` e não "anywhere": este código é comentado em
      // português, e "todo/toda" é palavra corrente ("toda escrita econômica",
      // "todo Json tem schema Zod"). Com "anywhere" a regra proibia prosa
      // legítima e empurrava para comentários piores — o oposto do que ela
      // existe para conseguir. Marcador de trabalho pendente é escrito no
      // início do comentário por convenção universal (`// TODO: ...`), que é
      // exatamente o que continua barrado.
      "no-warning-comments": [
        "error",
        { terms: ["todo", "fixme", "xxx", "hack"], location: "start" },
      ],

      // ── Segurança (docs/09 §5) ────────────────────────────────────────────
      // XSS: React já escapa. A exceção precisa de sanitização isolada e revisada.
      "react/no-danger": "error",
      "no-eval": "error",
      "no-implied-eval": "error",

      // ── Tipagem honesta ───────────────────────────────────────────────────
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/ban-ts-comment": [
        "error",
        { "ts-ignore": true, "ts-expect-error": "allow-with-description" },
      ],

      // ── Acessibilidade (V6: inclusão é padrão, não recurso) ────────────────
      "jsx-a11y/alt-text": "error",
      "jsx-a11y/anchor-has-content": "error",
      "jsx-a11y/aria-props": "error",
      "jsx-a11y/role-has-required-aria-props": "error",
    },
  },

  // O domínio é TypeScript puro: nada de framework, nada de infraestrutura.
  {
    files: ["src/modules/*/domain/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "next",
                "next/*",
                "react",
                "react-dom",
                "@prisma/client",
                "@/server/*",
              ],
              message:
                "Camada domain não pode importar framework nem infraestrutura (docs/01 §1). Use uma porta em application/.",
            },
          ],
        },
      ],
    },
  },

  // A camada de aplicação conhece portas, nunca implementações.
  {
    files: ["src/modules/*/application/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["next", "next/*", "react", "react-dom", "@prisma/client"],
              message:
                "Camada application depende de portas, não de framework nem de Prisma (docs/01 §1).",
            },
          ],
        },
      ],
    },
  },

  // O Design System recebe props. Ele nunca conhece o domínio.
  {
    files: ["src/design-system/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/modules/*", "@/server/*"],
              message:
                "Design System não conhece módulos de domínio — ele recebe props (docs/02 §regras).",
            },
          ],
        },
      ],
    },
  },
];

export default config;
