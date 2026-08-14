import { dimensoesRelevantes, type CaracteristicasDaAtividade } from "../domain/dimension-rules";
import type { DimensaoDoPerfil } from "./read-profile";

/**
 * SELEÇÃO DE APRESENTAÇÃO — qual forma da mesma pergunta servir a esta criança.
 *
 * A pergunta pedagógica nunca muda; só a FORMA. `payload` é opaco aqui de
 * propósito — normalmente é o `config` do plugin — porque esta função decide
 * qual apresentação, nunca o que ela ensina.
 */
export interface ApresentacaoCandidata<T> {
  /** `null` identifica a apresentação padrão da atividade. */
  readonly tag: string | null;
  readonly caracteristicas: CaracteristicasDaAtividade;
  readonly payload: T;
}

/**
 * Confiança mínima para confiar numa dimensão na hora de ESCOLHER, não só de
 * registrar. `n / (n + 8)` cruza 0.5 em n = 8 observações (`domain/dimension.ts`)
 * — poucas demais para mudar o que a criança vê seria a mesma classe de erro
 * que o pedido do dono veio evitar: agir sem evidência de verdade.
 */
const CONFIANCA_MINIMA_PARA_ESCOLHER = 0.5;

/**
 * Valor mínimo (média de `scoreRatio` nas tentativas com esta característica)
 * para considerar que ela "ajuda". `scoreRatio` já é 1.0 = acerto pleno,
 * 0.5 = parcial, 0 = errou — 0.6 é "melhor que só parcial", não perfeição.
 */
const VALOR_MINIMO_PARA_ESCOLHER = 0.6;

/**
 * Escolhe qual apresentação servir, a partir do que o Learning Profile já
 * aprendeu sobre esta criança.
 *
 * ── Como decide ──
 * Cada candidata (padrão ou variante) declara características de forma
 * (`suporteVisual: "alto"`, etc.). Uma característica "conta" para uma
 * dimensão do perfil segundo a MESMA regra que decide se uma tentativa
 * deveria alimentar aquela dimensão em primeiro lugar
 * (`REGRAS_DE_DIMENSAO`/`dimensoesRelevantes`, Fase 1) — não existe uma
 * segunda leitura do que "suporte visual" significa.
 *
 * Entre as variantes cuja dimensão relevante o perfil já viu com confiança
 * e valor suficientes, escolhe a de maior valor × confiança. **Nunca decide
 * por uma dimensão sem evidência** — sem candidata qualificada, devolve a
 * apresentação padrão. É o guarda contra trocar a experiência da criança por
 * acaso, com uma ou duas tentativas.
 *
 * Determinístico: mesma entrada, mesma saída — a mesma missão nunca muda de
 * cara sozinha entre um carregamento e outro sem o perfil ter mudado junto.
 */
export function escolherApresentacao<T>(
  perfil: readonly DimensaoDoPerfil[],
  padrao: ApresentacaoCandidata<T>,
  variantes: readonly ApresentacaoCandidata<T>[],
): ApresentacaoCandidata<T> {
  if (variantes.length === 0 || perfil.length === 0) return padrao;

  const porChave = new Map(perfil.map((dimensao) => [dimensao.key, dimensao]));

  let melhor: { readonly candidata: ApresentacaoCandidata<T>; readonly pontuacao: number } | null =
    null;

  for (const candidata of variantes) {
    for (const chave of dimensoesRelevantes(candidata.caracteristicas)) {
      const dimensao = porChave.get(chave);
      if (!dimensao) continue;
      if (
        dimensao.confidence < CONFIANCA_MINIMA_PARA_ESCOLHER ||
        dimensao.value < VALOR_MINIMO_PARA_ESCOLHER
      ) {
        continue;
      }

      const pontuacao = dimensao.value * dimensao.confidence;
      if (!melhor || pontuacao > melhor.pontuacao) {
        melhor = { candidata, pontuacao };
      }
    }
  }

  return melhor?.candidata ?? padrao;
}
