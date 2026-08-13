import { z } from "zod";

import { apresentacaoDeFeedbackSchema } from "../../presentation";

/**
 * PAREAR — contrato do conteúdo.
 *
 * Existe para combinar número com quantidade, palavra com imagem, causa com
 * consequência — qualquer relação um-para-um entre dois conjuntos. É o quarto
 * plugin do motor, e como o terceiro (`ORDER_SEQUENCE`), a resposta não é uma
 * escolha: é uma correspondência, e admite crédito parcial.
 *
 * ── Por que os dois lados de um par compartilham `id` ──
 * `par.id` nunca aparece na tela — só `esquerda`/`direita` (texto ou emoji)
 * aparecem. Isso permite que a correção seja `pareamento[id] === id`, sem
 * indireção nenhuma, e sem vazar a resposta: a criança nunca vê o id.
 */

const parSchema = z.object({
  id: z.string().min(1).max(40),
  /** O que aparece na coluna da esquerda. Ex.: "4". */
  esquerda: z.string().min(1).max(120),
  /** O que aparece na coluna da direita. Ex.: "🐚🐚🐚🐚". */
  direita: z.string().min(1).max(120),
});

export const dragMatchConfigSchema = z
  .object({
    schemaVersion: z.literal(1),
    enunciado: z.string().min(1).max(500),
    enunciadoFalado: z.string().max(500).optional(),
    /** Entre 2 e 6 pares — acima disso a tela de sete anos vira ruído. */
    pares: z.array(parSchema).min(2).max(6),
    mensagemDeAcerto: z.string().min(1).max(280),
    /** O que dizer a quem não pareou tudo certo. Obrigatório — ver docs/08 §12.3. */
    ensino: z.string().min(1).max(400),
    ensinoParcial: z.string().min(1).max(400).optional(),
    equivoco: z.string().min(1).max(60).optional(),
    dicas: z.array(z.string().min(1).max(300)).max(3).default([]),
    /** Fração mínima de pares certos para valer como PARTIAL em vez de INCORRECT. */
    limiarParcial: z.number().min(0).max(1).default(0.5),
    apresentacao: apresentacaoDeFeedbackSchema.partial().optional(),
  })
  .superRefine((config, ctx) => {
    const ids = new Set(config.pares.map((p) => p.id));
    if (ids.size !== config.pares.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["pares"],
        message: "Ids de par repetidos — cada par precisa de um id único.",
      });
    }
  });

export type DragMatchConfig = z.infer<typeof dragMatchConfigSchema>;

export const dragMatchAnswerSchema = z.object({
  /**
   * Para cada id de par da esquerda que a criança pareou, o id de par da
   * direita que ela escolheu. Um par certo é `pareamentos[id] === id`. Par
   * ainda não tocado simplesmente não tem chave aqui — vazio é "pulou".
   */
  pareamentos: z.record(z.string().min(1).max(40), z.string().min(1).max(40)),
});

export type DragMatchAnswer = z.infer<typeof dragMatchAnswerSchema>;
