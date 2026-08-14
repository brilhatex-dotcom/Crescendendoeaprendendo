"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";

import type { ActivityRendererProps } from "./types";

/**
 * MAPA DE RENDERERS — `rendererId` → componente.
 *
 * Separado do núcleo do motor de propósito: `registry.ts` é puro e roda no
 * servidor; isto é React e roda no navegador. Misturar os dois faria o
 * `evaluate` — que precisa rodar nos dois lados — arrastar React para o
 * servidor e Prisma para o cliente.
 *
 * ── Por que `next/dynamic` ──
 * Cada renderer vira um pedaço separado do bundle, carregado só quando aquele
 * tipo de atividade aparece. Sem isso, o dia em que existir um Sudoku com
 * biblioteca de canvas, uma criança fazendo múltipla escolha baixaria o Sudoku
 * junto. O custo de um tipo novo fica no tipo novo.
 *
 * Este arquivo e `plugins/index.ts` são os dois únicos que ganham uma linha
 * quando um tipo nasce.
 */
/**
 * Cada renderer é tipado no seu próprio config; o mapa precisa guardá-los todos
 * juntos, e props em React são contravariantes — `Componente<ConfigEspecífico>`
 * não é um `Componente<unknown>`. A conversão abaixo é o mesmo selamento que o
 * `registry.ts` faz do lado do servidor.
 *
 * O que garante a segurança em tempo de execução: o `rendererId` vem do próprio
 * plugin, e o `config` já foi validado pelo `configSchema` **daquele** plugin
 * antes de chegar aqui. Um renderer nunca recebe config de outro tipo — a menos
 * que alguém escreva o `rendererId` errado no plugin, que é justamente o que o
 * teste de integridade do manifesto pega.
 */
function selarRenderer<TConfig, TAnswer>(
  componente: ComponentType<ActivityRendererProps<TConfig, TAnswer>>,
): ComponentType<ActivityRendererProps> {
  return componente as unknown as ComponentType<ActivityRendererProps>;
}

const RENDERERS: Readonly<Record<string, ComponentType<ActivityRendererProps>>> = {
  "multiple-choice": dynamic<ActivityRendererProps>(
    () =>
      import("./multiple-choice-renderer").then((m) =>
        selarRenderer(m.MultipleChoiceRenderer),
      ),
    { loading: () => <EsqueletoDeAtividade /> },
  ),

  "order-sequence": dynamic<ActivityRendererProps>(
    () =>
      import("./order-sequence-renderer").then((m) =>
        selarRenderer(m.OrderSequenceRenderer),
      ),
    { loading: () => <EsqueletoDeAtividade /> },
  ),

  "drag-match": dynamic<ActivityRendererProps>(
    () => import("./drag-match-renderer").then((m) => selarRenderer(m.DragMatchRenderer)),
    { loading: () => <EsqueletoDeAtividade /> },
  ),

  "multi-select": dynamic<ActivityRendererProps>(
    () => import("./multi-select-renderer").then((m) => selarRenderer(m.MultiSelectRenderer)),
    { loading: () => <EsqueletoDeAtividade /> },
  ),

  "true-false": dynamic<ActivityRendererProps>(
    () => import("./true-false-renderer").then((m) => selarRenderer(m.TrueFalseRenderer)),
    { loading: () => <EsqueletoDeAtividade /> },
  ),
};

export function obterRenderer(
  rendererId: string,
): ComponentType<ActivityRendererProps> | null {
  return RENDERERS[rendererId] ?? null;
}

/**
 * Espaço reservado enquanto o pedaço do bundle chega.
 *
 * Tem altura fixa para não empurrar o conteúdo quando o componente real
 * aparece: layout que pula debaixo do dedo faz a criança tocar no lugar errado.
 */
function EsqueletoDeAtividade() {
  return (
    <div
      role="status"
      aria-label="Carregando a atividade"
      className="min-h-64 animate-pulse rounded-[var(--radius-lg)] border border-[var(--glass-border)] bg-[var(--color-play-raised)]"
    />
  );
}

export type { ActivityRendererProps } from "./types";
