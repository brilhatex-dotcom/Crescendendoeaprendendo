import type { EvaluationContext, EvaluationResult } from "../../contracts";
import type { MultiSelectAnswer, MultiSelectConfig } from "./schema";

/**
 * Correção de múltipla seleção. **Função pura.**
 *
 * Cada opção é um SIM/NÃO independente: "marcar" quando é correta, "deixar
 * em branco" quando não é. O acerto é a fração de opções em que a escolha da
 * criança bateu com o gabarito — diferente de `DRAG_MATCH`, que só conta os
 * pares que a criança de fato tocou. Aqui não existe "não tocada": um
 * checkbox está sempre marcado ou não, então deixar uma opção errada em
 * branco já é, por si, um acerto sobre aquela opção.
 */
export function evaluateMultiSelect(
  config: MultiSelectConfig,
  answer: MultiSelectAnswer,
  ctx: EvaluationContext,
): EvaluationResult {
  if (answer.opcaoIds.length === 0) {
    return { outcome: "SKIPPED", scoreRatio: 0 };
  }

  const idsValidos = new Set(config.opcoes.map((o) => o.id));

  // Id que não existe na config: resposta corrompida, não erro pedagógico.
  if (answer.opcaoIds.some((id) => !idsValidos.has(id))) {
    return {
      outcome: "INCORRECT",
      scoreRatio: 0,
      feedback: {
        tom: "ORIENTA",
        mensagem: "Não consegui ler sua resposta.",
        ensino: "Toque nas opções da tela para responder, e tente de novo.",
      },
    };
  }

  const escolhidas = new Set(answer.opcaoIds);
  const total = config.opcoes.length;
  const acertos = config.opcoes.filter((o) => escolhidas.has(o.id) === o.correta).length;
  const scoreRatio = total > 0 ? acertos / total : 0;

  const acertouTudo = config.opcoes.every((o) => escolhidas.has(o.id) === o.correta);

  const detalhes = {
    /** Cada opção do gabarito, o que a criança marcou e se bateu — o renderer destaca com isso. */
    opcoes: config.opcoes.map((o) => ({
      id: o.id,
      escolhida: escolhidas.has(o.id),
      correta: o.correta,
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
        mensagem: `Você acertou ${acertos} de ${total}.`,
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
      mensagem: "Ainda não são essas.",
      ensino: config.ensino,
      ...(dica ? { dica } : {}),
    },
    ...(config.equivoco ? { equivoco: config.equivoco } : {}),
    detalhes,
  };
}

/**
 * Chutar o subconjunto certo entre `n` opções: cada uma é uma moeda
 * independente (marcar ou não), então são `2^n` respostas possíveis e só uma
 * é o gabarito exato. Duplicado de `probabilidadeDeChuteDragMatch` de
 * propósito: plugin não importa plugin (docs/13 · HANDOFF §3).
 */
export function probabilidadeDeChuteMultiSelect(config: MultiSelectConfig): number {
  const n = config.opcoes.length;
  return n > 0 ? 1 / 2 ** n : 0;
}
