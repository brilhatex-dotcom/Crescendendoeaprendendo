import { z } from "zod";

import { apresentacaoDeFeedbackSchema } from "../../presentation";
import { apoioVisualSchema } from "../../stimulus";

/**
 * COMPLETAR A LACUNA — contrato do conteúdo.
 *
 * Uma frase com um espaço vazio, e um banco de palavras para tocar — nunca
 * digitação livre. Quem ainda está aprendendo a ler e a usar um teclado não
 * pode ser avaliado pela sua datilografia; o produto testa se a criança sabe
 * qual palavra completa a frase, não se ela sabe digitar sem erro.
 *
 * `enunciado` precisa conter o marcador `___` (três underscores) — é onde a
 * lacuna aparece. O restante do contrato é o mesmo de `MULTIPLE_CHOICE`
 * (banco de palavras com exatamente uma correta, cada errada com `ensino`),
 * duplicado aqui de propósito: "plugin não importa plugin" (docs/13).
 */

const MARCADOR_DE_LACUNA = "___";

const opcaoSchema = z.object({
  /** Id estável. Nunca use o índice: reordenar as opções invalidaria respostas. */
  id: z.string().min(1).max(40),
  /** A palavra ou expressão curta que preenche a lacuna. */
  texto: z.string().min(1).max(60),
  correta: z.boolean(),
  /** Obrigatório nas incorretas — checado abaixo por `superRefine`. */
  ensino: z.string().min(1).max(400).optional(),
  equivoco: z.string().min(1).max(60).optional(),
});

export const fillBlankConfigSchema = z
  .object({
    schemaVersion: z.literal(1),
    /** A frase com a lacuna marcada por `___`. Ex.: "Cinco mais dois é ___." */
    enunciado: z.string().min(1).max(500),
    enunciadoFalado: z.string().max(500).optional(),
    apoio: apoioVisualSchema.optional(),
    /** O banco de palavras que preenche a lacuna. */
    opcoes: z.array(opcaoSchema).min(2).max(6),
    mensagemDeAcerto: z.string().min(1).max(280),
    dicas: z.array(z.string().min(1).max(300)).max(3).default([]),
    embaralharOpcoes: z.boolean().default(true),
    apresentacao: apresentacaoDeFeedbackSchema.partial().optional(),
  })
  .superRefine((config, ctx) => {
    if (!config.enunciado.includes(MARCADOR_DE_LACUNA)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["enunciado"],
        message: `O enunciado precisa conter "${MARCADOR_DE_LACUNA}" marcando onde fica a lacuna.`,
      });
    }

    const corretas = config.opcoes.filter((o) => o.correta);
    if (corretas.length !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["opcoes"],
        message:
          corretas.length === 0
            ? "Nenhuma opção correta. A lacuna precisa de exatamente uma resposta certa."
            : `${corretas.length} opções corretas. A lacuna só admite uma.`,
      });
    }

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

export type FillBlankConfig = z.infer<typeof fillBlankConfigSchema>;

export const fillBlankAnswerSchema = z.object({
  /** Id da opção escolhida para a lacuna, ou null quando a criança pulou. */
  opcaoId: z.string().min(1).max(40).nullable(),
});

export type FillBlankAnswer = z.infer<typeof fillBlankAnswerSchema>;

/** Exportado para o renderer partir a frase em "antes"/"depois" da lacuna. */
export { MARCADOR_DE_LACUNA };
