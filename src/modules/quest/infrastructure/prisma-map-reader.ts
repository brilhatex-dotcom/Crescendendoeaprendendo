import type { PrismaClient } from "@prisma/client";

import { clienteDaTransacao } from "@/server/unit-of-work";
import type { Transacao } from "@/shared/kernel";

import type { DadosDoMapa, LeituraDoMapa } from "../application/ports";
import type { EstadoParaDesbloqueio } from "../domain/unlock-rule";
import { lerRegraDeDesbloqueio } from "./unlock-rule-json";

/**
 * A leitura do mapa, no Prisma.
 *
 * Consulta de tela: sem transação e sem escrita. A criança que abre a base tem
 * que ver a base, e uma corrida de escrita em outro lugar não pode impedir isso.
 *
 * A árvore inteira vem numa consulta só. São poucas linhas — um acervo grande
 * tem dezenas de mundos, não milhares — e uma consulta por capítulo
 * transformaria a tela inicial em N+1 antes de a segunda academia existir.
 */
export function criarLeituraPrismaDoMapa(db: PrismaClient): LeituraDoMapa {
  return {
    async mapaDaCrianca(learnerId: string): Promise<DadosDoMapa> {
      const [mundos, corridas, masteries, progresso] = await Promise.all([
        db.world.findMany({
          orderBy: [{ academyId: "asc" }, { order: "asc" }],
          select: {
            slug: true,
            name: true,
            minLevel: true,
            academy: { select: { name: true } },
            chapters: {
              orderBy: { order: "asc" },
              select: {
                name: true,
                quests: {
                  orderBy: { order: "asc" },
                  select: SELECAO_DA_MISSAO,
                },
              },
            },
          },
        }),
        db.questRun.findMany({
          where: { learnerId },
          select: { status: true, quest: { select: { sourceRef: true } } },
        }),
        db.skillMastery.findMany({
          where: { learnerId },
          select: { probability: true, skill: { select: { name: true } } },
        }),
        db.learnerProgress.findUnique({
          where: { learnerId },
          select: { level: true },
        }),
      ]);

      const concluidas = new Set<string>();
      const emAndamento = new Set<string>();
      for (const corrida of corridas) {
        const ref = corrida.quest.sourceRef;
        if (!ref) continue;
        if (corrida.status === "COMPLETED") concluidas.add(ref);
        if (corrida.status === "IN_PROGRESS") emAndamento.add(ref);
      }

      const estado: EstadoParaDesbloqueio = {
        // Quem nunca jogou está no nível 1 — a linha de progresso só nasce na
        // primeira Luz creditada, e não ter linha não é estar no nível zero.
        nivel: progresso?.level ?? 1,
        missoesConcluidas: concluidas,
        dominioPorCompetencia: new Map(
          masteries.map((m) => [m.skill.name, Number(m.probability)]),
        ),
      };

      return {
        mundos: mundos.map((mundo) => ({
          slug: mundo.slug,
          nome: mundo.name,
          academia: mundo.academy.name,
          nivelMinimo: mundo.minLevel,
          capitulos: mundo.chapters.map((capitulo) => ({
            nome: capitulo.name,
            missoes: capitulo.quests.flatMap((quest) =>
              // Missão sem `sourceRef` não veio do acervo (gerada por IA, um
              // dia) e não tem como ser aberta pela rota atual. Fora do mapa.
              quest.sourceRef ? [paraOMapa(quest, quest.sourceRef)] : [],
            ),
          })),
        })),
        estado,
        concluidas,
        emAndamento,
      };
    },

    async estadoDeDesbloqueio(learnerId: string, transacao: Transacao) {
      const tx = clienteDaTransacao(transacao);

      const [corridas, masteries, progresso] = await Promise.all([
        tx.questRun.findMany({
          where: { learnerId, status: "COMPLETED" },
          select: { quest: { select: { sourceRef: true } } },
        }),
        tx.skillMastery.findMany({
          where: { learnerId },
          select: { probability: true, skill: { select: { name: true } } },
        }),
        tx.learnerProgress.findUnique({ where: { learnerId }, select: { level: true } }),
      ]);

      return {
        nivel: progresso?.level ?? 1,
        missoesConcluidas: new Set(
          corridas.flatMap((c) => (c.quest.sourceRef ? [c.quest.sourceRef] : [])),
        ),
        dominioPorCompetencia: new Map(
          masteries.map((m) => [m.skill.name, Number(m.probability)]),
        ),
      };
    },
  };
}

const SELECAO_DA_MISSAO = {
  sourceRef: true,
  kind: true,
  name: true,
  requiredSkills: true,
  unlockRule: true,
  _count: { select: { stages: true } },
  stages: { select: { _count: { select: { activities: true } } } },
} as const;

type QuestDoMapa = {
  sourceRef: string | null;
  kind: string;
  name: string;
  requiredSkills: string[];
  unlockRule: unknown;
  stages: { _count: { activities: number } }[];
};

function paraOMapa(quest: QuestDoMapa, ref: string) {
  return {
    ref,
    // O slug da missão é o último segmento da referência de origem. É o mesmo
    // valor que a rota `/missao/[slug]` usa.
    slug: ref.slice(ref.lastIndexOf("/") + 1),
    nome: quest.name,
    tipo: quest.kind,
    atividades: quest.stages.reduce((total, fase) => total + fase._count.activities, 0),
    competenciasExigidas: quest.requiredSkills,
    desbloqueio: lerRegraDeDesbloqueio(quest.unlockRule),
  };
}
