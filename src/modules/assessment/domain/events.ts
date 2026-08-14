import type { AttemptOutcome, Premio, RegistroDeTentativa } from "@/activities";
import { domainEvent, type DomainEvent } from "@/shared/kernel";

/**
 * EVENTOS DA AVALIAÇÃO.
 *
 * `assessment` corrige, mede e grava. Ele **não** credita XP, não mexe em
 * carteira, não concede conquista e não sabe que essas coisas existem — quem
 * reage é quem entende do assunto (docs/01 §2). Adicionar "sugerir missão em
 * família ao dominar uma competência" é um handler novo, zero alteração aqui.
 *
 * ── Por que dois eventos e não um ──
 * Os dois consumidores têm necessidades incompatíveis:
 *
 *  · progressão e economia precisam do `learnerId` — vão creditar XP e moeda
 *    nas tabelas da própria criança, dentro do nosso banco;
 *  · telemetria e IA **não podem** ver o `learnerId` (docs/09 §6, teste de
 *    política de docs/08 §12.7).
 *
 * Um evento único com os dois públicos deixaria o `learnerId` ao alcance de
 * quem exporta dado para fora. Separar em dois tópicos torna o vazamento
 * inexpressável: o payload de telemetria é `RegistroDeTentativa`, um tipo que
 * não tem o campo. O compilador passa a fazer o trabalho que hoje dependeria de
 * alguém lembrar em revisão de código.
 */

/** Interno: progressão, economia, conquistas, talentos, relatórios. */
export const TOPICO_TENTATIVA_AVALIADA = "assessment.attempt_evaluated";

/** Externo: telemetria e IA. Pseudonimizado por construção. */
export const TOPICO_TELEMETRIA_DE_TENTATIVA = "learning.attempt_recorded";

export interface TentativaAvaliada {
  readonly learnerId: string;
  readonly activityId: string;
  readonly objectiveId: string;
  readonly skillId: string;
  readonly questRunId: string | null;

  readonly outcome: AttemptOutcome;
  readonly scoreRatio: number;
  /** `true` na primeira vez que esta criança joga esta atividade. */
  readonly primeiraVez: boolean;

  /**
   * Sinais de interação — hoje só consumidos pelo Motor de Aprendizagem
   * Adaptativa (`learning-profile`), para inferir com qual apresentação a
   * criança rende melhor. Já existiam em `RegistroDeTentativa` (telemetria);
   * aqui é a mesma informação, sem `pseudonymId`, para uso interno.
   */
  readonly dicasUsadas: number;
  readonly duracaoMs: number;
  /**
   * Tag da variante de apresentação mostrada (`Activity.presentationVariants`),
   * ou `null` para a apresentação padrão. Sempre `null` até a camada de
   * adaptação (Fase 3) começar a escolher variantes de verdade.
   */
  readonly presentationTag: string | null;

  /**
   * Prêmio **calculado**, não creditado.
   *
   * Quem credita é o módulo de economia, em transação própria e com chave de
   * idempotência derivada da `idempotencyKey` abaixo (docs/08 §5.2). Assessment
   * calcula porque é o único lugar que conhece a habilidade da criança no
   * instante da tentativa — sem ela, o fator de dificuldade seria um chute.
   */
  readonly premio: Premio | null;

  readonly dominio: {
    readonly probabilidade: number;
    readonly habilidade: number;
    /** `true` só na tentativa em que o domínio foi alcançado. */
    readonly dominouAgora: boolean;
  } | null;

  /**
   * A chave da tentativa. É a raiz da idempotência de todo efeito derivado:
   * um consumidor que rode duas vezes deriva a mesma chave e não credita duas.
   */
  readonly idempotencyKey: string;
}

export function tentativaAvaliada(
  payload: TentativaAvaliada,
  traceId: string,
  ocorridoEm: Date,
): DomainEvent<typeof TOPICO_TENTATIVA_AVALIADA, TentativaAvaliada> {
  return domainEvent(TOPICO_TENTATIVA_AVALIADA, payload, traceId, ocorridoEm);
}

export function telemetriaDeTentativa(
  registro: RegistroDeTentativa,
  traceId: string,
): DomainEvent<typeof TOPICO_TELEMETRIA_DE_TENTATIVA, RegistroDeTentativa> {
  return domainEvent(TOPICO_TELEMETRIA_DE_TENTATIVA, registro, traceId, registro.ocorridoEm);
}
