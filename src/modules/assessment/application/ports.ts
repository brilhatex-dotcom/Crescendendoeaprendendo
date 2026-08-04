import type { Clock } from "@/shared/kernel";

import type { ContextoDaTentativa, PlanoDaTentativa } from "../domain/attempt-plan";

/**
 * Portas do módulo de avaliação.
 *
 * Duas operações e nada mais: ler o que o cálculo precisa, gravar o que ele
 * produziu. Toda a regra — BKT, Elo, SM-2, prêmio, eventos — mora no domínio,
 * e é por isso que ela é testável sem Postgres.
 */

export interface PedidoDeContexto {
  readonly learnerId: string;
  /**
   * `Activity.sourceRef` — o caminho da atividade em `content/`.
   *
   * A ação de jogo conhece a atividade pelo slug do arquivo, não pelo id do
   * banco, e é assim que tem que ser: o executor de missão não deve conhecer
   * chave primária de tabela. A referência de origem é a ponte estável entre os
   * dois mundos, e é única (`@unique`), então a tradução é uma leitura direta.
   */
  readonly refDaAtividade: string;
}

/**
 * O que aconteceu ao gravar.
 *
 * `duplicada` e `conflito` são desfechos esperados, não falhas: um é sync
 * offline reenviando o que já chegou, o outro é a criança com duas abas
 * abertas. Exceção fica para o que é genuinamente excepcional.
 */
export type ResultadoDaGravacao =
  | { readonly status: "gravado"; readonly attemptId: string }
  /** Já existia tentativa com esta `idempotencyKey`. Nada foi escrito. */
  | { readonly status: "duplicada" }
  /** A linha de domínio mudou entre a leitura e a escrita. Nada foi escrito. */
  | { readonly status: "conflito" };

export interface RepositorioDeAvaliacao {
  /**
   * Carrega tudo que o cálculo precisa numa leitura coerente.
   *
   * Devolve `null` quando a atividade não está no banco — o caso mais provável
   * é o acervo de `content/` ainda não ter sido importado naquele ambiente.
   */
  carregarContexto(pedido: PedidoDeContexto): Promise<ContextoDaTentativa | null>;

  /**
   * Grava o plano inteiro **numa transação** (docs/08 §11): `Attempt`,
   * `SkillMastery`, `ReviewCard` e as mensagens de outbox.
   *
   * Tudo ou nada. Uma tentativa gravada sem a atualização de domínio é pior que
   * tentativa nenhuma: o histórico diria que a criança praticou, e o modelo
   * diria que não — e o relatório do responsável mostraria a divergência sem
   * ninguém saber de onde ela veio.
   */
  gravar(plano: PlanoDaTentativa): Promise<ResultadoDaGravacao>;

  /** `true` se já existe tentativa com esta chave. */
  jaRegistrada(idempotencyKey: string): Promise<boolean>;
}

export interface AssessmentDeps {
  readonly repositorio: RepositorioDeAvaliacao;
  readonly clock: Clock;
  /**
   * Espera entre as tentativas de gravação (docs/08 §11: retry com backoff).
   *
   * É porta, e não `setTimeout` embutido, pelo mesmo motivo de `Clock` ser
   * porta: um teste de concorrência que dorme de verdade é um teste que alguém
   * acaba marcando como `skip`.
   */
  readonly dormir: (ms: number) => Promise<void>;
}
