/** Características declaradas de uma `Activity` — o que a camada de adaptação lê. */
export interface CaracteristicasDaAtividade {
  readonly requiresReading: boolean | null;
  readonly visualSupportLevel: string | null;
  readonly stepCount: number | null;
}

/**
 * QUAIS DIMENSÕES UMA ATIVIDADE ENSINA SOBRE UMA CRIANÇA.
 *
 * O mapeamento entre "o que a atividade declara" e "o que o perfil aprende".
 * Deliberadamente pequeno — três dimensões, cada uma amarrada a um campo já
 * declarado em `Activity` (docs/13 §12) — e deliberadamente extensível: uma
 * dimensão nova é uma função nova neste objeto, nunca uma migration
 * (`LearningProfileDimension.key` é `String` livre).
 *
 * Uma atividade sem nenhuma característica declarada (todo o acervo atual,
 * antes da Fase 2 autorar a primeira com variantes) não ensina nada aqui —
 * `dimensoesRelevantes` devolve `[]`, e o handler não faz nada. Isso é
 * intencional: sem uma característica de fato presente, não há o que
 * atribuir a "suporte visual ajudou" ou não.
 */
export const REGRAS_DE_DIMENSAO: Readonly<
  Record<string, (c: CaracteristicasDaAtividade) => boolean>
> = {
  /** A atividade oferece suporte visual de verdade (não "nenhum" nem "baixo"). */
  suporteVisual: (c) => c.visualSupportLevel === "medio" || c.visualSupportLevel === "alto",
  /** A atividade é decomposta em 3 ou mais etapas. */
  instrucaoPassoAPasso: (c) => (c.stepCount ?? 0) >= 3,
  /** A atividade não depende de leitura para ser respondida. */
  independenciaDeLeitura: (c) => c.requiresReading === false,
};

export function dimensoesRelevantes(caracteristicas: CaracteristicasDaAtividade): readonly string[] {
  return Object.entries(REGRAS_DE_DIMENSAO)
    .filter(([, regra]) => regra(caracteristicas))
    .map(([chave]) => chave);
}
