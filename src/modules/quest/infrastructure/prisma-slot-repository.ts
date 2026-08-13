import { ELO } from "@/modules/assessment";
import { clienteDaTransacao } from "@/server/unit-of-work";
import type { Transacao } from "@/shared/kernel";

import { chaveDoSlot } from "../domain/slot-resolution";
import type { CandidataParaSlot, RepositorioDeSlots, ResolucaoDeSlot } from "../application/ports";

/**
 * Implementação Prisma da seleção adaptativa (docs/08 §7).
 *
 * Lê tabela de três módulos diferentes — `Learner`, `Objective`+`SkillMastery`
 * (de `assessment`), `Activity` (do motor) — porque a infraestrutura pode; é o
 * domínio que não pode. Nenhuma regra de seleção mora aqui: quem decide o alvo
 * e a variedade é `seletorPorProximidade`, em `src/activities`.
 *
 * Sem parâmetro de conexão: toda consulta abaixo é feita dentro da transação
 * recebida (`clienteDaTransacao`), nunca fora dela — o mesmo motivo de
 * `criarRepositorioPrismaDeMissoes`.
 */
export function criarRepositorioPrismaDeSlots(): RepositorioDeSlots {
  return {
    async contexto(learnerId, objectiveIds, transacao: Transacao) {
      const tx = clienteDaTransacao(transacao);

      const [crianca, objetivos] = await Promise.all([
        tx.learner.findFirst({
          where: { id: learnerId, deletedAt: null },
          select: { ageBand: true, locale: true },
        }),
        objectiveIds.length > 0
          ? tx.objective.findMany({
              where: { id: { in: [...objectiveIds] } },
              select: { id: true, skillId: true },
            })
          : Promise.resolve([]),
      ]);

      if (!crianca) return null;

      const skillIds = [...new Set(objetivos.map((objetivo) => objetivo.skillId))];
      const masteries =
        skillIds.length > 0
          ? await tx.skillMastery.findMany({
              where: { learnerId, skillId: { in: skillIds } },
              select: { skillId: true, ability: true },
            })
          : [];

      const habilidadePorCompetencia = new Map(
        masteries.map((mastery) => [mastery.skillId, Number(mastery.ability)]),
      );

      // Objetivo sem `SkillMastery` (a criança nunca tentou nada daquela
      // competência) não entra no mapa — quem lê usa o centro da escala.
      const habilidadePorObjetivo = new Map<string, number>();
      for (const objetivo of objetivos) {
        const habilidade = habilidadePorCompetencia.get(objetivo.skillId);
        if (habilidade !== undefined) habilidadePorObjetivo.set(objetivo.id, habilidade);
      }

      return { ageBand: crianca.ageBand, locale: crianca.locale, habilidadePorObjetivo };
    },

    async candidatas(objectiveId, locale, transacao: Transacao): Promise<readonly CandidataParaSlot[]> {
      const tx = clienteDaTransacao(transacao);

      const atividades = await tx.activity.findMany({
        where: { objectiveId, status: "PUBLISHED", locale },
        select: { id: true, type: true, difficulty: true, minAgeBand: true, maxAgeBand: true },
      });

      return atividades.map((atividade) => ({
        activityId: atividade.id,
        type: atividade.type,
        dificuldade: Number(atividade.difficulty),
        minAgeBand: atividade.minAgeBand,
        maxAgeBand: atividade.maxAgeBand,
      }));
    },

    async vistasRecentemente(learnerId, desde, transacao: Transacao) {
      const tx = clienteDaTransacao(transacao);

      const linhas = await tx.attempt.findMany({
        where: { learnerId, createdAt: { gte: desde } },
        select: { activityId: true },
        distinct: ["activityId"],
      });

      return new Set(linhas.map((linha) => linha.activityId));
    },

    async filaDeRevisaoVencida(learnerId, agora, limite, transacao: Transacao) {
      const tx = clienteDaTransacao(transacao);

      const cartoes = await tx.reviewCard.findMany({
        where: { learnerId, dueAt: { lte: agora } },
        orderBy: { dueAt: "asc" },
        take: limite,
        select: { skillId: true },
      });

      if (cartoes.length === 0) return [];

      // `ReviewCard` não tem relação com `SkillMastery` — são tabelas irmãs,
      // cada uma com sua própria chave (learnerId, skillId). Duas consultas,
      // não uma junção.
      const masteries = await tx.skillMastery.findMany({
        where: { learnerId, skillId: { in: cartoes.map((cartao) => cartao.skillId) } },
        select: { skillId: true, ability: true },
      });
      const habilidadePorCompetencia = new Map(
        masteries.map((mastery) => [mastery.skillId, Number(mastery.ability)]),
      );

      return cartoes.map((cartao) => ({
        skillId: cartao.skillId,
        ability: habilidadePorCompetencia.get(cartao.skillId) ?? ELO.centro,
      }));
    },

    async candidatasPorCompetencia(skillId, locale, transacao: Transacao) {
      const tx = clienteDaTransacao(transacao);

      const atividades = await tx.activity.findMany({
        where: { status: "PUBLISHED", locale, objective: { skillId } },
        select: { id: true, type: true, difficulty: true, minAgeBand: true, maxAgeBand: true },
      });

      return atividades.map((atividade) => ({
        activityId: atividade.id,
        type: atividade.type,
        dificuldade: Number(atividade.difficulty),
        minAgeBand: atividade.minAgeBand,
        maxAgeBand: atividade.maxAgeBand,
      }));
    },

    async slotsResolvidos(questRunId, transacao: Transacao) {
      const tx = clienteDaTransacao(transacao);
      const linhas = await tx.questRunSlot.findMany({
        where: { questRunId },
        select: { stageId: true, order: true, activityId: true },
      });
      return new Map(linhas.map((linha) => [chaveDoSlot(linha), linha.activityId]));
    },

    async resolver(questRunId, resolucoes: readonly ResolucaoDeSlot[], transacao: Transacao) {
      const tx = clienteDaTransacao(transacao);

      if (resolucoes.length > 0) {
        /*
         * `skipDuplicates` é a defesa contra duas abas resolvendo o mesmo
         * slot ao mesmo tempo: quem perde a corrida de escrita não trata isso
         * como erro — lê de volta abaixo e usa o que ganhou, porque o
         * seletor é determinístico e as duas tendem a ter calculado a mesma
         * resposta de qualquer forma.
         */
        await tx.questRunSlot.createMany({
          data: resolucoes.map((resolucao) => ({
            questRunId,
            stageId: resolucao.stageId,
            order: resolucao.order,
            activityId: resolucao.activityId,
          })),
          skipDuplicates: true,
        });
      }

      const linhas = await tx.questRunSlot.findMany({
        where: { questRunId },
        select: { stageId: true, order: true, activityId: true },
      });
      return new Map(linhas.map((linha) => [chaveDoSlot(linha), linha.activityId]));
    },
  } satisfies RepositorioDeSlots;
}
