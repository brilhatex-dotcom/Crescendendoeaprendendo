import type { EvaluationContext, EvaluationResult } from "../../contracts";
import type { TrueFalseAnswer, TrueFalseConfig } from "./schema";

/**
 * Correção de verdadeiro-ou-falso. **Função pura.**
 *
 * Binária por natureza — sem "id de opção" para não existir na config, então
 * não há o caso de resposta corrompida que `MULTIPLE_CHOICE`/`MULTI_SELECT`
 * tratam à parte. `resposta` só pode ser `true`, `false` ou `null`.
 */
export function evaluateTrueFalse(
  config: TrueFalseConfig,
  answer: TrueFalseAnswer,
  ctx: EvaluationContext,
): EvaluationResult {
  if (answer.resposta === null) {
    return { outcome: "SKIPPED", scoreRatio: 0 };
  }

  const acertou = answer.resposta === config.correta;

  if (acertou) {
    return {
      outcome: "CORRECT",
      scoreRatio: 1,
      feedback: {
        tom: "CELEBRA",
        mensagem: config.mensagemDeAcerto,
      },
      detalhes: {
        respostaDada: answer.resposta,
        respostaCorreta: config.correta,
        acertou: true,
      },
    };
  }

  // Mesmo tom escalonado por dica de MULTIPLE_CHOICE: sem dica ainda, "QUASE";
  // depois de já ter recebido ajuda, "ORIENTA".
  const tom = ctx.dicasUsadas === 0 ? "QUASE" : "ORIENTA";

  return {
    outcome: "INCORRECT",
    scoreRatio: 0,
    feedback: {
      tom,
      mensagem: "Quase! Não é essa.",
      ensino: config.ensino,
      ...(config.dicas[ctx.dicasUsadas] ? { dica: config.dicas[ctx.dicasUsadas] } : {}),
    },
    ...(config.equivoco ? { equivoco: config.equivoco } : {}),
    detalhes: {
      respostaDada: answer.resposta,
      respostaCorreta: config.correta,
      acertou: false,
    },
  };
}

/**
 * Probabilidade de acertar chutando: sempre 1/2 — cara ou coroa, não há
 * lista de opções para contar (docs/08 §2).
 */
export function probabilidadeDeChuteTrueFalse(_config: TrueFalseConfig): number {
  return 0.5;
}
