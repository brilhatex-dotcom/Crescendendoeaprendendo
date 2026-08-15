/**
 * DIMENSÃO DE PERFIL DE APRENDIZAGEM — matemática pura.
 *
 * Motor de Aprendizagem Adaptativa (pedido do dono): a plataforma observa
 * como cada criança se sai quando uma característica de apresentação está
 * presente (suporte visual, instrução em etapas, ausência de leitura...) e
 * infere, com confiança crescente, se aquilo ajuda.
 *
 * ── Por que recompute, não acumulação incremental ──
 * O mesmo raciocínio de `achievement/domain/criteria.ts`: o outbox é
 * *at-least-once*. Uma média incremental ("+1 por evento") processada duas
 * vezes contaria a mesma tentativa duas vezes. Aqui a média é sempre
 * recalculada a partir das tentativas de fato registradas — reprocessar o
 * mesmo evento recalcula o mesmo número.
 *
 * ── Por que nunca diagnostica ──
 * Este arquivo não sabe — e não pode saber — o que causa um valor baixo ou
 * alto numa dimensão. Ele mede correlação entre uma característica de
 * apresentação e o desempenho, nada além disso. A chave da dimensão é sempre
 * um eixo de apresentação ("suporteVisual"), nunca o nome de uma condição.
 */

/** Só desfechos que representam uma tentativa real contam como evidência. */
const DESFECHOS_COM_SINAL = new Set(["CORRECT", "PARTIAL", "INCORRECT"]);

export function contaComoEvidencia(outcome: string): boolean {
  return DESFECHOS_COM_SINAL.has(outcome);
}

/**
 * Suavização da confiança: `confiança = n / (n + K)`.
 *
 * Cresce de 0 rumo a 1 sem nunca alcançar 1 (sempre cabe mais evidência). Com
 * `K = 8`, 37 observações já dão ~82% de confiança — a mesma ordem de
 * grandeza do exemplo do próprio pedido do dono ("Confiança: 82%,
 * Observações: 37").
 */
const K_SUAVIZACAO = 8;

export function calcularConfianca(observationsCount: number): number {
  if (observationsCount <= 0) return 0;
  return observationsCount / (observationsCount + K_SUAVIZACAO);
}

/** Média simples dos `scoreRatio` das tentativas relevantes. `null` sem nenhuma. */
export function calcularValor(scoreRatios: readonly number[]): number | null {
  if (scoreRatios.length === 0) return null;
  const soma = scoreRatios.reduce((total, s) => total + s, 0);
  return soma / scoreRatios.length;
}

/**
 * Confiança mínima para confiar numa dimensão na hora de AGIR sobre ela
 * (escolher uma variante, sugerir uma configuração) — não só de registrar.
 * `n / (n + 8)` cruza 0.5 em n = 8 observações — poucas demais para mudar o
 * que a criança vê ou sugerir algo ao responsável seria a mesma classe de
 * erro que o pedido do dono veio evitar: agir sem evidência de verdade.
 */
export const CONFIANCA_MINIMA_PARA_AGIR = 0.5;

/**
 * Valor mínimo (média de `scoreRatio` nas tentativas com esta característica)
 * para considerar que ela "ajuda". `scoreRatio` já é 1.0 = acerto pleno,
 * 0.5 = parcial, 0 = errou — 0.6 é "melhor que só parcial", não perfeição.
 */
export const VALOR_MINIMO_PARA_AGIR = 0.6;

/**
 * Há evidência o bastante para agir sobre esta dimensão — escolher uma
 * variante de apresentação (Fase 3a) ou sugerir uma configuração ao
 * responsável (Fase 3b). Uma função só, para as duas decisões nunca
 * divergirem sobre o que conta como "evidência suficiente".
 */
export function evidenciaSuficiente(confidence: number, value: number): boolean {
  return confidence >= CONFIANCA_MINIMA_PARA_AGIR && value >= VALOR_MINIMO_PARA_AGIR;
}

export interface DimensaoRecomputada {
  readonly value: number;
  readonly confidence: number;
  readonly observationsCount: number;
}

export interface DimensaoAnterior {
  readonly value: number;
  readonly confidence: number;
}

/** Diferença mínima para valer a pena registrar um `LearningProfileEvent`. */
const LIMIAR_DE_MUDANCA = 0.02;

/**
 * Recomputa uma dimensão a partir de TODAS as tentativas relevantes já
 * persistidas. Determinístico: mesma entrada, mesma saída — a propriedade que
 * torna reprocessar o mesmo evento seguro.
 */
export function recomputarDimensao(scoreRatios: readonly number[]): DimensaoRecomputada | null {
  const value = calcularValor(scoreRatios);
  if (value === null) return null;
  return {
    value,
    confidence: calcularConfianca(scoreRatios.length),
    observationsCount: scoreRatios.length,
  };
}

/**
 * Se a mudança em relação ao valor gravado é grande o bastante para merecer
 * uma linha de auditoria (`LearningProfileEvent`). Reprocessar o mesmo evento
 * recomputa o mesmo valor — a diferença dá zero, e nada novo é registrado.
 */
export function mudouOSuficiente(
  anterior: DimensaoAnterior | null,
  novo: DimensaoRecomputada,
): boolean {
  if (anterior === null) return true;
  return (
    Math.abs(novo.value - anterior.value) >= LIMIAR_DE_MUDANCA ||
    Math.abs(novo.confidence - anterior.confidence) >= LIMIAR_DE_MUDANCA
  );
}
