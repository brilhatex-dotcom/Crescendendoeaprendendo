import type { LearningProfileDeps } from "./ports";

export interface DimensaoDoPerfil {
  readonly key: string;
  readonly value: number;
  readonly confidence: number;
  readonly observationsCount: number;
  readonly lastObservedAt: Date | null;
}

export type BuscarPerfilDeAprendizagem = (
  learnerId: string,
  academyId?: string | null,
) => Promise<readonly DimensaoDoPerfil[]>;

/**
 * Leitura do perfil para quem decide (seleção de variante, Fase 3) e para a
 * tela "Personalização da Aprendizagem" do responsável (Fase 3). Fora de
 * transação — ler o perfil nunca deve falhar por causa de uma corrida na
 * atualização dele.
 */
export function criarBuscarPerfilDeAprendizagem(
  deps: LearningProfileDeps,
): BuscarPerfilDeAprendizagem {
  return async function buscarPerfilDeAprendizagem(learnerId, academyId = null) {
    const { dimensions } = await deps.repositorio.lerPerfil(learnerId, academyId);

    return [...dimensions.entries()]
      .map(([key, d]) => ({
        key,
        value: d.value,
        confidence: d.confidence,
        observationsCount: d.observationsCount,
        lastObservedAt: d.lastObservedAt,
      }))
      .sort((a, b) => a.key.localeCompare(b.key));
  };
}
