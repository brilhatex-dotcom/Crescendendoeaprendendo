import { TOPICO_MISSAO_CONCLUIDA, type MissaoConcluida } from "@/modules/quest";
import type { DomainEvent, EventHandler, Transacao } from "@/shared/kernel";

import { carteiraInicial, lancar, type Movimento } from "../domain/ledger";
import type { EconomyDeps } from "./ports";

/**
 * Credita as Fagulhas e os Prismas de uma missão concluída.
 *
 * Duas camadas de proteção contra crédito em dobro, e as duas são necessárias:
 *
 *  1. `quest` só publica este evento depois de marcar `rewardsGrantedAt` numa
 *     atualização condicional — quem chega depois não publica nada;
 *  2. a chave derivada do `questRunId` bate no índice único de `LedgerEntry`
 *     se o evento chegar duas vezes assim mesmo.
 *
 * A primeira cobre o caso normal; a segunda cobre o dia em que alguém mexer na
 * primeira. Numa razão contábil, a redundância é o ponto.
 */
export function criarCreditoDeMissao(
  deps: EconomyDeps,
): EventHandler<DomainEvent<typeof TOPICO_MISSAO_CONCLUIDA, MissaoConcluida>> {
  return {
    topico: TOPICO_MISSAO_CONCLUIDA,
    modo: "inline",

    async tratar(evento, tx: Transacao) {
      const { learnerId, premio, questRunId, idempotencyKey } = evento.payload;

      const movimentos: readonly Movimento[] = [
        movimento("COIN", premio.moedas, questRunId, idempotencyKey),
        movimento("CRYSTAL", premio.cristais, questRunId, idempotencyKey),
      ].filter((m) => m.quantidade !== 0);

      if (movimentos.length === 0) return;

      const carregada = await deps.repositorio.carregar(learnerId, tx);
      const atual = carregada ?? carteiraInicial();

      const resultado = lancar(atual, movimentos);

      /*
       * Recusa num crédito é impossível por construção. Se acontecer, o dado
       * está corrompido — e derrubar a transação inteira é melhor que gravar
       * um saldo que ninguém consegue explicar depois.
       */
      if (resultado.recusado) {
        throw new Error(
          `Crédito de missão recusado em ${resultado.recusado.moeda} para ${learnerId}`,
        );
      }

      await deps.repositorio.aplicar(
        learnerId,
        carregada?.versao ?? null,
        resultado.carteira,
        resultado.lancamentos,
        tx,
      );
    },
  };
}

const movimento = (
  moeda: Movimento["moeda"],
  quantidade: number,
  questRunId: string,
  idempotencyKey: string,
): Movimento => ({
  moeda,
  quantidade,
  motivo: "QUEST_REWARD",
  refType: "QuestRun",
  refId: questRunId,
  // Uma chave por moeda: `LedgerEntry` é uma linha por moeda, e uma chave só
  // colidiria consigo mesma.
  idempotencyKey: `${idempotencyKey}:${moeda}`,
});
