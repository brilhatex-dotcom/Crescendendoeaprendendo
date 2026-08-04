import { domainEvent, type DomainEvent } from "@/shared/kernel";

import type { PremioDaMissao } from "./quest-run";

/**
 * EVENTOS DA MISSÃO.
 *
 * `quest` abre, acompanha e fecha uma jogada. Ele **não** gasta Fôlego, não
 * credita Luz e não mexe em carteira — nem sabe que essas coisas existem. Quem
 * entende de cada uma reage (docs/01 §2).
 *
 * O desenho fica visível na leitura destes dois eventos: iniciar uma missão
 * *custa*, concluir uma missão *rende*, e nenhum dos dois verbos é conjugado
 * aqui.
 */

export const TOPICO_MISSAO_INICIADA = "quest.started";
export const TOPICO_MISSAO_CONCLUIDA = "quest.completed";

export interface MissaoIniciada {
  readonly learnerId: string;
  readonly questRunId: string;
  readonly questId: string;
  readonly tipo: string;
  /**
   * Fôlego a cobrar. Quem cobra é a progressão, e **nunca recusa**: Fôlego
   * zerado não impede jogar (docs/08 §4). O valor pode deixar o saldo em zero,
   * jamais abaixo.
   */
  readonly custoDeFolego: number;
  /** `true` quando a criança está voltando a uma jogada que já existia. */
  readonly retomada: boolean;
}

export interface MissaoConcluida {
  readonly learnerId: string;
  readonly questRunId: string;
  readonly questId: string;
  readonly nome: string;
  readonly premio: PremioDaMissao;
  /**
   * Chave de idempotência da concessão.
   *
   * Deriva do `questRunId`, que é único por jogada. É o que faz a recompensa
   * de missão ser creditada **uma vez só** mesmo se o evento for entregue duas
   * (docs/08 §5, invariante 3).
   */
  readonly idempotencyKey: string;
}

export function eventoDeMissaoIniciada(
  payload: MissaoIniciada,
  traceId: string,
  ocorridoEm: Date,
): DomainEvent<typeof TOPICO_MISSAO_INICIADA, MissaoIniciada> {
  return domainEvent(TOPICO_MISSAO_INICIADA, payload, traceId, ocorridoEm);
}

export function eventoDeMissaoConcluida(
  payload: MissaoConcluida,
  traceId: string,
  ocorridoEm: Date,
): DomainEvent<typeof TOPICO_MISSAO_CONCLUIDA, MissaoConcluida> {
  return domainEvent(TOPICO_MISSAO_CONCLUIDA, payload, traceId, ocorridoEm);
}

/** A chave que a economia e a progressão derivam para não creditar em dobro. */
export const chaveDaRecompensa = (questRunId: string): string =>
  `quest-run:${questRunId}:reward`;
