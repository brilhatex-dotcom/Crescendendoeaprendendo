import type { Clock, Transacao } from "@/shared/kernel";

import type { SugestaoDeAcessibilidade } from "../domain/accessibility-recommendation";
import type { CaracteristicasDaAtividade } from "../domain/dimension-rules";

export type { CaracteristicasDaAtividade, SugestaoDeAcessibilidade };

export interface DimensaoPersistida {
  readonly value: number;
  readonly confidence: number;
  readonly observationsCount: number;
}

/** Uma sugestão de acessibilidade já gravada — o que a tela do responsável lê. */
export interface RecomendacaoPersistida {
  readonly id: string;
  readonly dimensionKey: string;
  readonly settingField: string;
  readonly reason: string;
  readonly score: number;
  readonly createdAt: Date;
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

  /**
   * Valor atual da configuração de acessibilidade, para não sugerir o que já
   * está ligado. `null` quando a criança não tem `LearnerSettings` (nunca
   * acontece em produção — toda criança ganha a linha ao ser criada — mas o
   * tipo não assume).
   */
  valorAtualDaConfiguracao(
    learnerId: string,
    settingField: string,
    tx: Transacao,
  ): Promise<boolean | null>;

  /** Já existe uma sugestão desta dimensão ainda não respondida pelo responsável. */
  existeRecomendacaoPendente(
    learnerId: string,
    dimensionKey: string,
    tx: Transacao,
  ): Promise<boolean>;

  /** Grava a sugestão de acessibilidade. */
  criarRecomendacaoDeAcessibilidade(
    learnerId: string,
    sugestao: SugestaoDeAcessibilidade,
    score: number,
    tx: Transacao,
  ): Promise<void>;

  /** Sugestões ainda não respondidas — leitura pra tela do responsável, fora de transação. */
  listarRecomendacoesPendentes(learnerId: string): Promise<readonly RecomendacaoPersistida[]>;

  /**
   * Marca a recomendação como respondida — condicional a ainda estar
   * pendente, para que um clique duplicado (duplo toque, reload) nunca a
   * processe duas vezes. Devolve a recomendação consumida agora, ou `null`
   * quando ela não existe, não é desta criança, ou já tinha sido respondida.
   */
  consumirRecomendacao(
    recommendationId: string,
    learnerId: string,
    tx: Transacao,
  ): Promise<RecomendacaoPersistida | null>;
}

export interface LearningProfileDeps {
  readonly repositorio: RepositorioDePerfilDeAprendizagem;
  readonly clock: Clock;
}
