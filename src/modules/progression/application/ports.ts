import { ConflitoDeConcorrencia } from "@/shared/kernel";
import type { Clock, Transacao } from "@/shared/kernel";

import type { EstadoDeProgresso } from "../domain/progress";

/** Corrida na linha de progresso. Resposta: desfazer, reler, recalcular. */
export class ProgressoMudouNoMeio extends ConflitoDeConcorrencia {
  constructor() {
    super("LearnerProgress");
    this.name = "ProgressoMudouNoMeio";
  }
}

export interface RepositorioDeProgresso {
  /** `null` quando a criança nunca jogou — a linha ainda não existe. */
  carregar(learnerId: string, tx: Transacao): Promise<EstadoDeProgresso | null>;

  /**
   * Cria a linha. Lança `ProgressoMudouNoMeio` se outra escrita criou primeiro.
   */
  criar(learnerId: string, estado: EstadoDeProgresso, tx: Transacao): Promise<void>;

  /**
   * Atualização condicional por versão (docs/08 §11).
   * Lança `ProgressoMudouNoMeio` quando a versão esperada não está mais lá.
   */
  atualizar(
    learnerId: string,
    versaoEsperada: number,
    estado: EstadoDeProgresso,
    tx: Transacao,
  ): Promise<void>;

  /**
   * Registra desbloqueios concedidos pelo prêmio.
   *
   * Idempotente por natureza: `Unlock` tem chave única
   * `(learnerId, kind, refId)`, e reconceder o mesmo item não cria linha nova.
   */
  registrarDesbloqueios(
    learnerId: string,
    refIds: readonly string[],
    tx: Transacao,
  ): Promise<void>;

  /** Fuso do responsável, para a Trilha de Luz contar o dia certo. */
  fusoDoResponsavel(learnerId: string): Promise<string>;
}

/** Leitura para tela — fora de transação. */
export interface ConsultaDeProgresso {
  buscar(learnerId: string): Promise<EstadoDeProgresso | null>;
}

export interface ProgressionDeps {
  readonly repositorio: RepositorioDeProgresso;
  readonly clock: Clock;
}
