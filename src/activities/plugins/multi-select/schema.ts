import { z } from "zod";

import { apresentacaoDeFeedbackSchema } from "../../presentation";
import { apoioVisualSchema } from "../../stimulus";

/**
 * MÚLTIPLA SELEÇÃO — contrato do conteúdo.
 *
 * "Toque em todos os que servem" — duas ou mais opções corretas, ao contrário
 * de `MULTIPLE_CHOICE` (exatamente uma). É o quinto plugin do motor, e como
 * `DRAG_MATCH`, admite crédito parcial: cada opção é um SIM/NÃO independente
 * ("marcar" ou "deixar em branco"), não uma escolha única a acertar ou errar.
 *
 * ── Por que `ensino` é único, não por opção ──
 * Em `MULTIPLE_CHOICE` cada opção errada é *o* caminho que a criança tomou —
 * faz sentido explicar cada uma. Aqui existem `2^n` respostas parciais
 * possíveis; não há "a" opção errada para explicar. Um `ensino` geral (mesmo
 * padrão de `DRAG_MATCH`) cobre a lição sem forçar autoria a escrever
 * explicação para toda combinação errada possível.
 */

const opcaoSchema = z.object({
  /** Id estável. Nunca use o índice: reordenar as opções invalidaria respostas. */
  id: z.string().min(1).max(40),
  texto: z.string().min(1).max(280),
  imagem: z
    .object({
      assetId: z.string().min(1),
      textoAlternativo: z.string().min(1).max(280),
    })
    .optional(),
  correta: z.boolean(),
});

export const multiSelectConfigSchema = z
  .object({
    schemaVersion: z.literal(1),
    enunciado: z.string().min(1).max(500),
    enunciadoFalado: z.string().max(500).optional(),
    apoio: apoioVisualSchema.optional(),
    /** Entre 3 e 6 opções — abaixo de 3 não há "seleção múltipla" de verdade. */
    opcoes: z.array(opcaoSchema).min(3).max(6),
    mensagemDeAcerto: z.string().min(1).max(280),
    /** O que dizer a quem não marcou tudo certo. Obrigatório — docs/08 §12.3. */
    ensino: z.string().min(1).max(400),
    ensinoParcial: z.string().min(1).max(400).optional(),
    equivoco: z.string().min(1).max(60).optional(),
    dicas: z.array(z.string().min(1).max(300)).max(3).default([]),
    /** Fração mínima de opções corretamente classificadas para valer como PARTIAL. */
    limiarParcial: z.number().min(0).max(1).default(0.5),
    embaralharOpcoes: z.boolean().default(true),
    apresentacao: apresentacaoDeFeedbackSchema.partial().optional(),
  })
  .superRefine((config, ctx) => {
    const corretas = config.opcoes.filter((o) => o.correta);

    if (corretas.length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["opcoes"],
        message:
          corretas.length === 0
            ? "Nenhuma opção correta. Múltipla seleção precisa de ao menos duas."
            : "Só uma opção correta. Para uma só, use MULTIPLE_CHOICE.",
      });
    }

    const ids = new Set(config.opcoes.map((o) => o.id));
    if (ids.size !== config.opcoes.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["opcoes"],
        message: "Ids de opção repetidos — cada opção precisa de um id único.",
      });
    }
  });

export type MultiSelectConfig = z.infer<typeof multiSelectConfigSchema>;

export const multiSelectAnswerSchema = z.object({
  /** Ids das opções marcadas. Vazio = pulou — nenhuma opção tocada. */
  opcaoIds: z.array(z.string().min(1).max(40)).max(6),
});

export type MultiSelectAnswer = z.infer<typeof multiSelectAnswerSchema>;
