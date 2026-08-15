import type { EvaluationContext, EvaluationResult } from "../../contracts";
import type { MemoryPairsAnswer, MemoryPairsConfig } from "./schema";

/**
 * Correção do jogo da memória. **Função pura.**
 *
 * A criança só chega a responder depois de já ter encontrado todos os pares
 * — o jogo em si roda inteiro no cliente. `evaluate` mede eficiência:
 * `numPares / tentativas`, 1 quando cada comparação já foi um par (memória
 * perfeita), menor quanto mais tentativas além do mínimo possível.
 */
export function evaluateMemoryPairs(
  config: MemoryPairsConfig,
  answer: MemoryPairsAnswer,
  ctx: EvaluationContext,
): EvaluationResult {
  if (answer.tentativas === null) {
    return { outcome: "SKIPPED", scoreRatio: 0 };
  }

  const numPares = config.pares.length;

  // Menos tentativas que pares é matematicamente impossível — cada tentativa
  // resolve no máximo um par. Resposta corrompida, não uma criança "boa
  // demais".
  if (answer.tentativas < numPares) {
    return {
      outcome: "INCORRECT",
      scoreRatio: 0,
      feedback: {
        tom: "ORIENTA",
        mensagem: "Não consegui ler sua resposta.",
        ensino: "Vire as cartas duas a duas até achar todos os pares e tente de novo.",
      },
    };
  }

  const scoreRatio = numPares / answer.tentativas;
  const detalhes = { tentativas: answer.tentativas, numPares };
  const dica = config.dicas[ctx.dicasUsadas];

  if (answer.tentativas === numPares) {
    return {
      outcome: "CORRECT",
      scoreRatio: 1,
      feedback: { tom: "CELEBRA", mensagem: config.mensagemDeAcerto },
      detalhes,
    };
  }

  const alcancouParcial = scoreRatio >= config.limiarParcial;

  if (alcancouParcial) {
    return {
      outcome: "PARTIAL",
      scoreRatio,
      feedback: {
        tom: "QUASE",
        mensagem: `Você achou todos os pares em ${answer.tentativas} tentativas!`,
        ensino: config.ensinoParcial ?? config.ensino,
        ...(dica ? { dica } : {}),
      },
      detalhes,
    };
  }

  return {
    outcome: "INCORRECT",
    scoreRatio,
    feedback: {
      tom: "ORIENTA",
      mensagem: `Você achou todos os pares em ${answer.tentativas} tentativas.`,
      ensino: config.ensino,
      ...(dica ? { dica } : {}),
    },
    detalhes,
  };
}

/**
 * Chance de acertar um par virando duas cartas ao acaso, sem memória
 * nenhuma: a primeira carta é livre, a segunda precisa ser a única, entre as
 * `2n − 1` restantes, que forma par com ela.
 */
export function probabilidadeDeChuteMemoryPairs(config: MemoryPairsConfig): number {
  const n = config.pares.length;
  return n > 0 ? 1 / (2 * n - 1) : 1;
}
