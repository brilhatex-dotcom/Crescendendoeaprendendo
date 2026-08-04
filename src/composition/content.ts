import { criarImportarConteudo } from "@/modules/content";
import { criarEscritorPrismaDeConteudo } from "@/modules/content/infrastructure/prisma-content-writer";
import { db } from "@/server/db";

/**
 * Composition root do módulo `content`.
 *
 * É o único lugar autorizado a conhecer a implementação Prisma — em todo o
 * resto do sistema, a aplicação fala com a porta `EscritorDeConteudo`.
 */
export function containerDeConteudo() {
  return {
    importarConteudo: criarImportarConteudo({
      escritor: criarEscritorPrismaDeConteudo(db),
    }),
  };
}
