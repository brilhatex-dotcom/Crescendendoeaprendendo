import { montarQuadro, type ConquistaNoQuadro } from "../domain/board";
import type { AchievementDeps } from "./ports";

/** Leitura para a tela do quadro de conquistas. Fora de transação, nunca falha por corrida. */
export function criarBuscarQuadro(deps: AchievementDeps) {
  return async function buscarQuadro(learnerId: string): Promise<readonly ConquistaNoQuadro[]> {
    const { catalogo, progresso } = await deps.repositorio.quadro(learnerId);
    return montarQuadro(catalogo, progresso);
  };
}

export type BuscarQuadro = ReturnType<typeof criarBuscarQuadro>;
