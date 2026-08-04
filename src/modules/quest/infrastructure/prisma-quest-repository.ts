import { Prisma } from "@prisma/client";

import { clienteDaTransacao } from "@/server/unit-of-work";
import type { Transacao } from "@/shared/kernel";

import type { DadosDaMissao, EstadoDaCorrida, StatusDaCorrida } from "../domain/quest-run";
import { CorridaJaAberta, type RepositorioDeMissoes } from "../application/ports";

/**
 * `QuestRun` e a leitura da missão, no Prisma.
 *
 * A lista de atividades vem de `StageActivity` ordenada por fase e posição —
 * a mesma ordem em que a criança as vê. Slots dinâmicos (`activityId` nulo) são
 * descartados aqui: uma missão feita só de slots ainda não é jogável, e contar
 * um slot como atividade obrigatória tornaria a conclusão impossível.
 */

const CHAVE_DUPLICADA = "P2002";

export function criarRepositorioPrismaDeMissoes(): RepositorioDeMissoes {
  return {
    async buscarMissao(refDaMissao, transacao: Transacao) {
      const tx = clienteDaTransacao(transacao);
      const quest = await tx.quest.findUnique({
        where: { sourceRef: refDaMissao },
        select: SELECAO_DA_MISSAO,
      });
      return quest ? paraDadosDaMissao(quest) : null;
    },

    async buscarMissaoPorQuestId(questId, transacao: Transacao) {
      const tx = clienteDaTransacao(transacao);
      const quest = await tx.quest.findUnique({
        where: { id: questId },
        select: SELECAO_DA_MISSAO,
      });
      return quest ? paraDadosDaMissao(quest) : null;
    },

    async corridaEmAndamento(learnerId, questId, transacao: Transacao) {
      const linha = await clienteDaTransacao(transacao).questRun.findFirst({
        where: { learnerId, questId, status: "IN_PROGRESS" },
        // A mais recente: se por qualquer motivo houver duas, a criança volta
        // para a que ela estava jogando, não para uma esquecida.
        orderBy: { startedAt: "desc" },
      });
      return linha ? paraDominio(linha) : null;
    },

    async corridaPorId(questRunId, transacao: Transacao) {
      const linha = await clienteDaTransacao(transacao).questRun.findUnique({
        where: { id: questRunId },
      });
      return linha ? paraDominio(linha) : null;
    },

    async abrir(learnerId, questId, iniciadaEm, transacao: Transacao) {
      try {
        const linha = await clienteDaTransacao(transacao).questRun.create({
          data: { learnerId, questId, startedAt: iniciadaEm },
        });
        return paraDominio(linha);
      } catch (causa) {
        if (
          causa instanceof Prisma.PrismaClientKnownRequestError &&
          causa.code === CHAVE_DUPLICADA
        ) {
          // `@@unique([learnerId, questId, startedAt])` — dois toques no mesmo
          // instante. Uma jogada só, um Fôlego só.
          throw new CorridaJaAberta();
        }
        throw causa;
      }
    },

    async atividadesRespondidas(questRunId, transacao: Transacao) {
      const linhas = await clienteDaTransacao(transacao).attempt.findMany({
        where: { questRunId },
        select: { activityId: true },
        distinct: ["activityId"],
      });
      return new Set(linhas.map((linha) => linha.activityId));
    },

    async avancar(questRunId, fase, pontuacao, transacao: Transacao) {
      await clienteDaTransacao(transacao).questRun.update({
        where: { id: questRunId },
        data: { stageIndex: fase, score: pontuacao },
      });
    },

    async concluir(questRunId, quando, transacao: Transacao) {
      /*
       * `rewardsGrantedAt: null` no `where` é o que garante concessão única
       * (docs/08 §5, invariante 3). Quem chega depois atualiza zero linhas e
       * recebe `false` — sem exceção, porque não é erro: é a segunda chamada
       * fazendo exatamente o que deveria, que é nada.
       */
      const { count } = await clienteDaTransacao(transacao).questRun.updateMany({
        where: { id: questRunId, rewardsGrantedAt: null },
        data: { status: "COMPLETED", completedAt: quando, rewardsGrantedAt: quando },
      });
      return count > 0;
    },
  };
}

const SELECAO_DA_MISSAO = {
  id: true,
  kind: true,
  name: true,
  rewardXp: true,
  rewardCoins: true,
  rewardCrystals: true,
  stages: {
    orderBy: { order: "asc" },
    select: {
      order: true,
      activities: {
        orderBy: { order: "asc" },
        select: { activityId: true },
      },
    },
  },
} satisfies Prisma.QuestSelect;

type QuestSelecionada = Prisma.QuestGetPayload<{ select: typeof SELECAO_DA_MISSAO }>;

function paraDadosDaMissao(quest: QuestSelecionada): DadosDaMissao {
  const atividades = quest.stages.flatMap((fase, indice) =>
    fase.activities
      .filter((vinculo) => vinculo.activityId !== null)
      .map((vinculo) => ({ activityId: vinculo.activityId as string, fase: indice })),
  );

  return {
    questId: quest.id,
    tipo: quest.kind,
    nome: quest.name,
    premio: {
      xp: quest.rewardXp,
      moedas: quest.rewardCoins,
      cristais: quest.rewardCrystals,
    },
    atividades,
  };
}

type LinhaDeCorrida = {
  id: string;
  learnerId: string;
  questId: string;
  status: string;
  stageIndex: number;
  score: number;
  startedAt: Date;
  completedAt: Date | null;
  rewardsGrantedAt: Date | null;
};

const paraDominio = (linha: LinhaDeCorrida): EstadoDaCorrida => ({
  id: linha.id,
  learnerId: linha.learnerId,
  questId: linha.questId,
  status: linha.status as StatusDaCorrida,
  faseAtual: linha.stageIndex,
  pontuacao: linha.score,
  iniciadaEm: linha.startedAt,
  concluidaEm: linha.completedAt,
  recompensaConcedidaEm: linha.rewardsGrantedAt,
});
