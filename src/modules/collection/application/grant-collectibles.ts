import { TOPICO_TENTATIVA_AVALIADA, type TentativaAvaliada } from "@/modules/assessment";
import { TOPICO_MISSAO_CONCLUIDA, type MissaoConcluida } from "@/modules/quest";
import type { DomainEvent, EventHandler, Transacao } from "@/shared/kernel";

import { codigosUnicos } from "../domain/gallery";
import type { CollectionDeps } from "./ports";

/**
 * Concede as figurinhas de uma recompensa — de atividade ou de missão.
 *
 * **Inline, não outbox.** A criança precisa ver a figurinha na hora, na
 * própria tela de fim de atividade ou de missão — é o que faz a coleção
 * parecer coleção, e não uma promessa que chega depois. O outbox hoje só
 * desperta 1x/dia (`vercel.json`, limite do plano Hobby da Vercel); um
 * efeito visível que esperasse até 24h não serviria ao que "conceder"
 * significa aqui. Compare com conquistas (ainda não implementadas), que
 * *podem* esperar — figurinha, não.
 *
 * A concessão em si é idempotente pela chave primária composta de
 * `LearnerCollectible` (docs/08 §5, mesmo espírito da carteira): repetir o
 * evento não duplica nem falha.
 */
export function criarConcessaoPorTentativa(
  deps: CollectionDeps,
): EventHandler<DomainEvent<typeof TOPICO_TENTATIVA_AVALIADA, TentativaAvaliada>> {
  return {
    topico: TOPICO_TENTATIVA_AVALIADA,
    modo: "inline",

    async tratar(evento, tx: Transacao) {
      const codes = codigosUnicos(evento.payload.premio?.colecionaveis ?? []);
      if (codes.length === 0) return;

      await deps.repositorio.conceder(evento.payload.learnerId, codes, tx);
    },
  };
}

export function criarConcessaoPorMissao(
  deps: CollectionDeps,
): EventHandler<DomainEvent<typeof TOPICO_MISSAO_CONCLUIDA, MissaoConcluida>> {
  return {
    topico: TOPICO_MISSAO_CONCLUIDA,
    modo: "inline",

    async tratar(evento, tx: Transacao) {
      const codes = codigosUnicos(evento.payload.premio.colecionaveis);
      if (codes.length === 0) return;

      await deps.repositorio.conceder(evento.payload.learnerId, codes, tx);
    },
  };
}
