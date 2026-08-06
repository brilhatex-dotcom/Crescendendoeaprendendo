import { z } from "zod";

/**
 * REGRA DE SLOT (docs/04 §6, docs/08 §7).
 *
 * `StageActivity.slotRule` — o que um slot dinâmico declara sobre a atividade
 * que ainda não existe: de qual objetivo ela vem, e o quanto desviar do alvo
 * padrão de dificuldade. `difficultyDelta` é somado à **habilidade** antes do
 * seletor calcular o alvo (`alvoDeDificuldade`) — a mesma unidade da escala
 * Elo usada em "reduzir alvo em 100" (docs/08 §7.6). `0` é o padrão: sem
 * declaração, o slot mira exatamente onde a criança está.
 *
 * Arquivo puro.
 */

export interface RegraDeSlot {
  readonly objectiveId: string;
  readonly difficultyDelta: number;
}

export const regraDeSlotSchema = z
  .object({
    objectiveId: z.string().min(1),
    difficultyDelta: z.number().default(0),
  })
  .strict();
