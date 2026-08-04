import { Prisma, type PrismaClient } from "@prisma/client";

import { clienteDaTransacao } from "@/server/unit-of-work";
import type { Transacao } from "@/shared/kernel";

import type { ContextoDaTentativa, PlanoDaTentativa } from "../domain/attempt-plan";
import {
  DominioMudouNoMeio,
  TentativaJaRegistrada,
  type PedidoDeContexto,
  type RepositorioDeAvaliacao,
} from "../application/ports";

/**
 * Implementação Prisma do repositório de avaliação.
 *
 * Aqui mora tudo que o domínio não pode saber: atualização condicional, código
 * de erro do Postgres, conversão de `Decimal`. Nenhuma regra de avaliação passa
 * por este arquivo — se alguma decisão pedagógica aparecer aqui, ela está no
 * lugar errado.
 *
 * A transação **não é aberta aqui**: chega pronta. É o que permite a progressão
 * e a economia escreverem na mesma, sem que nenhum dos três módulos conheça os
 * outros (docs/08 §11 + docs/01 §2).
 */

/** Violação de restrição única no Postgres, via Prisma. */
const CHAVE_DUPLICADA = "P2002";

export function criarRepositorioPrismaDeAvaliacao(
  db: PrismaClient,
): RepositorioDeAvaliacao {
  return {
    async jaRegistrada(idempotencyKey) {
      const encontrada = await db.attempt.findUnique({
        where: { idempotencyKey },
        select: { id: true },
      });
      return encontrada !== null;
    },

    async carregarContexto(pedido: PedidoDeContexto): Promise<ContextoDaTentativa | null> {
      const [crianca, atividade] = await Promise.all([
        db.learner.findFirst({
          where: { id: pedido.learnerId, deletedAt: null },
          select: {
            pseudonymId: true,
            // Fôlego: docs/08 §4. A linha pode não existir para quem nunca
            // jogou — e quem nunca jogou não gastou Fôlego nenhum.
            progress: { select: { energy: true } },
          },
        }),
        db.activity.findUnique({
          where: { sourceRef: pedido.refDaAtividade },
          select: {
            id: true,
            type: true,
            objectiveId: true,
            difficulty: true,
            objective: {
              select: { skillId: true, skill: { select: { difficultyRef: true } } },
            },
          },
        }),
      ]);

      if (!crianca || !atividade) return null;

      const skillId = atividade.objective.skillId;

      const [dominio, revisao, tentativasNaAtividade] = await Promise.all([
        db.skillMastery.findUnique({
          where: { learnerId_skillId: { learnerId: pedido.learnerId, skillId } },
        }),
        db.reviewCard.findUnique({
          where: { learnerId_skillId: { learnerId: pedido.learnerId, skillId } },
        }),
        db.attempt.count({
          where: { learnerId: pedido.learnerId, activityId: atividade.id },
        }),
      ]);

      return {
        learnerId: pedido.learnerId,
        pseudonymId: crianca.pseudonymId,
        activityId: atividade.id,
        activityType: atividade.type,
        objectiveId: atividade.objectiveId,
        skillId,
        dificuldade: Number(atividade.difficulty),
        dificuldadeDeReferencia: Number(atividade.objective.skill.difficultyRef),
        dominio: dominio
          ? {
              probabilidade: Number(dominio.probability),
              habilidade: Number(dominio.ability),
              tentativas: dominio.attemptsCount,
              acertos: dominio.correctCount,
              sequencia: dominio.streak,
              dominadaEm: dominio.masteredAt,
              ultimaTentativaEm: dominio.lastAttemptAt,
              versao: dominio.version,
            }
          : null,
        revisao: revisao
          ? {
              intervaloDias: revisao.intervalDays,
              facilidade: Number(revisao.easeFactor),
              venceEm: revisao.dueAt,
              recaidas: revisao.lapses,
            }
          : null,
        tentativasNaAtividade,
        semFolego: (crianca.progress?.energy ?? Number.MAX_SAFE_INTEGER) <= 0,
      };
    },

    async gravar(plano: PlanoDaTentativa, transacao: Transacao): Promise<string> {
      const tx = clienteDaTransacao(transacao);
      const learnerId = plano.tentativa.learnerId;

      /*
       * A tentativa vem primeiro de propósito: se a chave já existe, o índice
       * único aborta aqui, antes de qualquer outra escrita — inclusive antes de
       * qualquer crédito de Luz ou de moeda.
       */
      const tentativa = await criarTentativa(tx, plano);

      if (plano.dominio) {
        const { skillId, versaoEsperada, proximo } = plano.dominio;

        const dados = {
          probability: new Prisma.Decimal(proximo.probabilidade.toFixed(4)),
          ability: new Prisma.Decimal(proximo.habilidade.toFixed(3)),
          attemptsCount: proximo.tentativas,
          correctCount: proximo.acertos,
          streak: proximo.sequencia,
          masteredAt: proximo.dominadaEm,
          lastAttemptAt: proximo.ultimaTentativaEm,
          version: proximo.versao,
        };

        if (versaoEsperada === null) {
          /*
           * Primeira tentativa nesta competência. Se outra requisição criou a
           * linha nesse meio-tempo, a chave composta acusa — e recomeçamos, em
           * vez de sobrescrever o que ela calculou.
           */
          try {
            await tx.skillMastery.create({ data: { learnerId, skillId, ...dados } });
          } catch (causa) {
            if (ehChaveDuplicada(causa)) throw new DominioMudouNoMeio();
            throw causa;
          }
        } else {
          const { count } = await tx.skillMastery.updateMany({
            where: { learnerId, skillId, version: versaoEsperada },
            data: dados,
          });
          if (count === 0) throw new DominioMudouNoMeio();
        }
      }

      if (plano.revisao) {
        /*
         * Sem versão própria: o cartão de revisão da mesma competência só é
         * alcançado por uma escrita que já passou pela atualização condicional
         * de `SkillMastery`, acima, na mesma transação. É ela que serializa —
         * duplicar o controle aqui seria cerimônia sem garantia adicional.
         */
        const { skillId, proximo } = plano.revisao;
        const valores = {
          intervalDays: proximo.intervaloDias,
          easeFactor: new Prisma.Decimal(proximo.facilidade.toFixed(2)),
          dueAt: proximo.venceEm,
          lapses: proximo.recaidas,
        };

        await tx.reviewCard.upsert({
          where: { learnerId_skillId: { learnerId, skillId } },
          create: { learnerId, skillId, ...valores },
          update: valores,
        });
      }

      return tentativa;
    },
  };
}

async function criarTentativa(
  tx: Prisma.TransactionClient,
  plano: PlanoDaTentativa,
): Promise<string> {
  try {
    const criada = await tx.attempt.create({
      data: {
        learnerId: plano.tentativa.learnerId,
        activityId: plano.tentativa.activityId,
        questRunId: plano.tentativa.questRunId,
        answer: comoJson(plano.tentativa.resposta),
        outcome: plano.tentativa.outcome,
        scoreRatio: new Prisma.Decimal(plano.tentativa.scoreRatio.toFixed(3)),
        hintsUsed: plano.tentativa.dicasUsadas,
        durationMs: plano.tentativa.duracaoMs,
        misconception: plano.tentativa.equivoco,
        idempotencyKey: plano.tentativa.idempotencyKey,
        clientEvaluated: plano.tentativa.avaliadaNoCliente,
        createdAt: plano.tentativa.criadaEm,
      },
      select: { id: true },
    });

    return criada.id.toString();
  } catch (causa) {
    if (ehChaveDuplicada(causa)) {
      throw new TentativaJaRegistrada(plano.tentativa.idempotencyKey);
    }
    throw causa;
  }
}

function ehChaveDuplicada(causa: unknown): boolean {
  return (
    causa instanceof Prisma.PrismaClientKnownRequestError && causa.code === CHAVE_DUPLICADA
  );
}

/**
 * Valor para coluna `Json`.
 *
 * `undefined` num campo Json faz o Prisma omitir a coluna, e `null` de
 * JavaScript é ambíguo entre "JSON null" e "coluna nula". `Prisma.JsonNull`
 * declara qual dos dois queremos: a resposta que não pôde ser interpretada é um
 * `null` JSON legítimo no histórico, não a ausência do campo.
 */
function comoJson(valor: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  return valor === null || valor === undefined
    ? Prisma.JsonNull
    : (valor as Prisma.InputJsonValue);
}
