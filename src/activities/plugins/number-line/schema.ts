import { z } from "zod";

import { apresentacaoDeFeedbackSchema } from "../../presentation";

/**
 * RETA NUMÉRICA — contrato do conteúdo.
 *
 * Existe para o senso de posição e magnitude do número — "onde fica o 7" é uma
 * habilidade diferente de "quanto é 7", e nenhum plugin existente mede isso: a
 * resposta é uma posição contínua ao longo de uma faixa, não uma escolha entre
 * opções nem uma sequência de itens.
 *
 * ── Por que crédito parcial por distância, e não certo/errado ──
 * Uma criança que aponta pro 6 quando a resposta é 7 entendeu a posição quase
 * inteira — a magnitude, a direção, quase o lugar certo. Tratar isso como
 * "errado" tanto quanto apontar pro 0 seria o mesmo elogio vazio que
 * `ORDER_SEQUENCE` já rejeita para ordenação: aqui a métrica é distância até o
 * valor certo, normalizada pela pior distância possível dentro da faixa.
 */
export const numberLineConfigSchema = z
  .object({
    schemaVersion: z.literal(1),
    enunciado: z.string().min(1).max(500),
    enunciadoFalado: z.string().max(500).optional(),
    /** Extremos da reta, inclusive. */
    minimo: z.number().int(),
    maximo: z.number().int(),
    /** Onde a criança precisa tocar. */
    valorCorreto: z.number().int(),
    mensagemDeAcerto: z.string().min(1).max(280),
    /** O que dizer a quem não tocou no lugar certo. Obrigatório — docs/08 §12.3. */
    ensino: z.string().min(1).max(400),
    ensinoParcial: z.string().min(1).max(400).optional(),
    equivoco: z.string().min(1).max(60).optional(),
    dicas: z.array(z.string().min(1).max(300)).max(3).default([]),
    /** Pontuação normalizada mínima (1 − distância/pior-distância) para valer como PARTIAL. */
    limiarParcial: z.number().min(0).max(1).default(0.5),
    apresentacao: apresentacaoDeFeedbackSchema.partial().optional(),
  })
  .superRefine((config, ctx) => {
    if (config.maximo <= config.minimo) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["maximo"],
        message: "`maximo` precisa ser maior que `minimo`.",
      });
    }

    // Acima disso os alvos de toque na tela de uma criança de 6 anos ficam
    // pequenos demais para o dedo — mesmo limite de itens de ORDER_SEQUENCE/DRAG_MATCH.
    if (config.maximo - config.minimo > 20) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["maximo"],
        message: "A faixa entre `minimo` e `maximo` não pode ter mais de 20 posições.",
      });
    }

    if (config.valorCorreto < config.minimo || config.valorCorreto > config.maximo) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["valorCorreto"],
        message: "`valorCorreto` precisa estar entre `minimo` e `maximo`.",
      });
    }
  });

export type NumberLineConfig = z.infer<typeof numberLineConfigSchema>;

export const numberLineAnswerSchema = z.object({
  /** Posição tocada pela criança. Nulo = pulou. */
  valor: z.number().int().nullable(),
});

export type NumberLineAnswer = z.infer<typeof numberLineAnswerSchema>;
