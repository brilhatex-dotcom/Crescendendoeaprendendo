import type { PrismaClient } from "@prisma/client";

import { clienteDaTransacao } from "@/server/unit-of-work";
import type { Transacao } from "@/shared/kernel";

import type { RepositorioDeColecionaveis } from "../application/ports";

/**
 * `Collectible` + `LearnerCollectible` no Prisma.
 *
 * `conceder` resolve `code` → `Collectible.id` e faz um `upsert` por item —
 * a chave primária composta de `LearnerCollectible` (learnerId,
 * collectibleId) é quem garante a idempotência, então "conceder de novo" é
 * literalmente um no-op, não um caminho de erro a tratar.
 */
export function criarRepositorioPrismaDeColecionaveis(
  db: PrismaClient,
): RepositorioDeColecionaveis {
  return {
    async conceder(learnerId, codes, transacao: Transacao) {
      if (codes.length === 0) return;
      const tx = clienteDaTransacao(transacao);

      const catalogo = await tx.collectible.findMany({
        where: { code: { in: [...codes] } },
        select: { id: true },
      });

      for (const { id: collectibleId } of catalogo) {
        await tx.learnerCollectible.upsert({
          where: { learnerId_collectibleId: { learnerId, collectibleId } },
          create: { learnerId, collectibleId },
          update: {},
        });
      }
    },

    async galeria(learnerId) {
      const [catalogo, ganhas] = await Promise.all([
        db.collectible.findMany({
          orderBy: { code: "asc" },
          select: { id: true, code: true, name: true, symbol: true },
        }),
        db.learnerCollectible.findMany({
          where: { learnerId },
          select: { collectibleId: true, unlockedAt: true },
        }),
      ]);

      const codePorId = new Map(catalogo.map((c) => [c.id, c.code]));
      const ganhasPorCode = new Map<string, Date>();
      for (const linha of ganhas) {
        const code = codePorId.get(linha.collectibleId);
        if (code !== undefined) ganhasPorCode.set(code, linha.unlockedAt);
      }

      return {
        catalogo: catalogo.map((c) => ({ code: c.code, nome: c.name, simbolo: c.symbol })),
        ganhas: ganhasPorCode,
      };
    },
  };
}
