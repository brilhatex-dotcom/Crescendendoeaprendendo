import { ConflitoDeConcorrencia } from "@/shared/kernel";
import type { Clock, EventBus, Transacao, UnidadeDeTrabalho } from "@/shared/kernel";

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
 * Desfechos esperados da gravação, como exceção e não como valor.
 *
 * A escolha é imposta pela transação: sair do escopo transacional com um
 * `return` **confirma** o que já foi escrito. Como a tentativa é inserida antes
 * de tudo, devolver "conflito" normalmente deixaria uma `Attempt` gravada sem a
 * atualização de domínio — exatamente a divergência silenciosa que a transação
 * existe para impedir. Lançar desfaz.
 *
 * Declaradas aqui, na porta, e não na infraestrutura: modos de falha fazem
 * parte do contrato, e é a aplicação que decide o que fazer com cada um.
 */
export class TentativaJaRegistrada extends Error {
  constructor(readonly idempotencyKey: string) {
    super(`Tentativa ${idempotencyKey} já registrada`);
    this.name = "TentativaJaRegistrada";
  }
}

export class DominioMudouNoMeio extends ConflitoDeConcorrencia {
  constructor() {
    super("SkillMastery");
    this.name = "DominioMudouNoMeio";
  }
}

export interface RepositorioDeAvaliacao {
  /**
   * Carrega tudo que o cálculo precisa numa leitura coerente.
   *
   * Devolve `null` quando a atividade não está no banco — o caso mais provável
   * é o acervo de `content/` ainda não ter sido importado naquele ambiente.
   */
  carregarContexto(pedido: PedidoDeContexto): Promise<ContextoDaTentativa | null>;

  /**
   * Grava `Attempt`, `SkillMastery` e `ReviewCard` **dentro da transação
   * recebida** — que não é aberta aqui, porque não é só deste módulo.
   *
   * `docs/08 §11` exige que XP e carteira sejam atômicos com a tentativa, e
   * esses moram em outros módulos. Quem abre é o caso de uso; quem entra são os
   * manipuladores do evento, sem que nenhum dos módulos conheça os outros.
   *
   * Lança `TentativaJaRegistrada` ou `DominioMudouNoMeio`.
   */
  gravar(plano: PlanoDaTentativa, tx: Transacao): Promise<string>;

  /** `true` se já existe tentativa com esta chave. */
  jaRegistrada(idempotencyKey: string): Promise<boolean>;
}

export interface AssessmentDeps {
  readonly repositorio: RepositorioDeAvaliacao;
  readonly unidadeDeTrabalho: UnidadeDeTrabalho;
  /**
   * Publica o que a tentativa produziu.
   *
   * `assessment` mede; quem credita reage. Este módulo não conhece progressão
   * nem economia, e a lista de quem escuta é decidida no composition root.
   */
  readonly barramento: EventBus;
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
