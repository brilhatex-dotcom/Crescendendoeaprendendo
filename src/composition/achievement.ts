import { containerDeAvaliacao } from "./assessment";

import { criarBuscarQuadro, type ConquistaNoQuadro } from "@/modules/achievement";
import { systemClock } from "@/shared/kernel";

/**
 * Leitura do quadro de conquistas para a tela.
 *
 * Reaproveita o repositório já montado em `containerDeAvaliacao`, mesmo
 * espírito de `collection.ts`: ler não abre transação e não deve falhar por
 * causa de uma corrida no avanço de progresso.
 */
export async function quadroDeConquistasDaCrianca(
  learnerId: string,
): Promise<readonly ConquistaNoQuadro[]> {
  const { conquistas } = containerDeAvaliacao();
  const buscarQuadro = criarBuscarQuadro({ repositorio: conquistas, clock: systemClock });
  return buscarQuadro(learnerId);
}
