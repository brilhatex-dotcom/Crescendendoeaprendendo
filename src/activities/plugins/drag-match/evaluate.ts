import type { EvaluationContext, EvaluationResult } from "../../contracts";
import type { DragMatchAnswer, DragMatchConfig } from "./schema";

/**
 * Correção de pareamento. **Função pura.**
 *
 * Crédito parcial por fração de pares certos — mesmo espírito de
 * `ORDER_SEQUENCE`: uma criança que pareou 4 de 5 corretamente demonstrou
 * entender a relação, e zerar isso porque não fechou os cinco seria medir
 * "completou tudo", não "entendeu a relação".
 */
export function evaluateDragMatch(
  config: DragMatchConfig,
  answer: DragMatchAnswer,
  ctx: EvaluationContext,
): EvaluationResult {
  const entradas = Object.entries(answer.pareamentos);

  if (entradas.length === 0) {
    return { outcome: "SKIPPED", scoreRatio: 0 };
  }

  const idsValidos = new Set(config.pares.map((p) => p.id));

  for (const [esquerdaId, direitaId] of entradas) {
    // Id desconhecido: resposta corrompida. Orientar, sem culpar a criança.
    if (!idsValidos.has(esquerdaId) || !idsValidos.has(direitaId)) {
      return {
        outcome: "INCORRECT",
        scoreRatio: 0,
        feedback: {
          tom: "ORIENTA",
          mensagem: "Não consegui ler sua resposta.",
          ensino: "Toque num item de cada lado para formar um par, e tente de novo.",
        },
      };
    }
  }

  const total = config.pares.length;
  const acertos = entradas.filter(([esquerdaId, direitaId]) => esquerdaId === direitaId).length;
  const respondeuTudo = entradas.length === total;
  const scoreRatio = total > 0 ? acertos / total : 0;
  const acertouTudo = respondeuTudo && acertos === total;

  const detalhes = {
    /** Cada par do gabarito e se a criança acertou aquele — o renderer destaca com isso. */
    pares: config.pares.map((p) => ({
      id: p.id,
      pareado: answer.pareamentos[p.id] !== undefined,
      correto: answer.pareamentos[p.id] === p.id,
    })),
    acertos,
    total,
  };

  if (acertouTudo) {
    return {
      outcome: "CORRECT",
      scoreRatio: 1,
      feedback: { tom: "CELEBRA", mensagem: config.mensagemDeAcerto },
      detalhes,
    };
  }

  const alcancouParcial = scoreRatio >= config.limiarParcial;
  const dica = config.dicas[ctx.dicasUsadas];

  if (alcancouParcial) {
    return {
      outcome: "PARTIAL",
      scoreRatio,
      feedback: {
        tom: "QUASE",
        mensagem: `Você acertou ${acertos} de ${total} pares.`,
        ensino: config.ensinoParcial ?? config.ensino,
        ...(dica ? { dica } : {}),
      },
      ...(config.equivoco ? { equivoco: config.equivoco } : {}),
      detalhes,
    };
  }

  return {
    outcome: "INCORRECT",
    scoreRatio,
    feedback: {
      tom: ctx.dicasUsadas === 0 ? "QUASE" : "ORIENTA",
      mensagem: "Ainda não são esses os pares.",
      ensino: config.ensino,
      ...(dica ? { dica } : {}),
    },
    ...(config.equivoco ? { equivoco: config.equivoco } : {}),
    detalhes,
  };
}

/**
 * Chutar o pareamento certo de n pares é 1/n! — a mesma matemática de
 * `ORDER_SEQUENCE` (uma correspondência aleatória entre dois conjuntos de
 * tamanho n é uma permutação). Duplicado aqui de propósito: plugin não
 * importa plugin (docs/13 · HANDOFF §3).
 */
export function probabilidadeDeChuteDragMatch(config: DragMatchConfig): number {
  const n = config.pares.length;
  if (n < 2) return 1;

  let fatorial = 1;
  for (let i = 2; i <= n; i += 1) fatorial *= i;
  return 1 / fatorial;
}
