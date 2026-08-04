import type { RegistroDeTentativa } from "@/activities";
import { TOPICO_TELEMETRIA_DE_TENTATIVA } from "@/modules/assessment";
import type { DomainEvent, EventHandler, Transacao } from "@/shared/kernel";

import { clienteDaTransacao } from "./unit-of-work";

/**
 * TELEMETRIA — grava `LearningEvent` a partir do evento pseudonimizado.
 *
 * Modo `outbox`, e não `inline`, por três razões que apontam para o mesmo lado:
 *
 *  · medir não pode derrubar a jogada — se esta escrita falhar, a criança não
 *    pode perder a tentativa que ela acabou de fazer;
 *  · medir pode esperar — ninguém consulta telemetria em tempo real;
 *  · e, o mais importante, telemetria é o caminho por onde dado sai do sistema.
 *    Mantê-la num consumidor separado, alimentado por um tópico separado, é o
 *    que garante que ela só enxerga o que `RegistroDeTentativa` carrega — e
 *    esse tipo **não tem** `learnerId` (docs/08 §12.7, docs/09 §6).
 *
 * `LearningEvent` guarda `pseudonymId`. Não há tradução de volta para a criança
 * neste caminho, e é essa ausência que faz a promessa valer.
 */
export function criarTelemetriaDeTentativa(): EventHandler<
  DomainEvent<typeof TOPICO_TELEMETRIA_DE_TENTATIVA, RegistroDeTentativa>
> {
  return {
    topico: TOPICO_TELEMETRIA_DE_TENTATIVA,
    modo: "outbox",

    async tratar(evento, tx: Transacao) {
      const registro = evento.payload;

      await clienteDaTransacao(tx).learningEvent.create({
        data: {
          pseudonymId: registro.pseudonymId,
          name: "attempt_recorded",
          properties: {
            activityId: registro.activityId,
            activityType: registro.activityType,
            objectiveId: registro.objectiveId,
            questRunId: registro.questRunId,
            outcome: registro.outcome,
            scoreRatio: registro.scoreRatio,
            tentativa: registro.tentativa,
            dicasUsadas: registro.dicasUsadas,
            duracaoMs: registro.duracaoMs,
            equivoco: registro.equivoco,
            dificuldade: registro.dificuldade,
            habilidadeAntes: registro.habilidadeAntes,
            xp: registro.premio.xp,
          },
          occurredAt: new Date(registro.ocorridoEm),
        },
      });
    },
  };
}
