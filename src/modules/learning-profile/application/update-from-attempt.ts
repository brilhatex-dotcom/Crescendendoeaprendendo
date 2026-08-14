import { TOPICO_TENTATIVA_AVALIADA, type TentativaAvaliada } from "@/modules/assessment";
import type { DomainEvent, EventHandler, Transacao } from "@/shared/kernel";

import { contaComoEvidencia, mudouOSuficiente, recomputarDimensao } from "../domain/dimension";
import { dimensoesRelevantes } from "../domain/dimension-rules";
import type { LearningProfileDeps } from "./ports";

/**
 * Atualiza o Learning Profile a cada tentativa avaliada.
 *
 * **Outbox, não inline.** O perfil de aprendizagem informa a *próxima*
 * missão, nunca a que a criança acabou de responder — não há motivo para
 * competir com a Luz, o Fôlego e a carteira pelo orçamento de latência da
 * submissão (mesmo raciocínio de `achievement`, docs/HANDOFF.md §5 item 3).
 *
 * Sem sinal, sem trabalho: a maior parte das atividades do acervo hoje não
 * declara nenhuma característica de apresentação (`Activity.visualSupportLevel`
 * etc. são todos opcionais), e este handler simplesmente não faz nada nesse
 * caso — não há característica a que atribuir o desempenho. A partir do
 * momento em que uma atividade declarar (Fase 2), o mesmo handler, sem
 * mudança nenhuma, começa a aprender com ela.
 */
export function criarAtualizarPerfilAPartirDeTentativa(
  deps: LearningProfileDeps,
): EventHandler<DomainEvent<typeof TOPICO_TENTATIVA_AVALIADA, TentativaAvaliada>> {
  return {
    topico: TOPICO_TENTATIVA_AVALIADA,
    modo: "outbox",

    async tratar(evento, tx: Transacao) {
      if (!contaComoEvidencia(evento.payload.outcome)) return;

      const caracteristicas = await deps.repositorio.buscarCaracteristicas(
        evento.payload.activityId,
        tx,
      );
      if (!caracteristicas) return;

      const chaves = dimensoesRelevantes(caracteristicas);
      if (chaves.length === 0) return;

      const perfilId = await deps.repositorio.obterOuCriarPerfil(
        evento.payload.learnerId,
        null, // Fase 1: só o perfil global. Por academia fica para quando houver dado que justifique.
        tx,
      );

      for (const chave of chaves) {
        const scores = await deps.repositorio.buscarScoresRelevantes(
          evento.payload.learnerId,
          chave,
          tx,
        );
        const recomputado = recomputarDimensao(scores);
        if (recomputado === null) continue;

        const anterior = await deps.repositorio.obterDimensao(perfilId, chave, tx);
        if (anterior !== null && !mudouOSuficiente(anterior, recomputado)) continue;

        await deps.repositorio.salvarDimensao(perfilId, chave, recomputado, anterior, tx);
      }
    },
  };
}
