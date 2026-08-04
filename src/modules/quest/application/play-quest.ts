import { ConflitoDeConcorrencia, conflict, err, notFound, ok, type Result } from "@/shared/kernel";

import { custoDeFolego } from "../domain/energy-cost";
import {
  chaveDaRecompensa,
  eventoDeMissaoConcluida,
  eventoDeMissaoIniciada,
} from "../domain/events";
import {
  atividadesRestantes,
  missaoConcluida,
  posicaoDaRetomada,
} from "../domain/quest-run";
import { CorridaJaAberta, type QuestDeps } from "./ports";

/**
 * ABRIR E FECHAR UMA JOGADA.
 *
 * Dois casos de uso e uma promessa entre eles: **fechar o app não pode custar
 * progresso**. Por isso "iniciar" e "retomar" são a mesma operação — pedir para
 * jogar uma missão devolve a jogada em andamento se ela existir, e só cria (e
 * só cobra Fôlego) quando não existe.
 *
 * Separar os dois em ações distintas jogaria a decisão para a tela, e a tela
 * erraria: bastaria um refresh no lugar errado para a criança pagar de novo.
 */

export interface JogadaAberta {
  readonly questRunId: string;
  readonly questId: string;
  /** Índice absoluto da atividade em que ela parou. */
  readonly retomarNoIndice: number;
  readonly atividadesRestantes: number;
  /** `false` quando a jogada acabou de ser criada. */
  readonly retomada: boolean;
  readonly custoDeFolego: number;
}

export type AbrirJogada = (entrada: {
  readonly learnerId: string;
  readonly refDaMissao: string;
  readonly traceId: string;
}) => Promise<Result<JogadaAberta>>;

export function criarAbrirJogada(deps: QuestDeps): AbrirJogada {
  return async function abrirJogada({ learnerId, refDaMissao, traceId }) {
    try {
      return await deps.unidadeDeTrabalho.executar(async (tx) => {
        const missao = await deps.repositorio.buscarMissao(refDaMissao, tx);
        if (!missao) {
          return err(
            notFound(
              "quest.not_published",
              "Esta missão ainda não está publicada no banco. Rode a importação do acervo.",
            ),
          );
        }

        const emAndamento = await deps.repositorio.corridaEmAndamento(
          learnerId,
          missao.questId,
          tx,
        );

        const agora = deps.clock.now();
        const corrida = emAndamento ?? (await deps.repositorio.abrir(
          learnerId,
          missao.questId,
          agora,
          tx,
        ));

        const respondidas = await deps.repositorio.atividadesRespondidas(corrida.id, tx);
        const posicao = posicaoDaRetomada(missao, respondidas);

        /*
         * O evento sai nos dois casos — abrir e retomar —, com `retomada`
         * dizendo qual foi. Quem cobra o Fôlego usa o `custoDeFolego`, que vem
         * zerado na retomada: voltar a uma jogada interrompida não pode custar
         * nada, senão a criança aprenderia a não fechar o app.
         */
        const custo = emAndamento ? 0 : custoDeFolego(missao.tipo);

        await deps.barramento.publicar(
          [
            eventoDeMissaoIniciada(
              {
                learnerId,
                questRunId: corrida.id,
                questId: missao.questId,
                tipo: missao.tipo,
                custoDeFolego: custo,
                retomada: emAndamento !== null,
              },
              traceId,
              agora,
            ),
          ],
          tx,
        );

        return ok({
          questRunId: corrida.id,
          questId: missao.questId,
          retomarNoIndice: posicao.indice,
          atividadesRestantes: atividadesRestantes(missao, respondidas),
          retomada: emAndamento !== null,
          custoDeFolego: custo,
        });
      });
    } catch (causa) {
      if (causa instanceof CorridaJaAberta) {
        // Dois toques em "Começar". A jogada que ganhou continua valendo — e o
        // Fôlego foi cobrado uma vez só, que é o ponto.
        return err(
          conflict("quest.already_open", "Sua aventura já começou. Toque de novo."),
        );
      }
      throw causa;
    }
  };
}

// ── Concluir ─────────────────────────────────────────────────────────────────

export interface JogadaConcluida {
  readonly questRunId: string;
  readonly premio: { readonly xp: number; readonly moedas: number; readonly cristais: number };
  /** `true` quando esta chamada foi a que fechou a missão. */
  readonly concedidaAgora: boolean;
}

export type ConcluirJogada = (entrada: {
  readonly learnerId: string;
  readonly questRunId: string;
  readonly refDaMissao: string;
  readonly traceId: string;
}) => Promise<Result<JogadaConcluida>>;

export function criarConcluirJogada(deps: QuestDeps): ConcluirJogada {
  return async function concluirJogada({ learnerId, questRunId, refDaMissao, traceId }) {
    try {
      return await deps.unidadeDeTrabalho.executar(async (tx) => {
        const corrida = await deps.repositorio.corridaPorId(questRunId, tx);

        /*
         * A checagem de dono não é formalidade: sem ela, uma criança poderia
         * fechar a jogada de outra enviando um id qualquer — e a recompensa
         * cairia na conta errada. `null` para "não existe" e para "não é sua",
         * de propósito, pelo mesmo motivo de sempre.
         */
        if (!corrida || corrida.learnerId !== learnerId) {
          return err(notFound("quest.run_not_found", "Esta aventura não foi encontrada."));
        }

        const missao = await deps.repositorio.buscarMissao(refDaMissao, tx);
        if (!missao || missao.questId !== corrida.questId) {
          return err(notFound("quest.not_found", "Esta missão não existe."));
        }

        const respondidas = await deps.repositorio.atividadesRespondidas(corrida.id, tx);

        /*
         * **Quem diz que a missão acabou é o banco, não o cliente.** Sem esta
         * verificação, um toque forjado concederia `Quest.rewardXp` sem uma
         * única resposta — e a economia inteira perderia o sentido.
         */
        if (!missaoConcluida(missao, respondidas)) {
          return err(
            conflict("quest.not_finished", "Ainda falta atividade nesta missão.", {
              restantes: atividadesRestantes(missao, respondidas),
            }),
          );
        }

        const agora = deps.clock.now();
        const primeiraVez = await deps.repositorio.concluir(corrida.id, agora, tx);

        // Já concedida: a jogada fecha do mesmo jeito, sem prêmio novo.
        if (!primeiraVez) {
          return ok({
            questRunId: corrida.id,
            premio: missao.premio,
            concedidaAgora: false,
          });
        }

        await deps.barramento.publicar(
          [
            eventoDeMissaoConcluida(
              {
                learnerId,
                questRunId: corrida.id,
                questId: missao.questId,
                nome: missao.nome,
                premio: missao.premio,
                idempotencyKey: chaveDaRecompensa(corrida.id),
              },
              traceId,
              agora,
            ),
          ],
          tx,
        );

        return ok({ questRunId: corrida.id, premio: missao.premio, concedidaAgora: true });
      });
    } catch (causa) {
      if (causa instanceof ConflitoDeConcorrencia) {
        return err(
          conflict("quest.concurrent_update", "Não conseguimos fechar esta aventura agora."),
        );
      }
      throw causa;
    }
  };
}
