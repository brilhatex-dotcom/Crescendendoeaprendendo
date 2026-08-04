import { ConflitoDeConcorrencia } from "@/shared/kernel";
import type { Transacao } from "@/shared/kernel";

import type { EstadoDaCarteira, Lancamento } from "../domain/ledger";

/** Corrida na carteira. Resposta: desfazer, reler, recalcular. */
export class CarteiraMudouNoMeio extends ConflitoDeConcorrencia {
  constructor() {
    super("Wallet");
    this.name = "CarteiraMudouNoMeio";
  }
}

export interface RepositorioDeCarteira {
  /** `null` quando a criança ainda não tem carteira. */
  carregar(learnerId: string, tx: Transacao): Promise<EstadoDaCarteira | null>;

  /**
   * Grava os lançamentos e a projeção, na transação recebida.
   *
   * Os dois juntos ou nenhum: uma carteira atualizada sem lançamento é um saldo
   * sem explicação, e um lançamento sem carteira é uma criança que não vê o que
   * ganhou. Lança `CarteiraMudouNoMeio` na corrida.
   *
   * Devolve `false` quando **todos** os lançamentos já existiam — o caso do
   * retry. Não é erro: é a idempotência funcionando.
   */
  aplicar(
    learnerId: string,
    versaoEsperada: number | null,
    carteira: EstadoDaCarteira,
    lancamentos: readonly Lancamento[],
    tx: Transacao,
  ): Promise<boolean>;
}

/** Leitura para tela — fora de transação. */
export interface ConsultaDeCarteira {
  buscar(learnerId: string): Promise<EstadoDaCarteira>;
}

export interface EconomyDeps {
  readonly repositorio: RepositorioDeCarteira;
}
