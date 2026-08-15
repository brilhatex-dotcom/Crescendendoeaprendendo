import type { EvaluationContext, EvaluationResult } from "../../contracts";
import type { NumberLineAnswer, NumberLineConfig } from "./schema";

/**
 * Correção de reta numérica. **Função pura.**
 *
 * Mede distância até o valor certo, normalizada pela pior distância possível
 * dentro da faixa declarada — mesma disciplina de crédito parcial de
 * `ORDER_SEQUENCE`/`WORD_BUILD`, adaptada a uma resposta que é uma posição, não
 * uma lista.
 */
export function evaluateNumberLine(
  config: NumberLineConfig,
  answer: NumberLineAnswer,
  ctx: EvaluationContext,
): EvaluationResult {
  if (answer.valor === null) {
    return { outcome: "SKIPPED", scoreRatio: 0 };
  }

  if (answer.valor < config.minimo || answer.valor > config.maximo) {
    return {
      outcome: "INCORRECT",
      scoreRatio: 0,
      feedback: {
        tom: "ORIENTA",
        mensagem: "Não consegui ler sua resposta.",
        ensino: "Toque num ponto da reta numérica e tente de novo.",
      },
    };
  }

  const distancia = Math.abs(answer.valor - config.valorCorreto);

  if (distancia === 0) {
    return {
      outcome: "CORRECT",
      scoreRatio: 1,
      feedback: { tom: "CELEBRA", mensagem: config.mensagemDeAcerto },
      detalhes: { valorEnviado: answer.valor, valorCorreto: config.valorCorreto, distancia },
    };
  }

  const piorDistancia = Math.max(
    config.valorCorreto - config.minimo,
    config.maximo - config.valorCorreto,
  );
  const scoreRatio = Math.max(0, 1 - distancia / piorDistancia);
  const detalhes = { valorEnviado: answer.valor, valorCorreto: config.valorCorreto, distancia };

  const alcancouParcial = scoreRatio >= config.limiarParcial;
  const dica = config.dicas[ctx.dicasUsadas];

  if (alcancouParcial) {
    return {
      outcome: "PARTIAL",
      scoreRatio,
      feedback: {
        tom: "QUASE",
        mensagem: `Quase! Faltou pouco — você tocou perto do ${config.valorCorreto}.`,
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
      mensagem: "Ainda não é essa a posição.",
      ensino: config.ensino,
      ...(dica ? { dica } : {}),
    },
    ...(config.equivoco ? { equivoco: config.equivoco } : {}),
    detalhes,
  };
}

/** Chutar a posição exata entre `n` inteiros da faixa é `1/n`. */
export function probabilidadeDeChuteNumberLine(config: NumberLineConfig): number {
  const n = config.maximo - config.minimo + 1;
  return n > 0 ? 1 / n : 1;
}
