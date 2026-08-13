import { montarGaleria, type FigurinhaDaGaleria } from "../domain/gallery";
import type { CollectionDeps } from "./ports";

/** Leitura para a tela da galeria. Fora de transação, nunca falha por corrida. */
export function criarBuscarGaleria(deps: CollectionDeps) {
  return async function buscarGaleria(learnerId: string): Promise<readonly FigurinhaDaGaleria[]> {
    const { catalogo, ganhas } = await deps.repositorio.galeria(learnerId);
    return montarGaleria(catalogo, ganhas);
  };
}

export type BuscarGaleria = ReturnType<typeof criarBuscarGaleria>;
