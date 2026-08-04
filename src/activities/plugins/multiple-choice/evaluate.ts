import type { EvaluationContext, EvaluationResult } from "../../contracts";
import type { MultipleChoiceAnswer, MultipleChoiceConfig } from "./schema";

/**
 * Correção de múltipla escolha. **Função pura.**
 *
 * Sem relógio, sem sorteio, sem rede. Roda no servidor (autoritativa) e no
 * cliente (devolutiva instantânea, funciona offline) com o mesmo código.
 */
export function evaluateMultipleChoice(
  config: MultipleChoiceConfig,
  answer: MultipleChoiceAnswer,
  ctx: EvaluationContext,
): EvaluationResult {
  // Pular não é errar. Não há o que ensinar sobre uma resposta que não veio —
  // e tratar "pulou" como "errou" contaminaria o modelo de domínio com um
  // sinal que não é sobre saber ou não saber.
  if (answer.opcaoId === null) {
    return { outcome: "SKIPPED", scoreRatio: 0 };
  }

  const escolhida = config.opcoes.find((o) => o.id === answer.opcaoId);
  const correta = config.opcoes.find((o) => o.correta);

  /**
   * Id que não existe na config. Não é erro da criança: é resposta corrompida,
   * conteúdo trocado no meio da sessão, ou tentativa de burlar. Em todos os
   * casos, orientar a tentar de novo é a resposta honesta — e nenhum equívoco
   * é registrado, porque não houve equívoco pedagógico algum.
   */
  if (!escolhida) {
    return {
      outcome: "INCORRECT",
      scoreRatio: 0,
      feedback: {
        tom: "ORIENTA",
        mensagem: "Não consegui ler sua resposta.",
        ensino: "Toque em uma das opções da tela para responder.",
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
      /*
       * `opcaoCorreta` sai nos **dois** desfechos, e não só no erro.
       *
       * Faltava aqui, e o efeito na tela era o pior possível: a criança
       * acertava, a devolutiva dizia "Isso!", e a opção que ela escolheu
       * aparecia marcada com o coral de "tente de novo" — porque o renderer
       * comparava a escolha com uma `opcaoCorreta` que não tinha vindo.
       *
       * Detalhes com forma diferente por desfecho obrigam quem desenha a
       * conhecer dois contratos. Um só, sempre completo, é o que impede a
       * próxima tela de errar do mesmo jeito.
       */
      detalhes: {
        opcaoEscolhida: escolhida.id,
        opcaoCorreta: escolhida.id,
        acertou: true,
      },
    };
  }

  /**
   * O tom depende de quantas dicas já foram usadas.
   *
   * Sem dica, "QUASE" — a criança tentou por conta própria e merece o
   * enquadramento mais leve. Depois de já ter recebido ajuda, "ORIENTA", que
   * é o tom de quem vai ser levado pela mão até a resposta. A diferença não é
   * cosmética: ela muda a animação, o som e o tempo que a devolutiva fica na
   * tela (`presentation.ts`).
   */
  const tom = ctx.dicasUsadas === 0 ? "QUASE" : "ORIENTA";

  /*
   * `ensino` é garantido pelo schema: `superRefine` recusa conteúdo com opção
   * incorreta sem ele. O `??` existe só para satisfazer o tipo — se ele algum
   * dia for usado de verdade, é porque conteúdo entrou sem validação, e a
   * frase genérica é melhor que uma tela quebrada.
   */
  const ensino =
    escolhida.ensino ??
    "Vamos olhar de novo com calma. Leia a pergunta mais uma vez.";

  return {
    outcome: "INCORRECT",
    scoreRatio: 0,
    feedback: {
      tom,
      mensagem: "Quase! Não é essa.",
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
 * Probabilidade de acertar chutando: 1/n opções (docs/08 §2).
 *
 * Não é detalhe: o BKT usa isto para descontar sorte. Com 2 opções, metade dos
 * acertos é chute, e tratar 4 e 2 opções igual faria o sistema concluir que a
 * criança dominou o conteúdo quando ela só teve sorte num verdadeiro-ou-falso.
 */
export function probabilidadeDeChuteMultipleChoice(
  config: MultipleChoiceConfig,
): number {
  return config.opcoes.length > 0 ? 1 / config.opcoes.length : 0;
}
