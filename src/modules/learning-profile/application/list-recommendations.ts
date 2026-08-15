import type { RecomendacaoPersistida, RepositorioDePerfilDeAprendizagem } from "./ports";

export type ListarRecomendacoesPendentes = (
  learnerId: string,
) => Promise<readonly RecomendacaoPersistida[]>;

/** Leitura para a tela "Personalização da Aprendizagem" do responsável. */
export function criarListarRecomendacoesPendentes(deps: {
  readonly repositorio: RepositorioDePerfilDeAprendizagem;
}): ListarRecomendacoesPendentes {
  return (learnerId) => deps.repositorio.listarRecomendacoesPendentes(learnerId);
}
