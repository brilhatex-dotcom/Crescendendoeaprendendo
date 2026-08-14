import { TOPICO_TENTATIVA_AVALIADA, type TentativaAvaliada } from "@/modules/assessment";
import { TOPICO_MISSAO_CONCLUIDA, type MissaoConcluida } from "@/modules/quest";
import type { DomainEvent, EventHandler, Transacao } from "@/shared/kernel";

import type { AchievementDeps } from "./ports";

/**
 * Avança o progresso de conquistas de domínio quando uma competência é
 * dominada.
 *
 * **Outbox, não inline.** Ao contrário de figurinha (`collection`,
 * `inline` — a criança precisa ver na hora), reconhecimento de conquista
 * pode esperar o próximo pulso do outbox: "voltou a acender um pouco depois"
 * ainda é reconhecimento, e não vale gastar orçamento de latência da
 * submissão de resposta — que já faz progressão, economia, avanço de corrida
 * e concessão de figurinha na mesma transação — com mais uma escrita que
 * ninguém precisa ver no mesmo segundo (`docs/HANDOFF.md` §5, item 3).
 */
export function criarAvaliacaoPorTentativa(
  deps: AchievementDeps,
): EventHandler<DomainEvent<typeof TOPICO_TENTATIVA_AVALIADA, TentativaAvaliada>> {
  return {
    topico: TOPICO_TENTATIVA_AVALIADA,
    modo: "outbox",

    async tratar(evento, tx: Transacao) {
      if (evento.payload.dominio?.dominouAgora !== true) return;

      await deps.repositorio.avancarProgresso(
        evento.payload.learnerId,
        "competenciasDominadas",
        deps.clock.now(),
        tx,
      );
    },
  };
}

/** Avança o progresso de conquistas de persistência quando uma missão termina. */
export function criarAvaliacaoPorMissao(
  deps: AchievementDeps,
): EventHandler<DomainEvent<typeof TOPICO_MISSAO_CONCLUIDA, MissaoConcluida>> {
  return {
    topico: TOPICO_MISSAO_CONCLUIDA,
    modo: "outbox",

    async tratar(evento, tx: Transacao) {
      await deps.repositorio.avancarProgresso(
        evento.payload.learnerId,
        "missoesConcluidas",
        deps.clock.now(),
        tx,
      );
    },
  };
}
