import type { Clock, Transacao } from "@/shared/kernel";

import type { ItemDoCatalogoDeConquista } from "../domain/board";
import type { TipoDeCriterio } from "../domain/criteria";

export interface ConquistaDesbloqueada {
  readonly code: string;
  readonly nome: string;
}

export interface RepositorioDeConquistas {
  /**
   * Recomputa a contagem do critério `tipo` para `learnerId` a partir da
   * fonte de verdade (`SkillMastery.masteredAt` ou `QuestRun.status`, ver
   * `domain/criteria.ts`) e atualiza o progresso de toda conquista deste
   * catálogo que usa esse tipo — inclusive as ainda não vistas.
   *
   * **Idempotente por construção**: reprocessar o mesmo evento (o outbox é
   * *at-least-once*) recomputa a mesma contagem e grava o mesmo resultado —
   * não há "somar de novo" para dar errado.
   *
   * Devolve as conquistas que **cruzaram** o limiar nesta chamada — não as
   * que já estavam desbloqueadas antes. É o que permite ao chamador celebrar
   * só a novidade, não repetir aviso a cada evento seguinte.
   */
  avancarProgresso(
    learnerId: string,
    tipo: TipoDeCriterio,
    quando: Date,
    tx: Transacao,
  ): Promise<readonly ConquistaDesbloqueada[]>;

  /** Leitura para tela — fora de transação. Catálogo inteiro + progresso da criança. */
  quadro(learnerId: string): Promise<{
    readonly catalogo: readonly ItemDoCatalogoDeConquista[];
    readonly progresso: ReadonlyMap<
      string,
      { readonly progresso: number; readonly desbloqueadaEm: Date | null }
    >;
  }>;
}

export interface AchievementDeps {
  readonly repositorio: RepositorioDeConquistas;
  readonly clock: Clock;
}
