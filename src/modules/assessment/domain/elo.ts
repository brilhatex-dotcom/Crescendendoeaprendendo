import { arredondar, limitar } from "./bkt";

/**
 * ELO — habilidade estimada da criança (docs/08 §2).
 *
 * O BKT responde "ela domina *esta competência*?". O Elo responde outra coisa:
 * "**em que altura da escala ela está agora?**" — um número comparável com a
 * dificuldade calibrada de qualquer atividade, de qualquer competência.
 *
 * É esse número que faz a seleção adaptativa funcionar (`alvoDeDificuldade`) e
 * que entra no fator de recompensa (`fatorDeDificuldade`). Sem ele, "difícil"
 * seria só o rótulo que o autor digitou.
 *
 * Puro. A dificuldade da atividade caminha na direção oposta pelo mesmo modelo,
 * mas isso é trabalho de job noturno com ≥ 200 tentativas (docs/08 §2) e não
 * acontece no caminho da criança.
 */
export const ELO = {
  /** Centro da escala: habilidade 1000 acerta ~50% de uma atividade 1000. */
  centro: 1000,
  /** K alto no começo: as primeiras tentativas devem mover muito a estimativa. */
  kInicial: 32,
  kEstavel: 16,
  tentativasAteEstabilizar: 20,
  /**
   * Trilhos da escala.
   *
   * Não é decoração numérica: sem eles, uma sequência ruim levaria uma criança
   * de 7 anos a uma habilidade tão baixa que nenhuma atividade do acervo
   * ficaria perto do alvo — e ela veria sempre o mesmo conteúdo. O teto tem o
   * papel simétrico. Ambos cabem folgados em `Decimal(7,3)`.
   */
  minima: 400,
  maxima: 2400,
} as const;

/**
 * Probabilidade de acerto prevista pelo modelo.
 *
 * Diferença de 400 pontos ≈ 10 para 1. É a mesma curva do xadrez, e a razão de
 * `alvoDeDificuldade` ser `habilidade + 60`: ali o esperado fica em torno de
 * 0.8, que é onde a criança acerta a maioria e tropeça um pouco.
 */
export function probabilidadeEsperada(habilidade: number, dificuldade: number): number {
  return 1 / (1 + 10 ** ((dificuldade - habilidade) / 400));
}

export function fatorK(tentativasAnteriores: number): number {
  return tentativasAnteriores < ELO.tentativasAteEstabilizar ? ELO.kInicial : ELO.kEstavel;
}

/**
 * `habilidade += K × (resultado − esperado)`.
 *
 * `resultado` é o `scoreRatio`, não um booleano — a mesma razão de o BKT
 * aceitar acerto parcial. Acertar o que já era esperado quase não move; acertar
 * o que era improvável move muito. É essa assimetria que faz a estimativa
 * convergir rápido sem oscilar depois.
 */
export function atualizarHabilidade(entrada: {
  readonly habilidade: number;
  readonly dificuldade: number;
  readonly scoreRatio: number;
  readonly tentativasAnteriores: number;
}): number {
  const esperado = probabilidadeEsperada(entrada.habilidade, entrada.dificuldade);
  const observado = limitar(entrada.scoreRatio, 0, 1);

  const bruta =
    entrada.habilidade + fatorK(entrada.tentativasAnteriores) * (observado - esperado);

  return arredondar(limitar(bruta, ELO.minima, ELO.maxima), 3);
}
