import { containerDeAvaliacao } from "./assessment";

import { criarBuscarGaleria, type FigurinhaDaGaleria } from "@/modules/collection";

/**
 * Leitura da galeria de figurinhas para a tela.
 *
 * Reaproveita o repositório já montado em `containerDeAvaliacao`, mesmo
 * espírito de `progression.ts`: ler não abre transação e não deve falhar por
 * causa de uma corrida na concessão.
 */
export async function galeriaDaCrianca(learnerId: string): Promise<readonly FigurinhaDaGaleria[]> {
  const { colecao } = containerDeAvaliacao();
  const buscarGaleria = criarBuscarGaleria({ repositorio: colecao });
  return buscarGaleria(learnerId);
}
