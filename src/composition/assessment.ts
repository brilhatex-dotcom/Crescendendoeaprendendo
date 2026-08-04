import { criarSubmeterTentativa, type SubmeterTentativa } from "@/modules/assessment";
import { criarRepositorioPrismaDeAvaliacao } from "@/modules/assessment/infrastructure/prisma-assessment-repository";
import { db } from "@/server/db";
import { systemClock } from "@/shared/kernel";

/**
 * Composition root do módulo `assessment`.
 *
 * Único lugar autorizado a conhecer a implementação Prisma. É por existir este
 * arquivo que `submitAttempt` pode ser testado com repositório em memória, sem
 * banco e sem espera real.
 */
let cache: { readonly submeterTentativa: SubmeterTentativa } | undefined;

export function containerDeAvaliacao() {
  cache ??= {
    submeterTentativa: criarSubmeterTentativa({
      repositorio: criarRepositorioPrismaDeAvaliacao(db),
      clock: systemClock,
      dormir: (ms) => new Promise((resolver) => setTimeout(resolver, ms)),
    }),
  };
  return cache;
}
