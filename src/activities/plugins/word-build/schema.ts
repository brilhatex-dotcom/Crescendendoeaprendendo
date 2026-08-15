import { z } from "zod";

import { apresentacaoDeFeedbackSchema } from "../../presentation";

/**
 * MONTAR A PALAVRA — contrato do conteúdo.
 *
 * Existe para escrita e alfabetização: a criança toca letras (ou sílabas) num
 * banco embaralhado, em ordem, até montar a palavra-alvo.
 *
 * ── O que diferencia isto de `ORDER_SEQUENCE` ──
 * Em `ORDER_SEQUENCE` todo item apresentado faz parte do gabarito — a criança
 * só decide a ordem. Aqui o banco pode conter **pedaços que não são usados**
 * (letras parecidas, sílabas de outra palavra): reconhecer qual pedaço usar é
 * parte do que se avalia, não só a ordem. Por isso é um plugin próprio, e não
 * conteúdo de `ORDER_SEQUENCE` com um nome diferente.
 */

const pedacoSchema = z.object({
  id: z.string().min(1).max(40),
  /** A letra ou sílaba nesta peça. Ex.: "gA", "to", "B". */
  texto: z.string().min(1).max(20),
});

export const wordBuildConfigSchema = z
  .object({
    schemaVersion: z.literal(1),
    enunciado: z.string().min(1).max(500),
    enunciadoFalado: z.string().max(500).optional(),
    /** A palavra correta, só para exibição em `docs`/depuração — o gabarito de verdade é `sequenciaCorreta`. */
    palavra: z.string().min(1).max(40),
    imagem: z
      .object({
        assetId: z.string().min(1),
        textoAlternativo: z.string().min(1).max(280),
      })
      .optional(),
    /** Banco embaralhado que a criança vê — inclui as peças certas e, opcionalmente, iscas. */
    pedacos: z.array(pedacoSchema).min(2).max(12),
    /** A sequência certa de ids, na ordem que forma a palavra. */
    sequenciaCorreta: z.array(z.string().min(1)).min(2).max(12),
    mensagemDeAcerto: z.string().min(1).max(280),
    /** O que dizer a quem não montou a palavra certa. Obrigatório — docs/08 §12.3. */
    ensino: z.string().min(1).max(400),
    ensinoParcial: z.string().min(1).max(400).optional(),
    equivoco: z.string().min(1).max(60).optional(),
    dicas: z.array(z.string().min(1).max(300)).max(3).default([]),
    /** Fração mínima de letras certas na ordem certa para valer como PARTIAL em vez de INCORRECT. */
    limiarParcial: z.number().min(0).max(1).default(0.5),
    apresentacao: apresentacaoDeFeedbackSchema.partial().optional(),
  })
  .superRefine((config, ctx) => {
    const idsDosPedacos = new Set(config.pedacos.map((p) => p.id));

    if (idsDosPedacos.size !== config.pedacos.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["pedacos"],
        message: "Ids de pedaço repetidos — cada pedaço precisa de um id único.",
      });
    }

    if (new Set(config.sequenciaCorreta).size !== config.sequenciaCorreta.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sequenciaCorreta"],
        message: "A sequência correta repete um id.",
      });
    }

    for (const id of config.sequenciaCorreta) {
      if (!idsDosPedacos.has(id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["sequenciaCorreta"],
          message: `A sequência correta cita o id "${id}", que não existe entre os pedaços.`,
        });
      }
    }

    const porId = new Map(config.pedacos.map((p) => [p.id, p.texto]));
    const montada = config.sequenciaCorreta.map((id) => porId.get(id) ?? "").join("");
    if (montada && montada.toLowerCase() !== config.palavra.toLowerCase()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sequenciaCorreta"],
        message: `A sequência correta monta "${montada}", mas \`palavra\` é "${config.palavra}" — precisam bater.`,
      });
    }
  });

export type WordBuildConfig = z.infer<typeof wordBuildConfigSchema>;

export const wordBuildAnswerSchema = z.object({
  /** Ids dos pedaços que a criança tocou, na ordem em que tocou. Vazia = pulou. */
  sequencia: z.array(z.string().min(1).max(40)).max(12),
});

export type WordBuildAnswer = z.infer<typeof wordBuildAnswerSchema>;
