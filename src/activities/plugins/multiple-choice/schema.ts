import { z } from "zod";

import { apresentacaoDeFeedbackSchema } from "../../presentation";
import { apoioVisualSchema } from "../../stimulus";

/**
 * MÚLTIPLA ESCOLHA — contrato do conteúdo.
 *
 * O que este schema exige de quem autora é o que separa uma atividade
 * pedagógica de um quiz: **toda opção errada precisa dizer por que está
 * errada.** Não é burocracia — é o único jeito de o produto ensinar quando a
 * criança erra, em vez de só marcar um X.
 */

const opcaoSchema = z.object({
  /** Id estável. Nunca use o índice: reordenar as opções invalidaria respostas. */
  id: z.string().min(1).max(40),
  texto: z.string().min(1).max(280),
  /** Descrição para leitor de tela quando a opção tem imagem. */
  imagem: z
    .object({
      assetId: z.string().min(1),
      textoAlternativo: z.string().min(1).max(280),
    })
    .optional(),
  correta: z.boolean(),
  /**
   * Por que esta opção está errada, e o que observar para chegar na certa.
   * Obrigatório nas incorretas — checado abaixo por `superRefine`.
   */
  ensino: z.string().min(1).max(400).optional(),
  /**
   * Código do equívoco que esta escolha revela.
   * Ex.: "contou-o-primeiro-como-zero". Alimenta `Attempt.misconception` e,
   * depois, o relatório do responsável e o tutor.
   */
  equivoco: z.string().min(1).max(60).optional(),
});

export const multipleChoiceConfigSchema = z
  .object({
    schemaVersion: z.literal(1),
    enunciado: z.string().min(1).max(500),
    /** Texto lido em voz alta, quando difere do enunciado escrito. */
    enunciadoFalado: z.string().max(500).optional(),
    /**
     * O que a criança olha para responder.
     *
     * **Obrigatório sempre que o enunciado apontar para objetos** — "estas
     * conchas", "estes blocos". Sem ele a pergunta é impossível, e a criança só
     * pode chutar. Ver `stimulus.ts`.
     */
    apoio: apoioVisualSchema.optional(),
    opcoes: z.array(opcaoSchema).min(2).max(6),
    /** Mensagem de acerto. Específica da atividade, não genérica. */
    mensagemDeAcerto: z.string().min(1).max(280),
    /** Dicas em ordem: a primeira é a mais sutil. */
    dicas: z.array(z.string().min(1).max(300)).max(3).default([]),
    /** Ordem fixa quando a sequência das opções carrega significado. */
    embaralharOpcoes: z.boolean().default(true),
    apresentacao: apresentacaoDeFeedbackSchema.partial().optional(),
  })
  .superRefine((config, ctx) => {
    const corretas = config.opcoes.filter((o) => o.correta);

    if (corretas.length !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["opcoes"],
        message:
          corretas.length === 0
            ? "Nenhuma opção correta. Múltipla escolha precisa de exatamente uma."
            : `${corretas.length} opções corretas. Para mais de uma, use MULTI_SELECT.`,
      });
    }

    // A regra que faz esta plataforma ensinar em vez de só corrigir.
    config.opcoes.forEach((opcao, indice) => {
      if (!opcao.correta && !opcao.ensino) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["opcoes", indice, "ensino"],
          message:
            "Toda opção incorreta precisa de 'ensino': o que dizer a quem escolheu isto. " +
            "Erro sem explicação é só punição (docs/08 §12.3).",
        });
      }
    });

    const ids = new Set(config.opcoes.map((o) => o.id));
    if (ids.size !== config.opcoes.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["opcoes"],
        message: "Ids de opção repetidos — cada opção precisa de um id único.",
      });
    }
  });

export type MultipleChoiceConfig = z.infer<typeof multipleChoiceConfigSchema>;

export const multipleChoiceAnswerSchema = z.object({
  /** Id da opção escolhida, ou null quando a criança pulou. */
  opcaoId: z.string().min(1).max(40).nullable(),
});

export type MultipleChoiceAnswer = z.infer<typeof multipleChoiceAnswerSchema>;
