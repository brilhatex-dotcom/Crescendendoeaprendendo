import { z } from "zod";

import { apresentacaoDeFeedbackSchema } from "../../presentation";
import { apoioVisualSchema } from "../../stimulus";

/**
 * VERDADEIRO OU FALSO — contrato do conteúdo.
 *
 * O caso mais simples de todos: uma afirmação, e a criança diz se ela é
 * verdadeira ou falsa. Diferente de `MULTIPLE_CHOICE` com duas opções, quem
 * autora não escreve rótulo nenhum — "Verdadeiro" e "Falso" são fixos no
 * renderer, sempre nos mesmos dois lugares da tela. Isso existe porque é
 * exatamente o caso que `probabilidadeDeChuteMultipleChoice` já cita como
 * paradigma de chute-por-moeda (`multiple-choice/evaluate.ts`): aqui a
 * probabilidade é sempre 1/2, nunca calculada a partir de uma lista de
 * opções que, neste tipo, não existe.
 *
 * Sem crédito parcial — é uma pergunta binária, não há "quase verdadeiro".
 */

export const trueFalseConfigSchema = z.object({
  schemaVersion: z.literal(1),
  /** A afirmação a julgar. Ex.: "Cinco é maior que três." */
  enunciado: z.string().min(1).max(500),
  enunciadoFalado: z.string().max(500).optional(),
  apoio: apoioVisualSchema.optional(),
  /** Se a afirmação acima é verdadeira. */
  correta: z.boolean(),
  mensagemDeAcerto: z.string().min(1).max(280),
  /** O que dizer a quem errou. Obrigatório — docs/08 §12.3. */
  ensino: z.string().min(1).max(400),
  equivoco: z.string().min(1).max(60).optional(),
  dicas: z.array(z.string().min(1).max(300)).max(3).default([]),
  apresentacao: apresentacaoDeFeedbackSchema.partial().optional(),
});

export type TrueFalseConfig = z.infer<typeof trueFalseConfigSchema>;

export const trueFalseAnswerSchema = z.object({
  /** O que a criança respondeu, ou null quando pulou. */
  resposta: z.boolean().nullable(),
});

export type TrueFalseAnswer = z.infer<typeof trueFalseAnswerSchema>;
