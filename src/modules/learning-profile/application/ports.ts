import type { Clock, Transacao } from "@/shared/kernel";

import type { CaracteristicasDaAtividade } from "../domain/dimension-rules";

export type { CaracteristicasDaAtividade };

export interface DimensaoPersistida {
  readonly value: number;
  readonly confidence: number;
  readonly observationsCount: number;
}

export interface RepositorioDePerfilDeAprendizagem {
  /** Características declaradas da atividade, ou `null` se não publicada. */
  buscarCaracteristicas(
    activityId: string,
    tx: Transacao,
  ): Promise<CaracteristicasDaAtividade | null>;

  /**
   * `scoreRatio` de toda tentativa relevante para `dimensionKey`, já
   * filtrada pela característica correspondente — a fonte de verdade para o
   * recompute (`domain/dimension.ts`). Limitada às mais recentes: perfil de
   * aprendizagem pesa o presente, não o histórico inteiro de uma criança que
   * jogou por anos.
   */
  buscarScoresRelevantes(
    learnerId: string,
    dimensionKey: string,
    tx: Transacao,
  ): Promise<readonly number[]>;

  /** Cria o perfil se não existir. Hoje só o escopo global (`academyId: null`). */
  obterOuCriarPerfil(learnerId: string, academyId: string | null, tx: Transacao): Promise<string>;

  obterDimensao(
    profileId: string,
    dimensionKey: string,
    tx: Transacao,
  ): Promise<DimensaoPersistida | null>;

  /** Grava a dimensão recomputada e, se mudou o suficiente, o evento de auditoria. */
  salvarDimensao(
    profileId: string,
    dimensionKey: string,
    novo: DimensaoPersistida,
    anterior: DimensaoPersistida | null,
    tx: Transacao,
  ): Promise<void>;

  /** Leitura para a tela do responsável (Fase 3) — fora de transação. */
  lerPerfil(learnerId: string, academyId: string | null): Promise<{
    readonly dimensions: ReadonlyMap<string, DimensaoPersistida & { readonly lastObservedAt: Date | null }>;
  }>;
}

export interface LearningProfileDeps {
  readonly repositorio: RepositorioDePerfilDeAprendizagem;
  readonly clock: Clock;
}
