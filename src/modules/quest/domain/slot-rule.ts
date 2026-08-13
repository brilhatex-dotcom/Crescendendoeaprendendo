import { z } from "zod";

/**
 * REGRA DE SLOT (docs/04 §6, docs/08 §7).
 *
 * `StageActivity.slotRule` — o que um slot dinâmico declara sobre a atividade
 * que ainda não existe. Dois modos, porque são dois pedidos de seleção
 * diferentes:
 *
 * - `objetivo` — vem de um `Objective` declarado no conteúdo. `difficultyDelta`
 *   é somado à **habilidade** antes do seletor calcular o alvo
 *   (`alvoDeDificuldade`) — a mesma unidade da escala Elo usada em "reduzir
 *   alvo em 100" (docs/08 §7.6). `0` é o padrão: sem declaração, o slot mira
 *   exatamente onde a criança está.
 * - `revisao` — não declara objetivo nenhum: quem escolhe é a fila de
 *   `ReviewCard` vencida da própria criança (docs/08 §7.2), uma competência
 *   diferente por slot. Existe para a missão "Fila de Revisão" (`docs/08 §7`),
 *   a única do acervo que usa este modo hoje.
 *
 * Arquivo puro.
 */

export type RegraDeSlot =
  | {
      readonly modo: "objetivo";
      readonly objectiveId: string;
      readonly difficultyDelta: number;
    }
  | {
      readonly modo: "revisao";
    };

export const regraDeSlotSchema = z.discriminatedUnion("modo", [
  z
    .object({
      modo: z.literal("objetivo"),
      objectiveId: z.string().min(1),
      difficultyDelta: z.number().default(0),
    })
    .strict(),
  z.object({ modo: z.literal("revisao") }).strict(),
]);
