import type { Prisma, PrismaClient } from "@prisma/client";

import { clienteDaTransacao } from "@/server/unit-of-work";
import type { Transacao } from "@/shared/kernel";

import type { Grau, ItemDoCatalogoDeConquista } from "../domain/board";
import { foiAlcancado, progressoDoCriterio, type TipoDeCriterio } from "../domain/criteria";
import type { ConquistaDesbloqueada, RepositorioDeConquistas } from "../application/ports";
import { lerCriterioDeConquista } from "./criteria-json";

const ORDEM_DO_GRAU: Record<Grau, number> = { BRONZE: 0, PRATA: 1, OURO: 2, LENDARIA: 3 };

/**
 * `Achievement` + `LearnerAchievement` no Prisma.
 *
 * `avancarProgresso` recomputa a contagem de uma fonte de verdade já
 * persistida (nunca acumula "+1" por evento) — ver o raciocínio completo em
 * `domain/criteria.ts`. Isso é o que dispensa qualquer tabela de
 * deduplicação de evento: reprocessar o mesmo evento (outbox é
 * *at-least-once*) recalcula a mesma contagem e grava o mesmo resultado.
 */
export function criarRepositorioPrismaDeConquistas(db: PrismaClient): RepositorioDeConquistas {
  return {
    async avancarProgresso(
      learnerId,
      tipo,
      quando,
      transacao: Transacao,
    ): Promise<readonly ConquistaDesbloqueada[]> {
      const tx = clienteDaTransacao(transacao);

      const [contagem, achievements, existentes] = await Promise.all([
        contarOcorrencias(tx, learnerId, tipo),
        tx.achievement.findMany({
          select: { id: true, code: true, name: true, criteria: true },
        }),
        tx.learnerAchievement.findMany({
          where: { learnerId },
          select: { achievementId: true, unlockedAt: true },
        }),
      ]);

      const jaDesbloqueadas = new Set(
        existentes.filter((e) => e.unlockedAt !== null).map((e) => e.achievementId),
      );

      const desbloqueadas: ConquistaDesbloqueada[] = [];

      for (const achievement of achievements) {
        if (jaDesbloqueadas.has(achievement.id)) continue;

        const criterio = lerCriterioDeConquista(achievement.criteria);
        if (!criterio || criterio.tipo !== tipo) continue;

        const progresso = progressoDoCriterio(contagem, criterio);
        const desbloqueouAgora = foiAlcancado(progresso);

        await tx.learnerAchievement.upsert({
          where: { learnerId_achievementId: { learnerId, achievementId: achievement.id } },
          create: {
            learnerId,
            achievementId: achievement.id,
            progress: progresso,
            unlockedAt: desbloqueouAgora ? quando : null,
          },
          update: {
            progress: progresso,
            unlockedAt: desbloqueouAgora ? quando : undefined,
          },
        });

        if (desbloqueouAgora) {
          desbloqueadas.push({ code: achievement.code, nome: achievement.name });
        }
      }

      return desbloqueadas;
    },

    async quadro(learnerId) {
      const [achievements, progresso] = await Promise.all([
        db.achievement.findMany({
          select: {
            id: true,
            code: true,
            name: true,
            description: true,
            family: true,
            tier: true,
            hidden: true,
          },
        }),
        db.learnerAchievement.findMany({
          where: { learnerId },
          select: { achievementId: true, progress: true, unlockedAt: true },
        }),
      ]);

      // Ordem semântica de grau (Bronze → Lendária), não alfabética — o
      // banco não guarda posição, e "Bronze" < "Lendária" < "Ouro" < "Prata"
      // em ordem alfabética não é o que a criança precisa ver.
      const ordenados = [...achievements].sort(
        (a, b) =>
          a.family.localeCompare(b.family) ||
          ORDEM_DO_GRAU[a.tier as Grau] - ORDEM_DO_GRAU[b.tier as Grau],
      );

      const catalogo: ItemDoCatalogoDeConquista[] = ordenados.map((a) => ({
        code: a.code,
        nome: a.name,
        descricao: a.description,
        familia: a.family as ItemDoCatalogoDeConquista["familia"],
        grau: a.tier as Grau,
        oculta: a.hidden,
      }));

      const codePorId = new Map(achievements.map((a) => [a.id, a.code]));
      const progressoPorCode = new Map<string, { progresso: number; desbloqueadaEm: Date | null }>();
      for (const linha of progresso) {
        const code = codePorId.get(linha.achievementId);
        if (code === undefined) continue;
        progressoPorCode.set(code, {
          progresso: Number(linha.progress),
          desbloqueadaEm: linha.unlockedAt,
        });
      }

      return { catalogo, progresso: progressoPorCode };
    },
  };
}

async function contarOcorrencias(
  tx: Prisma.TransactionClient,
  learnerId: string,
  tipo: TipoDeCriterio,
): Promise<number> {
  switch (tipo) {
    case "competenciasDominadas":
      return tx.skillMastery.count({ where: { learnerId, masteredAt: { not: null } } });
    case "missoesConcluidas":
      return tx.questRun.count({ where: { learnerId, status: "COMPLETED" } });
  }
}
