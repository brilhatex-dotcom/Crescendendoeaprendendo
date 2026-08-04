import { containerDeAvaliacao } from "./assessment";

import type { EstadoDaCarteira } from "@/modules/economy";
import { carteiraInicial } from "@/modules/economy";
import type { EstadoDeProgresso } from "@/modules/progression";
import { progressoInicial } from "@/modules/progression";

/**
 * Leitura de progresso e carteira para as telas.
 *
 * Fica separada do caminho de escrita porque é outra coisa: ler não abre
 * transação, não publica evento e nunca deve falhar por causa de uma corrida.
 * A criança que abre a base tem que ver a base.
 *
 * Reaproveita os repositórios já montados em `containerDeAvaliacao` — instância
 * nova por requisição desperdiçaria a conexão e não ganharia nada.
 */
export interface PainelDaCrianca {
  readonly progresso: EstadoDeProgresso;
  readonly carteira: EstadoDaCarteira;
}

export async function painelDaCrianca(learnerId: string): Promise<PainelDaCrianca> {
  const { progresso, carteira } = containerDeAvaliacao();

  const [lido, saldo] = await Promise.all([
    progresso.buscar(learnerId),
    carteira.buscar(learnerId),
  ]);

  return {
    /*
     * Quem nunca jogou não tem linha, e isso não é um erro — é o estado inicial.
     * Mostrar zero de Luz e Fôlego cheio é a verdade sobre ela; devolver erro
     * faria a base não abrir na primeira visita, que é justamente a que mais
     * importa.
     */
    progresso: lido ?? progressoInicial(new Date()),
    carteira: saldo ?? carteiraInicial(),
  };
}
