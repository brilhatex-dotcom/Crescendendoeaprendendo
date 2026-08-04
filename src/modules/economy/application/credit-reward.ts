import {
  TOPICO_TENTATIVA_AVALIADA,
  type TentativaAvaliada,
} from "@/modules/assessment";
import type { DomainEvent, EventHandler, Transacao } from "@/shared/kernel";

import { carteiraInicial, creditosDePremio, lancar } from "../domain/ledger";
import type { EconomyDeps } from "./ports";

/**
 * Credita as Fagulhas de uma tentativa.
 *
 * Como a progressão, reage ao evento e roda **dentro da transação da tentativa**
 * (docs/08 §11). O motivo aqui é ainda mais direto que o da Luz: moeda creditada
 * fora da transação pode ser creditada sem que a tentativa exista, e o inverso.
 * Qualquer um dos dois é um saldo que ninguém consegue explicar depois.
 *
 * Só credita. Não há caminho de débito neste manipulador — compra é ação
 * própria, com preço lido do servidor (docs/08 §5, invariante 5).
 */
export function criarCreditoDeRecompensa(
  deps: EconomyDeps,
): EventHandler<DomainEvent<typeof TOPICO_TENTATIVA_AVALIADA, TentativaAvaliada>> {
  return {
    topico: TOPICO_TENTATIVA_AVALIADA,
    modo: "inline",

    async tratar(evento, tx: Transacao) {
      const { learnerId, premio, idempotencyKey, activityId } = evento.payload;
      if (!premio) return;

      const movimentos = creditosDePremio(premio, {
        idempotencyKey,
        refType: "Attempt",
        refId: activityId,
      });

      // Prêmio só de Luz — o caso mais comum numa atividade — não abre carteira
      // nem grava razão. Linha de razão que não move saldo é ruído para quem
      // for auditar.
      if (movimentos.length === 0) return;

      const carregada = await deps.repositorio.carregar(learnerId, tx);
      const atual = carregada ?? carteiraInicial();

      const resultado = lancar(atual, movimentos);

      /*
       * `recusado` aqui seria saldo insuficiente **num crédito**, que é
       * impossível por construção. Se acontecer, o dado está corrompido e
       * seguir em frente gravaria um saldo errado — melhor deixar a transação
       * inteira cair e a tentativa não ser registrada.
       */
      if (resultado.recusado) {
        throw new Error(
          `Crédito recusado em ${resultado.recusado.moeda} para ${learnerId}: saldo ${resultado.recusado.disponivel}`,
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
