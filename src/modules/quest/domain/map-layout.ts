import { z } from "zod";

/**
 * LAYOUT VISUAL DO MAPA (`World.mapLayout`).
 *
 * Puramente geografia: onde cada missão aparece no mapa da ilha, e que
 * caminhos a ligam às vizinhas. Não é regra — não decide se a missão é
 * jogável (isso é `unlock-rule.ts`); só decide onde desenhar o nó.
 *
 * `x`/`y` são percentuais (0–100) da área do mapa, não pixels — o mesmo
 * layout autorado serve para qualquer tamanho de tela, e a tela decide a
 * projeção real.
 *
 * Arquivo puro.
 */

export interface NoDoLayout {
  /** Referência da missão em `content/` (`Quest.sourceRef`) — o mesmo valor de `questCompleted`. */
  readonly missaoRef: string;
  readonly x: number;
  readonly y: number;
}

export interface ArestaDoLayout {
  readonly de: string;
  readonly para: string;
}

export interface LayoutDoMapa {
  readonly nos: readonly NoDoLayout[];
  readonly arestas: readonly ArestaDoLayout[];
}

/** Layout sem nenhum nó — o valor de um mundo ainda não desenhado. */
export const LAYOUT_VAZIO: LayoutDoMapa = { nos: [], arestas: [] };

/**
 * Schema do layout gravado em `World.mapLayout`.
 *
 * Vive aqui — no módulo que desenha o mapa — e é importado pelo schema de
 * autoria em `content/`, pelo mesmo raciocínio de `regraDeDesbloqueioSchema`:
 * duas definições da mesma forma é como elas divergem, e a divergência
 * aparece como conteúdo válido na autoria que a tela não sabe desenhar.
 */
export const layoutDoMapaSchema = z.object({
  nos: z
    .array(
      z.object({
        missaoRef: z.string().min(1).max(300),
        x: z.number().min(0).max(100),
        y: z.number().min(0).max(100),
      }),
    )
    .min(1),
  arestas: z
    .array(z.object({ de: z.string().min(1).max(300), para: z.string().min(1).max(300) }))
    .default([]),
});
