import { Prisma, type PrismaClient } from "@prisma/client";

import type { DomainEvent } from "@/shared/kernel";

import type { ContextoDaTentativa, PlanoDaTentativa } from "../domain/attempt-plan";
import type {
  PedidoDeContexto,
  RepositorioDeAvaliacao,
  ResultadoDaGravacao,
} from "../application/ports";

/**
 * Implementação Prisma do repositório de avaliação.
 *
 * Aqui mora tudo que o domínio não pode saber: transação, nível de isolamento,
 * atualização condicional, código de erro do Postgres. Nenhuma regra de
 * avaliação passa por este arquivo — se alguma decisão pedagógica aparecer
 * aqui, ela está no lugar errado.
 */

/** Violação de restrição única no Postgres, via Prisma. */
const CHAVE_DUPLICADA = "P2002";

/**
 * Sinaliza que a atualização condicional não encontrou a versão esperada.
 *
 * Precisa ser exceção, e não valor de retorno: sair do callback de
 * `$transaction` com um `return` **confirma** a transação, e o que queremos é
 * exatamente o contrário — desfazer a tentativa já inserida e recomeçar do
 * estado novo.
 */
class ConflitoDeVersao extends Error {
  constructor() {
    super("SkillMastery mudou entre a leitura e a escrita");
    this.name = "ConflitoDeVersao";
  }
}

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
            // Fôlego: docs/08 §4. Enquanto o módulo de progressão não existe, a
            // linha pode não existir — e nesse caso não há falta de Fôlego.
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

    async gravar(plano: PlanoDaTentativa): Promise<ResultadoDaGravacao> {
      try {
        const attemptId = await db.$transaction(
          async (tx) => {
            /*
             * A tentativa vem primeiro de propósito: se a chave já existe, o
             * índice único aborta aqui, antes de qualquer outra escrita. É esta
             * ordem que torna a idempotência barata — não há nada para desfazer.
             */
            const tentativa = await tx.attempt.create({
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

            if (plano.dominio) {
              const { skillId, versaoEsperada, proximo } = plano.dominio;
              const learnerId = plano.tentativa.learnerId;

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
                // Primeira tentativa nesta competência. Se outra requisição
                // criou a linha nesse meio-tempo, a chave composta acusa e
                // recomeçamos — não sobrescrevemos o que ela calculou.
                await tx.skillMastery.create({ data: { learnerId, skillId, ...dados } });
              } else {
                const { count } = await tx.skillMastery.updateMany({
                  where: { learnerId, skillId, version: versaoEsperada },
                  data: dados,
                });
                if (count === 0) throw new ConflitoDeVersao();
              }
            }

            if (plano.revisao) {
              /*
               * Sem versão própria: o cartão de revisão da mesma competência
               * só é alcançado por uma escrita que já passou pela atualização
               * condicional de `SkillMastery`, acima, na mesma transação. É ela
               * que serializa — duplicar o controle aqui seria cerimônia sem
               * garantia adicional.
               */
              const { skillId, proximo } = plano.revisao;
              const learnerId = plano.tentativa.learnerId;
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

            /*
             * Outbox na mesma transação: é o que garante que nenhum efeito se
             * perca e que nenhum aconteça sem a tentativa ter sido gravada
             * (docs/08 §11). Publicar depois do commit seria uma janela em que
             * um processo derrubado deixaria XP por creditar para sempre.
             */
            await tx.outboxMessage.createMany({
              data: plano.eventos.map((evento) => ({
                topic: evento.name,
                payload: envelope(evento),
                availableAt: evento.occurredAt,
              })),
            });

            return tentativa.id;
          },
          {
            /*
             * READ COMMITTED (padrão do Postgres) com atualização condicional,
             * como manda docs/08 §11. Serializable custaria retry em toda
             * escrita concorrente; a versão em `SkillMastery` resolve o único
             * conflito real por um preço muito menor.
             */
            isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
          },
        );

        return { status: "gravado", attemptId: attemptId.toString() };
      } catch (causa) {
        if (causa instanceof ConflitoDeVersao) return { status: "conflito" };

        if (
          causa instanceof Prisma.PrismaClientKnownRequestError &&
          causa.code === CHAVE_DUPLICADA
        ) {
          // Duas chaves únicas podem estourar aqui, e a resposta certa difere:
          // a da tentativa é idempotência; a de `SkillMastery` é corrida.
          return alvoDoConflito(causa) === "attempt"
            ? { status: "duplicada" }
            : { status: "conflito" };
        }

        throw causa;
      }
    },
  };
}

/**
 * Qual restrição única foi violada.
 *
 * `meta.target` vem como lista de colunas (ou string, conforme o driver), então
 * a checagem é por conteúdo e não por igualdade.
 */
function alvoDoConflito(erro: Prisma.PrismaClientKnownRequestError): "attempt" | "outro" {
  const alvo = erro.meta?.["target"];
  const texto = Array.isArray(alvo) ? alvo.join(",") : String(alvo ?? "");
  return texto.includes("idempotencyKey") ? "attempt" : "outro";
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

/**
 * Evento de domínio → linha do outbox.
 *
 * O `JSON.parse(JSON.stringify(...))` não é cerimônia: o payload carrega `Date`,
 * e o outbox é formato de fio. Quem consumir a mensagem daqui a uma hora, em
 * outro processo, vai receber texto — converter na saída, e não na entrada,
 * deixaria cada consumidor descobrir sozinho quais campos eram datas.
 *
 * O envelope é uniforme (`topic`, `traceId`, `occurredAt`, `dados`) para que um
 * despachante possa rotear sem conhecer nenhum payload.
 */
function envelope(evento: DomainEvent): Prisma.InputJsonValue {
  return JSON.parse(
    JSON.stringify({
      traceId: evento.traceId,
      occurredAt: evento.occurredAt.toISOString(),
      dados: evento.payload,
    }),
  ) as Prisma.InputJsonValue;
}
