/**
 * Kernel compartilhado — TypeScript puro, sem framework.
 *
 * Regra de fronteira (docs/01 §1): `domain` só pode importar daqui. Se algo
 * neste diretório precisar de Prisma, React ou Next, está no lugar errado.
 */

export * from "./result";
export * from "./domain-event";
export * from "./unit-of-work";
export * from "./clock";
