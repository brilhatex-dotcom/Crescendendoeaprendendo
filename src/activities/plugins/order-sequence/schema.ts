import { z } from "zod";

import { apresentacaoDeFeedbackSchema } from "../../presentation";

/**
 * ORDENAR EM SEQUÊNCIA — contrato do conteúdo.
 *
 * Existe para ordenar números, etapas de uma rotina, fatos de uma história,
 * passos de um algoritmo. Serve a qualquer academia.
 *
 * Este plugin foi escolhido como segundo de propósito: a resposta é uma
 * **lista**, não uma escolha, e admite **crédito parcial**. Se o núcleo do
 * motor não precisou mudar para acomodá-lo, a arquitetura está provada — e ela
 * não precisou.
 */

const itemSchema = z.object({
  id: z.string().min(1).max(40),
  texto: z.string().min(1).max(200),
  imagem: z
    .object({
      assetId: z.string().min(1),
      textoAlternativo: z.string().min(1).max(280),
    })
    .optional(),
});

export const orderSequenceConfigSchema = z
  .object({
    schemaVersion: z.literal(1),
    enunciado: z.string().min(1).max(500),
    enunciadoFalado: z.string().max(500).optional(),
    /** Itens embaralhados que a criança vê. */
    itens: z.array(itemSchema).min(2).max(10),
    /** A ordem certa, por id. Define o gabarito. */
    ordemCorreta: z.array(z.string().min(1)).min(2).max(10),
    mensagemDeAcerto: z.string().min(1).max(280),
    /**
     * O que dizer a quem não acertou a ordem. Obrigatório: é o que transforma
     * "está errado" em "olhe o que vem antes".
     */
    ensino: z.string().min(1).max(400),
    /** Ensino específico quando acertou parte — reconhece o que já foi feito. */
    ensinoParcial: z.string().min(1).max(400).optional(),
    equivoco: z.string().min(1).max(60).optional(),
    dicas: z.array(z.string().min(1).max(300)).max(3).default([]),
    /**
     * Fração mínima de acertos para valer como PARTIAL em vez de INCORRECT.
     * Abaixo disso a criança não demonstrou entendimento parcial — acertou por
     * acaso — e tratar isso como "quase" seria elogio vazio.
     */
    limiarParcial: z.number().min(0).max(1).default(0.5),
    apresentacao: apresentacaoDeFeedbackSchema.partial().optional(),
  })
  .superRefine((config, ctx) => {
    const idsDosItens = new Set(config.itens.map((i) => i.id));

    if (idsDosItens.size !== config.itens.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["itens"],
        message: "Ids de item repetidos — cada item precisa de um id único.",
      });
    }

    if (config.ordemCorreta.length !== config.itens.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["ordemCorreta"],
        message: `A ordem correta tem ${config.ordemCorreta.length} ids, mas existem ${config.itens.length} itens.`,
      });
    }

    for (const id of config.ordemCorreta) {
      if (!idsDosItens.has(id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["ordemCorreta"],
          message: `A ordem correta cita o id "${id}", que não existe entre os itens.`,
        });
      }
    }

    if (new Set(config.ordemCorreta).size !== config.ordemCorreta.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["ordemCorreta"],
        message: "A ordem correta repete um id.",
      });
    }
  });

export type OrderSequenceConfig = z.infer<typeof orderSequenceConfigSchema>;

export const orderSequenceAnswerSchema = z.object({
  /** Ordem enviada pela criança. Vazia = pulou. */
  ordem: z.array(z.string().min(1).max(40)).max(10),
});

export type OrderSequenceAnswer = z.infer<typeof orderSequenceAnswerSchema>;
