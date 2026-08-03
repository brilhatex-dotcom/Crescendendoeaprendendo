/**
 * Fronteiras de arquitetura verificadas em CI.
 *
 * "Violação de fronteira quebra o build. Isto é o que impede a erosão em 3
 * anos de evolução." — docs/01-arquitetura.md §1
 *
 * Sem isto, a Clean Architecture vira decoração: em 18 meses a regra de
 * negócio estaria espalhada entre componente e acesso a dados.
 */

module.exports = {
  forbidden: [
    {
      name: "domain-sem-infra",
      severity: "error",
      comment:
        "A camada domain é TypeScript puro. Se precisa de Prisma, Next ou React, está no lugar errado.",
      from: { path: "^src/modules/[^/]+/domain" },
      to: {
        path: "^(node_modules/(next|react|react-dom|@prisma)|src/server|src/modules/[^/]+/infrastructure)",
      },
    },
    {
      name: "application-sem-framework",
      severity: "error",
      comment:
        "A camada application define portas; quem as implementa é infrastructure.",
      from: { path: "^src/modules/[^/]+/application" },
      to: {
        path: "^(node_modules/(next|react|react-dom|@prisma)|src/modules/[^/]+/infrastructure)",
      },
    },
    {
      name: "presentation-nao-toca-infra",
      severity: "error",
      comment:
        "Presentation consome casos de uso; a infraestrutura entra pelo composition root.",
      from: { path: "^(app|src/modules/[^/]+/presentation)" },
      to: { path: "^src/modules/[^/]+/infrastructure" },
    },
    {
      name: "modulos-so-pela-api-publica",
      severity: "error",
      comment:
        "A fronteira do módulo é o index.ts. Import de camada interna alheia é acoplamento.",
      from: { path: "^src/modules/([^/]+)" },
      to: {
        path: "^src/modules/(?!$1)[^/]+/(domain|application|infrastructure|presentation)",
      },
    },
    {
      name: "design-system-sem-dominio",
      severity: "error",
      comment: "O Design System recebe props. Ele não conhece o domínio.",
      from: { path: "^src/design-system" },
      to: { path: "^(src/modules|src/server)" },
    },
    {
      name: "kernel-e-puro",
      severity: "error",
      comment:
        "O kernel compartilhado não depende de nada além de si mesmo e da linguagem.",
      from: { path: "^src/shared/kernel" },
      to: { path: "^(src/modules|src/server|src/design-system|node_modules)" },
    },
    {
      name: "sem-dependencia-circular",
      severity: "error",
      comment: "Ciclo entre módulos indica fronteira mal desenhada.",
      from: {},
      to: { circular: true },
    },
    {
      name: "sem-orfaos",
      severity: "warn",
      comment: "Arquivo sem ninguém que o importe costuma ser código morto.",
      from: { orphan: true, pathNot: ["\\.d\\.ts$", "(^|/)(app|prisma)/"] },
      to: {},
    },
  ],

  options: {
    doNotFollow: { path: "node_modules" },
    exclude: { path: "(\\.test\\.ts$|/generated/)" },
    tsConfig: { fileName: "tsconfig.json" },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default", "types"],
      extensions: [".js", ".jsx", ".ts", ".tsx"],
    },
    reporterOptions: {
      text: { highlightFocused: true },
    },
  },
};
