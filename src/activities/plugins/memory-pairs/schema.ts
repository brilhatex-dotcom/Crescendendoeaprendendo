import { z } from "zod";

import { apresentacaoDeFeedbackSchema } from "../../presentation";

/**
 * JOGO DA MEMÓRIA — contrato do conteúdo.
 *
 * Existe para associação e memória de curto prazo: a criança vira cartas duas
 * a duas até encontrar todos os pares. Cada `par` declarado vira DUAS cartas
 * idênticas no tabuleiro — diferente de `DRAG_MATCH`, onde os dois lados de um
 * par são coisas diferentes que se correspondem (número ↔ quantidade).
 *
 * ── Por que o contrato é só "quantas tentativas", não a jogada inteira ──
 * O jogo em si (virar carta, comparar, virar de novo) é inteiramente do lado
 * do cliente — o mesmo raciocínio de `DRAG_MATCH`/`ORDER_SEQUENCE`, cujo
 * estado intermediário também não viaja ao servidor. Só quando TODOS os pares
 * já foram encontrados a criança tem uma resposta para enviar; `evaluate` não
 * arbitra o jogo, só mede a eficiência de quem já terminou.
 */
const parSchema = z.object({
  id: z.string().min(1).max(40),
  /** O que aparece nas duas cartas deste par. Ex.: "🐸" ou "7". */
  valor: z.string().min(1).max(60),
});

export const memoryPairsConfigSchema = z.object({
  schemaVersion: z.literal(1),
  enunciado: z.string().min(1).max(500),
  enunciadoFalado: z.string().max(500).optional(),
  /** Entre 2 e 6 pares — 12 cartas é o teto de um tabuleiro que ainda cabe numa tela de 6 anos. */
  pares: z.array(parSchema).min(2).max(6),
  mensagemDeAcerto: z.string().min(1).max(280),
  /** O que dizer a quem terminou com baixa eficiência de memória. Obrigatório — docs/08 §12.3. */
  ensino: z.string().min(1).max(400),
  ensinoParcial: z.string().min(1).max(400).optional(),
  dicas: z.array(z.string().min(1).max(300)).max(3).default([]),
  /** Eficiência mínima (numPares/tentativas) para valer como PARTIAL em vez de INCORRECT. */
  limiarParcial: z.number().min(0).max(1).default(0.5),
  apresentacao: apresentacaoDeFeedbackSchema.partial().optional(),
});

export type MemoryPairsConfig = z.infer<typeof memoryPairsConfigSchema>;

export const memoryPairsAnswerSchema = z.object({
  /** Quantas comparações (duas cartas viradas) a criança fez até achar todos os pares. Nulo = pulou. */
  tentativas: z.number().int().positive().nullable(),
});

export type MemoryPairsAnswer = z.infer<typeof memoryPairsAnswerSchema>;
