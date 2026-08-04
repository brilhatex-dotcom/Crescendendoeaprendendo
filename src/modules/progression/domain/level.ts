/**
 * NÍVEL E TIER (docs/08 §1).
 *
 * A curva é `xpParaNivel(n) = round(120 × n^1.45)`: rápida nos primeiros
 * níveis, estável depois. Rápida no começo porque é ali que a criança decide se
 * o lugar vale a pena; estável depois porque, uma vez que ela decidiu, subir
 * rápido demais esvazia o significado de subir.
 *
 * **Nunca há perda de XP nem rebaixamento de tier.** Não é generosidade: é que
 * regressão desmotiva e não ensina nada. A única direção é para cima, e todas
 * as funções aqui são monotônicas por construção.
 *
 * Arquivo puro.
 */

/** Tiers do banco (`LevelTier`), com o nome que a criança vê (Bíblia Cap. 6). */
export const TIERS = [
  { tier: "APRENDIZ", apelido: "Faísca", nivelMinimo: 1 },
  { tier: "EXPLORADOR", apelido: "Lanterna", nivelMinimo: 10 },
  { tier: "INVENTOR", apelido: "Chama", nivelMinimo: 20 },
  { tier: "GUARDIAO", apelido: "Brasa", nivelMinimo: 35 },
  { tier: "MESTRE", apelido: "Fogueira", nivelMinimo: 50 },
  { tier: "GENIO", apelido: "Aurora", nivelMinimo: 70 },
  { tier: "SABIO", apelido: "Constelação", nivelMinimo: 90 },
  { tier: "LENDA", apelido: "Farol", nivelMinimo: 120 },
] as const;

export type Tier = (typeof TIERS)[number]["tier"];

const COEFICIENTE = 120;
const EXPOENTE = 1.45;

/**
 * Luz acumulada necessária para **estar** no nível `n`.
 *
 * O `n − 1` na fórmula é a decisão que faz o nível 1 começar em zero. A
 * alternativa literal (`120 × n^1.45`) exigiria 120 de Luz para estar no nível
 * 1, e uma criança que acabou de chegar apareceria no nível 0 — um número que
 * não existe no produto.
 */
export function luzAcumuladaParaNivel(nivel: number): number {
  if (nivel <= 1) return 0;
  return Math.round(COEFICIENTE * (nivel - 1) ** EXPOENTE);
}

/**
 * Nível correspondente a uma quantidade de Luz.
 *
 * Busca linear a partir do nível atual seria mais rápida, mas exigiria receber
 * o nível atual — e um nível gravado errado se perpetuaria. Calcular sempre do
 * total garante que a Luz é a **única** fonte da verdade: se a coluna `level`
 * divergir, a próxima tentativa a corrige sozinha.
 */
export function nivelParaLuz(luzTotal: number): number {
  const luz = Math.max(0, Math.floor(luzTotal));

  let nivel = 1;
  while (luzAcumuladaParaNivel(nivel + 1) <= luz) {
    nivel += 1;
    // Trava de sanidade: a curva cresce, então isto nunca é alcançado com Luz
    // realista. Existe para que um dado corrompido não vire laço infinito.
    if (nivel > 1000) break;
  }
  return nivel;
}

export function tierDoNivel(nivel: number): Tier {
  let escolhido: Tier = "APRENDIZ";
  for (const faixa of TIERS) {
    if (nivel >= faixa.nivelMinimo) escolhido = faixa.tier;
  }
  return escolhido;
}

export const apelidoDoTier = (tier: Tier): string =>
  TIERS.find((faixa) => faixa.tier === tier)?.apelido ?? "Faísca";

/** Quanto falta para o próximo nível — o número que a barra de progresso mostra. */
export function progressoNoNivel(luzTotal: number): {
  readonly nivel: number;
  readonly luzNoNivel: number;
  readonly luzParaSubir: number;
} {
  const nivel = nivelParaLuz(luzTotal);
  const base = luzAcumuladaParaNivel(nivel);
  const proximo = luzAcumuladaParaNivel(nivel + 1);

  return {
    nivel,
    luzNoNivel: luzTotal - base,
    luzParaSubir: proximo - base,
  };
}
