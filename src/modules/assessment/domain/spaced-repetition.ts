import type { AttemptOutcome } from "@/activities";

import { arredondar, limitar } from "./bkt";

/**
 * REPETIÇÃO ESPAÇADA — SM-2 adaptado (docs/04, `ReviewCard`).
 *
 * "Manter o mundo aceso": o que foi aprendido e nunca mais visto some. O cartão
 * de revisão marca **quando** aquela competência precisa reaparecer, e o
 * intervalo cresce sozinho enquanto a criança acerta.
 *
 * ── Duas adaptações conscientes ao SM-2 original ──
 *
 * 1. **Teto de intervalo.** O algoritmo original chega a anos, o que faz
 *    sentido para um adulto memorizando vocabulário por décadas. Aqui, um
 *    intervalo de dois anos é o mesmo que nunca mais revisar: a criança terá
 *    mudado de faixa etária e de currículo. O teto mantém a revisão dentro do
 *    horizonte em que ela ainda significa alguma coisa.
 *
 * 2. **Qualidade derivada do desfecho e das dicas**, não digitada por quem
 *    responde. Perguntar "como foi para você?" a uma criança de 7 anos não
 *    produz um sinal utilizável — e produziria a tentação de responder "fácil"
 *    para acabar logo.
 *
 * Puro: o "agora" entra por parâmetro.
 */
export const SM2 = {
  facilidadeInicial: 2.5,
  /** Piso do SM-2 original. Abaixo disto o intervalo pararia de crescer. */
  facilidadeMinima: 1.3,
  primeiroIntervaloDias: 1,
  segundoIntervaloDias: 6,
  /** Ver adaptação 1 no cabeçalho. */
  intervaloMaximoDias: 120,
  /** Qualidade abaixo disto é recaída: o intervalo volta ao começo. */
  limiarDeRecaida: 3,
} as const;

export interface EstadoDeRevisao {
  readonly intervaloDias: number;
  readonly facilidade: number;
  readonly venceEm: Date;
  readonly recaidas: number;
}

/**
 * Desfecho + dicas → qualidade 0..5 do SM-2.
 *
 * Repare que acertar com dicas nunca cai abaixo de 3. Pedir ajuda e chegar lá
 * não é recaída — é exatamente o comportamento que o produto quer ensinar
 * (docs/08 §1). O que a dica reduz é o crescimento do intervalo, via
 * `facilidade`, não a validade do acerto.
 */
export function qualidadeDaResposta(
  outcome: AttemptOutcome,
  scoreRatio: number,
  dicasUsadas: number,
): number {
  switch (outcome) {
    case "CORRECT":
      return Math.max(SM2.limiarDeRecaida, 5 - Math.max(0, dicasUsadas));
    case "PARTIAL":
      return scoreRatio >= 0.5 ? 3 : 2;
    case "INCORRECT":
    case "TIMEOUT":
      // 1 e não 0: houve ensino junto com a devolutiva, então nunca é um
      // branco completo. O 0 do SM-2 original não tem correspondente aqui.
      return 1;
    case "SKIPPED":
      // Pular não é errar. O chamador não agenda revisão neste caso — este
      // valor existe só para a função ser total.
      return 0;
  }
}

/**
 * Próximo agendamento.
 *
 * `atual` nulo é a primeira vez que esta competência entra na fila de revisão.
 */
export function proximaRevisao(
  atual: EstadoDeRevisao | null,
  qualidade: number,
  agora: Date,
): EstadoDeRevisao {
  const anterior = atual ?? {
    intervaloDias: 0,
    facilidade: SM2.facilidadeInicial,
    venceEm: agora,
    recaidas: 0,
  };

  const q = limitar(Math.round(qualidade), 0, 5);

  // Fórmula do SM-2: acertar fácil aumenta a facilidade, errar derruba.
  const facilidade = Math.max(
    SM2.facilidadeMinima,
    arredondar(anterior.facilidade + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)), 2),
  );

  if (q < SM2.limiarDeRecaida) {
    /*
     * Recaída: o intervalo volta a 1 dia, mas a facilidade acumulada é
     * preservada (já reduzida acima). Zerar a facilidade junto puniria duas vezes
     * o mesmo tropeço, e o cartão levaria semanas para voltar ao ritmo.
     */
    return {
      intervaloDias: SM2.primeiroIntervaloDias,
      facilidade,
      venceEm: emDias(agora, SM2.primeiroIntervaloDias),
      recaidas: anterior.recaidas + 1,
    };
  }

  const intervaloDias = Math.min(
    SM2.intervaloMaximoDias,
    proximoIntervalo(anterior.intervaloDias, facilidade),
  );

  return {
    intervaloDias,
    facilidade,
    venceEm: emDias(agora, intervaloDias),
    recaidas: anterior.recaidas,
  };
}

/**
 * 1 dia → 6 dias → intervalo × facilidade.
 *
 * O `Math.max` garante crescimento estrito depois do segundo passo: com
 * facilidade no piso (1.3), `round(6 × 1.3)` daria 8, mas um cartão com
 * facilidade baixa e intervalo 7 poderia arredondar de volta para 9 e depois
 * para 12 — a monotonicidade precisa ser explícita, não emergente.
 */
function proximoIntervalo(intervaloAnterior: number, facilidade: number): number {
  if (intervaloAnterior <= 0) return SM2.primeiroIntervaloDias;
  if (intervaloAnterior < SM2.segundoIntervaloDias) return SM2.segundoIntervaloDias;
  return Math.max(intervaloAnterior + 1, Math.round(intervaloAnterior * facilidade));
}

const MS_POR_DIA = 24 * 60 * 60 * 1000;

const emDias = (referencia: Date, dias: number): Date =>
  new Date(referencia.getTime() + dias * MS_POR_DIA);

/** Dias corridos (fracionários) entre dois instantes. */
export function diasEntre(inicio: Date | null, fim: Date): number {
  if (!inicio) return 0;
  return Math.max(0, (fim.getTime() - inicio.getTime()) / MS_POR_DIA);
}
