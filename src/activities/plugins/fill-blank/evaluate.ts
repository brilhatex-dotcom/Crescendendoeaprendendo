import type { EvaluationContext, EvaluationResult } from "../../contracts";
import type { FillBlankAnswer, FillBlankConfig } from "./schema";

/**
 * Correção de completar-a-lacuna. **Função pura.**
 *
 * Mesma forma de `MULTIPLE_CHOICE` — uma opção certa entre várias — porque
 * escolher a palavra certa para a lacuna é, do ponto de vista da correção, o
 * mesmo problema. O motor não sabe disso: são dois plugins independentes,
 * cada um com sua própria cópia da lógica.
 */
export function evaluateFillBlank(
  config: FillBlankConfig,
  answer: FillBlankAnswer,
  ctx: EvaluationContext,
): EvaluationResult {
  if (answer.opcaoId === null) {
    return { outcome: "SKIPPED", scoreRatio: 0 };
  }

  const escolhida = config.opcoes.find((o) => o.id === answer.opcaoId);
  const correta = config.opcoes.find((o) => o.correta);

  if (!escolhida) {
    return {
      outcome: "INCORRECT",
      scoreRatio: 0,
      feedback: {
        tom: "ORIENTA",
        mensagem: "Não consegui ler sua resposta.",
        ensino: "Toque em uma das palavras do banco para preencher a lacuna.",
      },
    };
  }

  if (escolhida.correta) {
    return {
      outcome: "CORRECT",
      scoreRatio: 1,
      feedback: {
        tom: "CELEBRA",
        mensagem: config.mensagemDeAcerto,
      },
      detalhes: {
        opcaoEscolhida: escolhida.id,
        opcaoCorreta: escolhida.id,
        acertou: true,
      },
    };
  }

  const tom = ctx.dicasUsadas === 0 ? "QUASE" : "ORIENTA";

  const ensino =
    escolhida.ensino ?? "Vamos olhar de novo com calma. Leia a frase mais uma vez.";

  return {
    outcome: "INCORRECT",
    scoreRatio: 0,
    feedback: {
      tom,
      mensagem: "Quase! Não é essa palavra.",
      ensino,
      ...(config.dicas[ctx.dicasUsadas] ? { dica: config.dicas[ctx.dicasUsadas] } : {}),
    },
    ...(escolhida.equivoco ? { equivoco: escolhida.equivoco } : {}),
    detalhes: {
      opcaoEscolhida: escolhida.id,
      opcaoCorreta: correta?.id ?? null,
      acertou: false,
    },
  };
}

/**
 * Probabilidade de acertar chutando: 1/n palavras do banco (docs/08 §2).
 */
export function probabilidadeDeChuteFillBlank(config: FillBlankConfig): number {
  return config.opcoes.length > 0 ? 1 / config.opcoes.length : 0;
}
